import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"

export async function GET(request: NextRequest) {
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

    // Only COMMANDER and STAFF can view stats
    if (user.role !== "COMMANDER" && user.role !== "STAFF") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    // Get all refunds
    const refundIdsRaw = await redis.lrange("refunds:index", 0, -1)
    const refundIds = Array.isArray(refundIdsRaw) ? refundIdsRaw : []

    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = await pipeline.exec()

    const refunds: RefundRequest[] = results.filter((result): result is RefundRequest => result !== null)

    // Calculate stats
    const pendingCount = refunds.filter((r) => r.status === "pending").length
    const approvedCount = refunds.filter((r) => r.status === "approved").length
    const rejectedCount = refunds.filter((r) => r.status === "rejected").length

    // Acknowledgment stats
    const rejectedRefunds = refunds.filter((r) => r.status === "rejected")
    const pendingAckCount = rejectedRefunds.filter((r) => !r.acknowledgedAt).length
    const acknowledgedCount = rejectedRefunds.filter((r) => r.acknowledgedAt).length

    return NextResponse.json({
      totalCount: refunds.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      pendingAckCount,
      acknowledgedCount,
    })
  } catch (error) {
    console.error("[v0] Get dashboard stats error:", error)
    return NextResponse.json({ error: "통계 조회에 실패했습니다." }, { status: 500 })
  }
}
