import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { WorkLog, User } from "@/lib/types"
import JSZip from "jszip"

function sanitizeBranchName(branchName: string | undefined): string {
  if (!branchName) return "unknown-branch"

  // Remove special characters, replace spaces with underscore, limit length
  return (
    branchName
      .trim()
      .replace(/[/\\:*?"<>|]/g, "") // Remove invalid file system characters
      .replace(/\s+/g, "_") // Replace spaces with underscore
      .slice(0, 50) || // Limit length
    "unknown-branch"
  )
}

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

    // Only COMMANDER can download worklog images ZIP
    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from")
    const toDate = searchParams.get("to")

    console.log("[v0] Worklog images ZIP download filters:", { fromDate, toDate })

    // Get all worklog IDs
    const worklogIds = (await redis.lrange("worklogs:index", 0, -1)) as string[]

    if (worklogIds.length === 0) {
      return NextResponse.json({ error: "근무일지 데이터가 없습니다." }, { status: 404 })
    }

    // Fetch all worklogs
    const worklogs: WorkLog[] = []
    for (const id of worklogIds) {
      const worklogData = await redis.get<WorkLog>(`worklog:${id}`)
      if (worklogData) {
        worklogs.push(worklogData)
      }
    }

    // Apply date filters (same logic as GET /api/worklogs)
    let filteredWorklogs = worklogs

    if (fromDate || toDate) {
      filteredWorklogs = worklogs.filter((worklog) => {
        const worklogDate = worklog.date // YYYY-MM-DD format
        if (!worklogDate) return false

        if (fromDate && worklogDate < fromDate) return false
        if (toDate && worklogDate > toDate) return false

        return true
      })
    }

    console.log(`[v0] Found ${filteredWorklogs.length} worklogs (filtered from ${worklogs.length})`)

    // Enforce limit to prevent excessive load
    const MAX_WORKLOGS = 200
    const MAX_IMAGES = 1000

    if (filteredWorklogs.length > MAX_WORKLOGS) {
      return NextResponse.json(
        {
          error: `최대 ${MAX_WORKLOGS}건까지만 다운로드 가능합니다. 필터를 좁혀주세요. (현재: ${filteredWorklogs.length}건)`,
        },
        { status: 400 },
      )
    }

    // Count total images
    let totalImageCount = 0
    for (const worklog of filteredWorklogs) {
      const photoCount = Array.isArray(worklog.photoUrls) ? worklog.photoUrls.length : 0
      const pasteCount = Array.isArray(worklog.worklogPasteImageUrls) ? worklog.worklogPasteImageUrls.length : 0
      totalImageCount += photoCount + pasteCount
    }

    if (totalImageCount > MAX_IMAGES) {
      return NextResponse.json(
        {
          error: `최대 ${MAX_IMAGES}장까지만 다운로드 가능합니다. 필터를 좁혀주세요. (현재: ${totalImageCount}장)`,
        },
        { status: 400 },
      )
    }

    if (totalImageCount === 0) {
      return NextResponse.json({ error: "다운로드할 이미지가 없습니다." }, { status: 404 })
    }

    const zip = new JSZip()
    const failures: string[] = []
    let successCount = 0

    for (const worklog of filteredWorklogs) {
      const allImageUrls: { url: string; type: string }[] = []

      // Collect uploaded photos
      if (worklog.photoUrls && Array.isArray(worklog.photoUrls) && worklog.photoUrls.length > 0) {
        allImageUrls.push(...worklog.photoUrls.map((url) => ({ url, type: "photo" })))
      }

      // Collect paste images
      if (worklog.worklogPasteImageUrls && Array.isArray(worklog.worklogPasteImageUrls) && worklog.worklogPasteImageUrls.length > 0) {
        allImageUrls.push(...worklog.worklogPasteImageUrls.map((url) => ({ url, type: "paste" })))
      }

      if (allImageUrls.length === 0) continue

      const branchNameSlug = sanitizeBranchName(worklog.branchId)
      const worklogFolderName = `worklog_${worklog.date}_${worklog.authorName}_${worklog.id.slice(-8)}`
      const fullFolderPath = `${branchNameSlug}/${worklogFolderName}`

      for (let i = 0; i < allImageUrls.length; i++) {
        const { url, type } = allImageUrls[i]

        try {
          const response = await fetch(url)
          if (!response.ok) {
            failures.push(`${url} - HTTP ${response.status}`)
            continue
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Extract extension from URL
          const urlParts = url.split(".")
          const ext = urlParts[urlParts.length - 1].split("?")[0] || "jpg"

          // File naming: photo_1.jpg or paste_1.png
          const prefix = type === "paste" ? "paste" : "photo"
          const fileName = `${prefix}_${i + 1}.${ext}`

          zip.file(`${fullFolderPath}/${fileName}`, buffer)
          successCount++
        } catch (error) {
          console.error(`[v0] Failed to fetch ${url}:`, error)
          failures.push(`${url} - ${error}`)
        }
      }
    }

    if (failures.length > 0) {
      const failuresText = failures.join("\n")
      zip.file("failures.txt", failuresText)
      console.log(`[v0] ${failures.length} images failed to download`)
    }

    if (successCount === 0) {
      return NextResponse.json({ error: "이미지 다운로드에 실패했습니다." }, { status: 500 })
    }

    console.log(`[v0] Creating ZIP with ${successCount}/${totalImageCount} images`)

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    const today = new Date().toISOString().split("T")[0]
    const dateRange = fromDate && toDate ? `${fromDate}_${toDate}` : fromDate || toDate || "all"
    const fileName = `worklog_images_${dateRange}_${today}.zip`

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("[v0] Worklog images ZIP download error:", error)
    return NextResponse.json({ error: "ZIP 파일 생성에 실패했습니다." }, { status: 500 })
  }
}
