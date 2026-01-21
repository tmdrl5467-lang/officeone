import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User, StatusChangeLog } from "@/lib/types"
import { getRefundScore, updateStatusIndexes } from "@/lib/refund-index"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    // Parse request body
    const { toStatus, reason } = await request.json()

    // Validate input
    if (!toStatus || !reason) {
      return NextResponse.json({ error: "상태와 사유를 입력해주세요." }, { status: 400 })
    }

    if (!["pending", "approved", "rejected"].includes(toStatus)) {
      return NextResponse.json({ error: "올바르지 않은 상태입니다." }, { status: 400 })
    }

    if (reason.length < 3) {
      return NextResponse.json({ error: "사유는 최소 3자 이상 입력해주세요." }, { status: 400 })
    }

    // Get current refund
    const refund = await redis.get<RefundRequest>(`refund:${refundId}`)
    if (!refund) {
      return NextResponse.json({ error: "환불 청구를 찾을 수 없습니다." }, { status: 404 })
    }

    const fromStatus = refund.status

    // Check if status is actually changing
    if (fromStatus === toStatus) {
      return NextResponse.json({ error: "현재 상태와 동일합니다." }, { status: 400 })
    }

    const now = new Date().toISOString()

    const logId = `statuslog_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const statusLog: StatusChangeLog = {
      id: logId,
      refundId,
      changedBy: user.username,
      changedByName: user.name,
      changedAt: now,
      fromStatus,
      toStatus,
      reason,
    }

    // Save audit log
    await redis.set(`status-log:${refundId}:${now}`, statusLog)
    await redis.lpush(`status-logs:${refundId}`, logId)

    const updatedRefund: RefundRequest = {
      ...refund,
      status: toStatus,
      processedAt: now,
      processedBy: user.username,
      // Set approvedAt if changing to approved
      approvedAt: toStatus === "approved" ? now : refund.approvedAt,
      // Clear acknowledgedAt if status changes from rejected
      acknowledgedAt: fromStatus === "rejected" && toStatus !== "rejected" ? undefined : refund.acknowledgedAt,
      acknowledgedBy: fromStatus === "rejected" && toStatus !== "rejected" ? undefined : refund.acknowledgedBy,
      updatedAt: now,
      updatedBy: user.username,
    }

    await redis.set(`refund:${refundId}`, updatedRefund)

    const score = getRefundScore(updatedRefund)
    await updateStatusIndexes(refundId, fromStatus, toStatus, score)

    console.log(`[v0] Status changed: ${refundId} from ${fromStatus} to ${toStatus} by ${user.username} (${user.name})`)

    return NextResponse.json({ success: true, refund: updatedRefund })
  } catch (error) {
    console.error("[v0] Change status error:", error)
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
