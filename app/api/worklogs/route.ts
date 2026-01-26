import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { WorkLog, User } from "@/lib/types"
import { del } from "@vercel/blob"

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

    // Parse request body
    const body = await request.json()

    // Create work log
    const worklogId = `worklog_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const worklog: WorkLog = {
      id: worklogId,
      date: body.date,
      authorRole: user.role,
      authorId: user.username,
      authorName: user.name,
      branchId: user.branchName,
      note: body.note,
      photoUrls: body.photoUrls || [],
      worklogPasteImageUrls: body.worklogPasteImageUrls || undefined,
      createdAt: new Date().toISOString(),
      status: "pending",
    }

    await redis.set(`worklog:${worklogId}`, worklog)
    await redis.lpush("worklogs:index", worklogId)

    // If user has a branch, also add to branch-specific list
    if (user.branchName) {
      await redis.lpush(`worklogs:branch:${user.branchName}`, worklogId)
    }

    return NextResponse.json({ success: true, worklogId })
  } catch (error) {
    console.error("[v0] Create worklog error:", error)
    return NextResponse.json({ error: "근무일지 작성에 실패했습니다." }, { status: 500 })
  }
}

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

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from") // YYYY-MM-DD
    const toDate = searchParams.get("to") // YYYY-MM-DD
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20")

    const indexKey = user.role === "BRANCH" && user.branchName ? `worklogs:branch:${user.branchName}` : "worklogs:index"

    let worklogIds: string[] = []
    let totalCount = 0

    if (!fromDate && !toDate) {
      totalCount = (await redis.llen(indexKey)) || 0
      const start = (page - 1) * pageSize
      const end = start + pageSize - 1
      worklogIds = (await redis.lrange(indexKey, start, end)) as string[]
    } else {
      // Window-based filtering with proper pagination
      const windowSize = 250
      const maxWindows = 10
      const allMatchedIds: string[] = []
      let currentWindow = 0

      // Collect ALL matching IDs first, then paginate
      while (currentWindow < maxWindows) {
        const windowStart = currentWindow * windowSize
        const windowEnd = windowStart + windowSize - 1

        const windowIds = (await redis.lrange(indexKey, windowStart, windowEnd)) as string[]

        if (!windowIds || windowIds.length === 0) break

        const pipeline = redis.pipeline()
        windowIds.forEach((id) => pipeline.get(`worklog:${id}`))
        const results = (await pipeline.exec()) as (WorkLog | null)[]

        const filtered = results.filter((worklog): worklog is WorkLog => {
          if (!worklog) return false
          const worklogDate = worklog.date
          if (!worklogDate) return false

          if (fromDate && worklogDate < fromDate) return false
          if (toDate && worklogDate > toDate) return false

          return true
        })

        allMatchedIds.push(...filtered.map((w) => w.id))

        // If we got fewer IDs than window size, we've reached the end
        if (windowIds.length < windowSize) break

        currentWindow++
      }

      // Apply pagination after collecting all matched IDs
      totalCount = allMatchedIds.length
      const pageStart = (page - 1) * pageSize
      const pageEnd = pageStart + pageSize
      worklogIds = allMatchedIds.slice(pageStart, pageEnd)
    }

    if (!Array.isArray(worklogIds) || worklogIds.length === 0) {
      return NextResponse.json({
        worklogs: [],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 0,
      })
    }

    const pipeline = redis.pipeline()
    for (const id of worklogIds) {
      pipeline.get(`worklog:${id}`)
    }
    const worklogResults = await pipeline.exec()

    const worklogs: WorkLog[] = []
    for (const result of worklogResults) {
      if (result && typeof result === "object") {
        worklogs.push(result as WorkLog)
      }
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({
      worklogs,
      totalCount,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error("[v0] Get worklogs error:", error)
    return NextResponse.json({ error: "근무일지 목록 조회에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const worklogId = searchParams.get("id")

    if (!worklogId) {
      return NextResponse.json({ error: "일지 ID가 필요합니다." }, { status: 400 })
    }

    const worklog = await redis.get<WorkLog>(`worklog:${worklogId}`)
    if (!worklog) {
      return NextResponse.json({ error: "해당 일지를 찾을 수 없습니다." }, { status: 404 })
    }

    if (user.role !== "COMMANDER" && worklog.authorId !== user.username) {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 })
    }

    const failedPhotos: string[] = []
    if (worklog.photoUrls && worklog.photoUrls.length > 0) {
      for (const photoUrl of worklog.photoUrls) {
        try {
          await del(photoUrl)
        } catch (error) {
          console.error(`[v0] Failed to delete photo ${photoUrl}:`, error)
          failedPhotos.push(photoUrl)
        }
      }
    }

    if (worklog.worklogPasteImageUrls && worklog.worklogPasteImageUrls.length > 0) {
      for (const imageUrl of worklog.worklogPasteImageUrls) {
        try {
          await del(imageUrl)
        } catch (error) {
          console.error(`[v0] Failed to delete paste image ${imageUrl}:`, error)
          failedPhotos.push(imageUrl)
        }
      }
    }

    await redis.del(`worklog:${worklogId}`)
    await redis.lrem("worklogs:index", 0, worklogId)

    if (worklog.branchId) {
      await redis.lrem(`worklogs:branch:${worklog.branchId}`, 0, worklogId)
    }

    return NextResponse.json({
      success: true,
      message: "근무일지가 삭제되었습니다.",
      failedPhotos: failedPhotos.length > 0 ? failedPhotos : undefined,
    })
  } catch (error) {
    console.error("[v0] Delete worklog error:", error)
    return NextResponse.json({ error: "근무일지 삭제에 실패했습니다." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const worklogId = searchParams.get("id")

    if (!worklogId) {
      return NextResponse.json({ error: "일지 ID가 필요합니다." }, { status: 400 })
    }

    const worklog = await redis.get<WorkLog>(`worklog:${worklogId}`)
    if (!worklog) {
      return NextResponse.json({ error: "해당 일지를 찾을 수 없습니다." }, { status: 404 })
    }

    const body = await request.json()
    const { note, status, commanderComment } = body

    const updatedWorklog: WorkLog = {
      ...worklog,
    }

    // Update note (anyone can update their own or commander)
    if (note !== undefined) {
      updatedWorklog.note = note || ""
    }

    if (status !== undefined) {
      if (user.role !== "COMMANDER") {
        return NextResponse.json({ error: "상태 변경 권한이 없습니다." }, { status: 403 })
      }
      if (!["pending", "approved", "rejected"].includes(status)) {
        return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 })
      }
      updatedWorklog.status = status
      updatedWorklog.statusUpdatedAt = new Date().toISOString()
    }

    if (commanderComment !== undefined) {
      if (user.role !== "COMMANDER") {
        return NextResponse.json({ error: "답변 작성 권한이 없습니다." }, { status: 403 })
      }
      updatedWorklog.commanderComment = commanderComment
      updatedWorklog.commanderCommentAt = new Date().toISOString()
    }

    await redis.set(`worklog:${worklogId}`, updatedWorklog)

    return NextResponse.json({ success: true, worklog: updatedWorklog })
  } catch (error) {
    console.error("[v0] Update worklog error:", error)
    return NextResponse.json({ error: "근무일지 수정에 실패했습니다." }, { status: 500 })
  }
}
