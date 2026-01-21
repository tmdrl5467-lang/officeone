import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: refundId } = await params

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

    // Only BRANCH users can acknowledge
    if (user.role !== "BRANCH") {
      return NextResponse.json({ error: "성능장 사용자만 확인할 수 있습니다." }, { status: 403 })
    }

    // Get refund
    const refund = await redis.get<RefundRequest>(`refund:${refundId}`)
    if (!refund) {
      return NextResponse.json({ error: "환불 청구를 찾을 수 없습니다." }, { status: 404 })
    }

    // Check if user is authorized for this refund
    if (refund.submittedBy !== user.username && refund.submittedByBranch !== user.branchName) {
      return NextResponse.json({ error: "이 환불 청구에 접근할 권한이 없습니다." }, { status: 403 })
    }

    // Only allow acknowledgment for rejected refunds
    if (refund.status !== "rejected") {
      return NextResponse.json({ error: "거부된 환불 청구만 확인할 수 있습니다." }, { status: 400 })
    }

    // If already acknowledged, return existing data (idempotent)
    if (refund.acknowledgedAt) {
      return NextResponse.json({
        success: true,
        alreadyAcknowledged: true,
        acknowledgedAt: refund.acknowledgedAt,
        acknowledgedBy: refund.acknowledgedBy,
      })
    }

    // Update refund with acknowledgment
    const now = new Date().toISOString()
    const updatedRefund: RefundRequest = {
      ...refund,
      acknowledgedAt: now,
      acknowledgedBy: user.username,
    }

    await redis.set(`refund:${refundId}`, updatedRefund)

    console.log(`[v0] Refund ${refundId} acknowledged by ${user.username} at ${now}`)

    return NextResponse.json({
      success: true,
      acknowledgedAt: now,
      acknowledgedBy: user.username,
    })
  } catch (error) {
    console.error("[v0] Acknowledge refund error:", error)
    return NextResponse.json({ error: "확인 처리에 실패했습니다." }, { status: 500 })
  }
}
