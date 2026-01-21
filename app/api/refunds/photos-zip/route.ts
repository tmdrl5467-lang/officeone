import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import JSZip from "jszip"

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

    // Only COMMANDER can download photos ZIP
    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from")
    const toDate = searchParams.get("to")
    const submitter = searchParams.get("submitter")
    const companyName = searchParams.get("companyName")

    console.log("[v0] ZIP download filters:", { fromDate, toDate, submitter, companyName })

    const refundIds = (await redis.lrange("refunds:index", 0, -1)) as string[]

    if (refundIds.length === 0) {
      return NextResponse.json({ error: "환불 데이터가 없습니다." }, { status: 404 })
    }

    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = await pipeline.exec()

    const refunds: RefundRequest[] = results.filter((result): result is RefundRequest => result !== null)

    // Apply filters
    let filteredRefunds = refunds

    if (fromDate) {
      const fromTime = new Date(fromDate).getTime()
      filteredRefunds = filteredRefunds.filter((r) => new Date(r.submittedAt).getTime() >= fromTime)
    }

    if (toDate) {
      const toTime = new Date(toDate).setHours(23, 59, 59, 999)
      filteredRefunds = filteredRefunds.filter((r) => new Date(r.submittedAt).getTime() <= toTime)
    }

    if (submitter) {
      filteredRefunds = filteredRefunds.filter((r) => r.submittedBy === submitter)
    }

    if (companyName) {
      filteredRefunds = filteredRefunds.filter((r) =>
        (r.companyName || r.insuranceCompany || "").toLowerCase().includes(companyName.toLowerCase()),
      )
    }

    console.log(`[v0] Found ${filteredRefunds.length} refunds (filtered from ${refunds.length})`)

    const zip = new JSZip()
    const failures: string[] = []
    let totalPhotos = 0
    let successPhotos = 0
    const fileNameCounter: Record<string, number> = {}

    for (const refund of filteredRefunds) {
      const photoUrls: string[] = []
      if (refund.receiptPhotos) photoUrls.push(...refund.receiptPhotos)
      if (refund.bundledPhotos) photoUrls.push(...refund.bundledPhotos)

      if (photoUrls.length === 0) continue

      totalPhotos += photoUrls.length

      const vehicleNo = refund.vehicleNumber || "-"
      const reason = refund.refundReason || "-"
      const method = refund.refundMethod === "account" ? "계좌" : refund.refundMethod === "card" ? "카드" : "상계"
      const baseName = `${vehicleNo}(${reason})${method}`

      for (let i = 0; i < photoUrls.length; i++) {
        const url = photoUrls[i]

        try {
          const response = await fetch(url)
          if (!response.ok) {
            failures.push(`${url} - HTTP ${response.status}`)
            continue
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          const urlParts = url.split(".")
          const ext = urlParts[urlParts.length - 1].split("?")[0] || "jpg"

          let fileName = `${baseName}_${i + 1}.${ext}`

          // Handle duplicate filenames
          if (fileNameCounter[fileName]) {
            fileNameCounter[fileName]++
            fileName = `${baseName}_${i + 1}_${fileNameCounter[fileName]}.${ext}`
          } else {
            fileNameCounter[fileName] = 1
          }

          zip.file(fileName, buffer)
          successPhotos++
        } catch (error) {
          console.error(`[v0] Failed to fetch ${url}:`, error)
          failures.push(`${url} - ${error}`)
        }
      }
    }

    if (failures.length > 0) {
      const failuresText = failures.join("\n")
      zip.file("failures.txt", failuresText)
      console.log(`[v0] ${failures.length} photos failed to download`)
    }

    if (successPhotos === 0) {
      return NextResponse.json({ error: "다운로드할 사진이 없습니다." }, { status: 404 })
    }

    console.log(`[v0] Creating ZIP with ${successPhotos}/${totalPhotos} photos`)

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    const today = new Date().toISOString().split("T")[0]
    const fileName = `refund_photos_${today}.zip`

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("[v0] ZIP download error:", error)
    return NextResponse.json({ error: "ZIP 파일 생성에 실패했습니다." }, { status: 500 })
  }
}
