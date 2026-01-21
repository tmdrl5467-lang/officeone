import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User, BatchRefundHeader, BatchRefundLineItem } from "@/lib/types"
import { addToIndexes, removeFromAllIndexes } from "@/lib/refund-index"
import { checkDuplicateRefund, registerDuplicateKey } from "@/lib/duplicate-check"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (!sessionId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const sessionData = await redis.get<User>(`session:${sessionId}`)
    if (!sessionData) {
      return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 })
    }

    const user: User = sessionData

    const body = await request.json()
    const header: BatchRefundHeader = body.header
    const items: BatchRefundLineItem[] = body.items
    const forceCreate = body.forceCreate === true

    // Validate header
    if (!header.insuranceProvider || !header.companyName || !header.refundMethod) {
      return NextResponse.json({ error: "보험사, 상사명, 환불수단은 필수 항목입니다." }, { status: 400 })
    }

    if (header.insuranceProvider === "기타(직접입력)" && !header.insuranceProviderEtc) {
      return NextResponse.json({ error: "보험사(기타)를 입력해주세요." }, { status: 400 })
    }

    if (header.refundMethod === "account") {
      if (!header.bankName || !header.accountNumber || !header.accountHolder) {
        return NextResponse.json({ error: "계좌 환불 시 은행명, 계좌번호, 예금주가 필요합니다." }, { status: 400 })
      }
    }

    if (header.refundMethod === "offset" && !header.offsetReason?.trim()) {
      return NextResponse.json({ error: "상계 환불 시 상계 사유가 필요합니다." }, { status: 400 })
    }

    // Validate items
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 환불 항목이 필요합니다." }, { status: 400 })
    }

    if (!forceCreate) {
      const duplicates: { index: number; vehicleNumber: string; existingRefundId: string }[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const duplicateRefundId = await checkDuplicateRefund(
          item.vehicleNumber,
          header.companyName,
          header.refundMethod,
          Number(item.claimAmount),
        )

        if (duplicateRefundId) {
          duplicates.push({
            index: i,
            vehicleNumber: item.vehicleNumber,
            existingRefundId: duplicateRefundId,
          })
        }
      }

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            duplicate: true,
            duplicates,
            message: `${duplicates.length}건의 중복 가능성이 있는 환불 요청이 발견되었습니다.`,
          },
          { status: 409 },
        )
      }
    }

    const createdIds: string[] = []
    const failedItems: { index: number; reason: string }[] = []

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      try {
        // Validate item fields
        if (!item.refundDate || !item.vehicleNumber || !item.claimAmount || !item.refundReason) {
          throw new Error("필수 항목이 누락되었습니다.")
        }

        if (header.refundMethod === "card" || header.refundMethod === "offset") {
          if (!item.receiptDate) {
            throw new Error("카드/상계 환불 시 성능완료일이 필요합니다.")
          }
        }

        if (!item.receiptPhotos || item.receiptPhotos.length === 0) {
          throw new Error("최소 1장의 영수증 사진이 필요합니다.")
        }

        // Create refund request
        const refundId = `refund_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
        const refund: RefundRequest = {
          id: refundId,
          type: "single",
          status: "pending",
          submittedAt: new Date().toISOString(),
          submittedBy: user.username,
          submittedByName: user.name,
          submittedByBranch: user.branchName,
          insuranceProvider: header.insuranceProvider,
          insuranceProviderEtc: header.insuranceProviderEtc,
          companyName: header.companyName,
          dealerName: header.dealerName,
          managerName: header.managerName,
          refundMethod: header.refundMethod,
          bankName: header.bankName,
          accountNumber: header.accountNumber,
          accountHolder: header.accountHolder,
          offsetReason: header.offsetReason, // Include offset reason from header
          refundDate: item.refundDate,
          vehicleNumber: item.vehicleNumber,
          vin: item.vin,
          claimAmount: item.claimAmount,
          refundReason: item.refundReason,
          receiptDate: item.receiptDate,
          receiptPhotos: item.receiptPhotos,
        }

        await redis.set(`refund:${refundId}`, refund)
        await addToIndexes(refund)

        if (user.branchName) {
          await redis.lpush(`refunds:branch:${user.branchName}`, refundId)
        }

        await registerDuplicateKey(
          refundId,
          refund.vehicleNumber || "",
          refund.companyName,
          refund.refundMethod || "",
          refund.claimAmount || 0,
        )

        createdIds.push(refundId)
        console.log(`[v0] Batch refund item ${i + 1} created: ${refundId}`)
      } catch (error) {
        console.error(`[v0] Batch refund item ${i + 1} failed:`, error)
        failedItems.push({
          index: i,
          reason: error instanceof Error ? error.message : "알 수 없는 오류",
        })
      }
    }

    if (failedItems.length > 0) {
      for (const refundId of createdIds) {
        await redis.del(`refund:${refundId}`)
        await removeFromAllIndexes(refundId)
        if (user.branchName) {
          await redis.lrem(`refunds:branch:${user.branchName}`, 0, refundId)
        }
      }

      return NextResponse.json(
        {
          error: "일부 항목 처리에 실패하여 전체 작업이 취소되었습니다.",
          failedItems,
        },
        { status: 400 },
      )
    }

    console.log(`[v0] Batch refund completed: ${createdIds.length} items created by ${user.username}`)

    return NextResponse.json({
      success: true,
      createdCount: createdIds.length,
      createdIds,
    })
  } catch (error) {
    console.error("[v0] Batch refund error:", error)
    return NextResponse.json({ error: "일괄 환불 청구 생성에 실패했습니다." }, { status: 500 })
  }
}
