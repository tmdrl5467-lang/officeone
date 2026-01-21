import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import { getRefundScore, updateStatusIndexes } from "@/lib/refund-index"

export async function POST(request: NextRequest) {
  try {
    // Check authentication
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

    // Parse request body
    const { refundId, action, notes } = await request.json()

    if (!refundId || !action) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 })
    }

    const refund = await redis.get<RefundRequest>(`refund:${refundId}`)
    if (!refund) {
      return NextResponse.json({ error: "환불 청구를 찾을 수 없습니다." }, { status: 404 })
    }

    const oldStatus = refund.status
    const newStatus = action === "approve" ? "approved" : "rejected"
    const shouldSetApprovedAt = action === "approve" && refund.status !== "approved"

    const updatedRefund: RefundRequest = {
      ...refund,
      status: newStatus,
      processedAt: new Date().toISOString(),
      processedBy: user.username,
      approvedAt: shouldSetApprovedAt ? new Date().toISOString() : refund.approvedAt,
      notes: notes || refund.notes,
    }

    await redis.set(`refund:${refundId}`, updatedRefund)

    const score = getRefundScore(updatedRefund)
    await updateStatusIndexes(refundId, oldStatus, newStatus, score)

    console.log(`[v0] Refund ${refundId} ${action}d by ${user.username}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Refund action error:", error)
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
