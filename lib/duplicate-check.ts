import { redis } from "./kv"
import crypto from "crypto"
import type { RefundRequest } from "./types"

/**
 * 중복 환불 탐지 키 생성
 * 차량번호 + 상사명/ID + 환불수단 + 청구금액을 조합하여 해시 생성
 */
export function generateDuplicateKey(
  vehicleNumber: string,
  companyName: string,
  refundMethod: string,
  claimAmount: number,
): string {
  // 공백 제거 및 대소문자 통일
  const normalized = [
    vehicleNumber.replace(/\s/g, "").toUpperCase(),
    companyName.replace(/\s/g, "").toUpperCase(),
    refundMethod.toLowerCase(),
    claimAmount.toString(),
  ].join("|")

  // SHA-256 해시 생성
  const hash = crypto.createHash("sha256").update(normalized).digest("hex")
  return `refund:dup:${hash}`
}

/**
 * 중복 환불 체크
 * @returns 중복 환불건 ID 또는 null
 */
export async function checkDuplicateRefund(
  vehicleNumber: string,
  companyName: string | undefined,
  refundMethod: string,
  claimAmount: number,
): Promise<string | null> {
  try {
    // 상사명이 없으면 중복 체크 불가
    if (!companyName) {
      return null
    }

    const dupKey = generateDuplicateKey(vehicleNumber, companyName, refundMethod, claimAmount)
    const existingRefundId = await redis.get<string>(dupKey)

    if (existingRefundId) {
      // 기존 환불건이 실제로 존재하는지 확인
      const existingRefund = await redis.get<RefundRequest>(`refund:${existingRefundId}`)
      if (existingRefund) {
        console.log(`[v0] Duplicate refund detected: ${existingRefundId} for key ${dupKey}`)
        return existingRefundId
      }
      // 환불건이 삭제되었으면 중복키도 정리
      await redis.del(dupKey)
    }

    return null
  } catch (error) {
    // Redis 장애 시 중복 체크 실패 로그만 남기고 진행
    console.error("[v0] Duplicate check failed:", error)
    return null
  }
}

/**
 * 중복키 등록
 * 환불건 생성 후 호출하여 중복 탐지 인덱스에 추가
 */
export async function registerDuplicateKey(
  refundId: string,
  vehicleNumber: string,
  companyName: string | undefined,
  refundMethod: string,
  claimAmount: number,
): Promise<void> {
  try {
    if (!companyName) {
      return
    }

    const dupKey = generateDuplicateKey(vehicleNumber, companyName, refundMethod, claimAmount)
    // TTL 없이 저장 (영구 보관)
    await redis.set(dupKey, refundId)
    console.log(`[v0] Registered duplicate key: ${dupKey} -> ${refundId}`)
  } catch (error) {
    // 중복키 등록 실패해도 환불 생성은 성공으로 처리
    console.error("[v0] Failed to register duplicate key:", error)
  }
}

/**
 * 중복키 삭제
 * 환불건 삭제 시 호출하여 중복 탐지 인덱스에서 제거
 */
export async function removeDuplicateKey(
  vehicleNumber: string,
  companyName: string | undefined,
  refundMethod: string,
  claimAmount: number,
): Promise<void> {
  try {
    if (!companyName) {
      return
    }

    const dupKey = generateDuplicateKey(vehicleNumber, companyName, refundMethod, claimAmount)
    await redis.del(dupKey)
    console.log(`[v0] Removed duplicate key: ${dupKey}`)
  } catch (error) {
    console.error("[v0] Failed to remove duplicate key:", error)
  }
}

/**
 * 목록 조회용 중복 체크 (Pipeline 최적화)
 * @param refunds 환불건 목록
 * @returns 중복 정보가 추가된 환불건 목록
 */
export async function checkDuplicatesForList(refunds: RefundRequest[]): Promise<RefundRequest[]> {
  try {
    if (refunds.length === 0) {
      return refunds
    }

    const pipeline = redis.pipeline()
    const keyMap = new Map<number, string>()

    refunds.forEach((refund, index) => {
      if (refund.vehicleNumber && refund.companyName && refund.refundMethod && refund.claimAmount) {
        const dupKey = generateDuplicateKey(
          refund.vehicleNumber,
          refund.companyName,
          refund.refundMethod,
          refund.claimAmount,
        )
        keyMap.set(index, dupKey)
        pipeline.get(dupKey)
      }
    })

    if (keyMap.size === 0) {
      return refunds
    }

    const results = await pipeline.exec()

    const enhancedRefunds = refunds.map((refund, index) => {
      if (!keyMap.has(index)) {
        return refund
      }

      const resultIndex = Array.from(keyMap.keys()).indexOf(index)
      const duplicateRefundId = results[resultIndex] as string | null

      if (duplicateRefundId && duplicateRefundId !== refund.id) {
        return {
          ...refund,
          isDuplicate: true,
          duplicateRefundId,
        }
      }

      return refund
    })

    const duplicateCount = enhancedRefunds.filter((r) => r.isDuplicate).length
    console.log(`[v0] Duplicate check for list: ${duplicateCount}/${refunds.length} duplicates found`)

    return enhancedRefunds
  } catch (error) {
    console.error("[v0] Duplicate check for list failed:", error)
    return refunds
  }
}
