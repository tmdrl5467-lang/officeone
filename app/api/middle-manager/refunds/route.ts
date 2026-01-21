import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import { getRefundIdsExcludingBranch } from "@/lib/refund-index"
import { checkDuplicatesForList } from "@/lib/duplicate-check"

export async function GET(request: NextRequest) {
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

    // Only middle managers can access
    if (user.role !== "MIDDLE_MANAGER") {
      return NextResponse.json({ error: "중간관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from") || undefined
    const toDate = searchParams.get("to") || undefined
    const submitter = searchParams.get("submitter") || undefined
    const companyName = searchParams.get("companyName") || undefined
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20")
    const status = searchParams.get("status") || undefined

    const { ids: refundIds, totalCount } = await getRefundIdsExcludingBranch(
      "장한평",
      status,
      fromDate,
      toDate,
      submitter,
      companyName,
      page,
      pageSize,
    )

    if (refundIds.length === 0) {
      return NextResponse.json({
        refunds: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      })
    }

    // Fetch refunds using pipeline
    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    const refunds: RefundRequest[] = results.filter((result): result is RefundRequest => result !== null)

    // Check for duplicates
    const refundsWithDuplicateInfo = await checkDuplicatesForList(refunds)

    const totalPages = Math.ceil(totalCount / pageSize)

    console.log(
      `[v0] MIDDLE_MANAGER ${user.username} retrieved ${refundsWithDuplicateInfo.length} refunds (excluding 장한평, page ${page}/${totalPages}, total ${totalCount})`,
    )

    return NextResponse.json({
      refunds: refundsWithDuplicateInfo,
      totalCount,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error("[v0] Get middle manager refunds error:", error)
    return NextResponse.json({ error: "환불 목록 조회에 실패했습니다." }, { status: 500 })
  }
}
