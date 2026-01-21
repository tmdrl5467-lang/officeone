import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { WorkLog, User } from "@/lib/types"
import { getWorklogIdsExcludingBranch } from "@/lib/worklog-index"

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

    // Only middle managers can access this endpoint
    if (user.role !== "MIDDLE_MANAGER") {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from")
    const toDate = searchParams.get("to")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20")

    // Get worklogs excluding 장한평 branch
    const { ids: worklogIds, totalCount } = await getWorklogIdsExcludingBranch(
      "장한평",
      fromDate || undefined,
      toDate || undefined,
      page,
      pageSize,
    )

    if (!Array.isArray(worklogIds) || worklogIds.length === 0) {
      return NextResponse.json({
        worklogs: [],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 0,
      })
    }

    // Fetch worklog data using pipeline
    const pipeline = redis.pipeline()
    worklogIds.forEach((id) => pipeline.get(`worklog:${id}`))
    const worklogResults = await pipeline.exec()

    const worklogs: WorkLog[] = []
    for (const result of worklogResults) {
      if (result && typeof result === "object") {
        worklogs.push(result as WorkLog)
      }
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    console.log(
      `[v0] MIDDLE_MANAGER retrieved ${worklogs.length} worklogs (excluding 장한평, page ${page}/${totalPages}, total ${totalCount})`,
    )

    return NextResponse.json({
      worklogs,
      totalCount,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error("[v0] Get middle manager worklogs error:", error)
    return NextResponse.json({ error: "근무일지 목록 조회에 실패했습니다." }, { status: 500 })
  }
}
