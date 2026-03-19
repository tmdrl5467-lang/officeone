import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { redis } from "@/lib/kv"
import { del } from "@vercel/blob"
import { removeFromAllIndexes } from "@/lib/refund-index"
import { removeDuplicateKey } from "@/lib/duplicate-check"
import type { User, RefundRequest } from "@/lib/types"

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

    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const body = await request.json()
    const { fromDate, toDate } = body

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "시작일과 종료일을 지정해주세요." }, { status: 400 })
    }

    // 전체 환불건 ID 가져오기
    const refundIds = (await redis.lrange("refunds:index", 0, -1)) as string[]
    
    if (refundIds.length === 0) {
      return NextResponse.json({ error: "삭제할 환불건이 없습니다." }, { status: 404 })
    }

    // 환불건 데이터 가져오기
    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = await pipeline.exec()

    const refunds = (results as (RefundRequest | null)[])
      .filter((r): r is RefundRequest => r !== null)

    // 날짜 필터링
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)

    const filteredRefunds = refunds.filter((refund) => {
      const submittedAt = new Date(refund.submittedAt)
      return submittedAt >= from && submittedAt <= to
    })

    if (filteredRefunds.length === 0) {
      return NextResponse.json({ error: "해당 기간에 삭제할 환불건이 없습니다." }, { status: 404 })
    }

    let deletedCount = 0
    let deletedPhotosCount = 0
    let failedCount = 0

    for (const refund of filteredRefunds) {
      try {
        // 사진 삭제
        const photoUrls: string[] = []
        if (refund.receiptPhotos) photoUrls.push(...refund.receiptPhotos)
        if (refund.bundledPhotos) photoUrls.push(...refund.bundledPhotos)
        if (refund.excelFile) photoUrls.push(refund.excelFile)

        for (const url of photoUrls) {
          try {
            await del(url)
            deletedPhotosCount++
          } catch {
            // 사진 삭제 실패해도 계속 진행
          }
        }

        // Redis에서 환불건 삭제
        await redis.del(`refund:${refund.id}`)
        await removeFromAllIndexes(refund.id)

        if (refund.submittedByBranch) {
          await redis.lrem(`refunds:branch:${refund.submittedByBranch}`, 0, refund.id)
        }

        // 중복키 삭제 시도 (실패해도 진행)
        try {
          await removeDuplicateKey(
            refund.vehicleNumber || "",
            refund.companyName,
            refund.refundMethod || "",
            refund.claimAmount || 0,
          )
        } catch {
          // 중복키 삭제 실패는 무시
        }

        deletedCount++
      } catch {
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${deletedCount}건의 환불이 삭제되었습니다.`,
      deletedCount,
      deletedPhotosCount,
      failedCount,
    })
  } catch (error) {
    console.error("[v0] Bulk delete error:", error)
    return NextResponse.json({ error: "일괄 삭제에 실패했습니다." }, { status: 500 })
  }
}
