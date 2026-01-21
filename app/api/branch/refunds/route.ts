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

    // Only BRANCH role can access this endpoint
    if (user.role !== "BRANCH") {
      return NextResponse.json({ error: "성능장 계정만 접근 가능합니다." }, { status: 403 })
    }

    // BRANCH users must have a branchName
    if (!user.branchName) {
      return NextResponse.json({ error: "성능장 정보가 없습니다." }, { status: 400 })
    }

    // Get refund IDs for this branch
    const refundIds = (await redis.lrange(`refunds:branch:${user.branchName}`, 0, -1)) as string[]

    if (refundIds.length === 0) {
      return NextResponse.json({ refunds: [] })
    }

    const pipeline = redis.pipeline()
    for (const id of refundIds) {
      pipeline.get<RefundRequest>(`refund:${id}`)
    }
    const results = await pipeline.exec()

    const refunds: RefundRequest[] = []
    for (const result of results) {
      if (result && typeof result === "object" && "id" in result) {
        refunds.push(result as RefundRequest)
      }
    }

    // Sort by submission date (newest first)
    refunds.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    console.log(`[v0] BRANCH ${user.username} retrieved ${refunds.length} own refunds`)

    return NextResponse.json({ refunds })
  } catch (error) {
    console.error("[v0] Get branch refunds error:", error)
    return NextResponse.json({ error: "환불 목록 조회에 실패했습니다." }, { status: 500 })
  }
}
