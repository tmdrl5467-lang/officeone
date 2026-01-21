import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import ExcelJS from "exceljs"

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

    // Only COMMANDER and STAFF can export
    if (user.role !== "COMMANDER" && user.role !== "STAFF") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from")
    const toDate = searchParams.get("to")
    const submitter = searchParams.get("submitter")
    const companyName = searchParams.get("companyName")

    // Fetch all refunds using Redis Pipeline
    const refundIds = (await redis.lrange("refunds:index", 0, -1)) as string[]
    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = await pipeline.exec()

    const refunds: RefundRequest[] = results.filter((result): result is RefundRequest => result !== null)

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

    // Sort by submission date (newest first)
    filteredRefunds.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    console.log(`[v0] Exporting ${filteredRefunds.length} refunds (filtered from ${refunds.length} total)`)

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("환불건")

    // Define columns
    worksheet.columns = [
      { header: "청구ID", key: "id", width: 20 },
      { header: "유형", key: "type", width: 10 },
      { header: "상태", key: "status", width: 10 },
      { header: "제출자", key: "submitter", width: 15 },
      { header: "성능장", key: "branch", width: 15 },
      { header: "환불신청일자", key: "refundDate", width: 15 },
      { header: "차량번호", key: "vehicleNumber", width: 15 },
      { header: "차대번호", key: "vin", width: 20 },
      { header: "보험사", key: "insuranceProvider", width: 15 },
      { header: "상사명", key: "companyName", width: 15 },
      { header: "딜러명", key: "dealerName", width: 15 },
      { header: "환불수단", key: "refundMethod", width: 12 },
      { header: "총환불금액", key: "claimAmount", width: 15 },
      { header: "환불사유", key: "refundReason", width: 20 },
      { header: "은행명", key: "bankName", width: 15 },
      { header: "계좌번호", key: "accountNumber", width: 20 },
      { header: "예금주", key: "accountHolder", width: 15 },
      { header: "환불일자", key: "receiptDate", width: 15 },
      { header: "제출일시", key: "submittedAt", width: 20 },
      { header: "처리일시", key: "processedAt", width: 20 },
      { header: "처리메모", key: "notes", width: 30 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    // Add data rows
    filteredRefunds.forEach((refund) => {
      worksheet.addRow({
        id: refund.id,
        type: refund.type === "single" ? "단건" : refund.type === "bulk" ? "일괄" : "묶음",
        status: refund.status === "pending" ? "대기중" : refund.status === "approved" ? "승인됨" : "거부됨",
        submitter: refund.submittedByName || refund.submittedBy,
        branch: refund.submittedByBranch || "",
        refundDate: refund.refundDate || "",
        vehicleNumber: refund.vehicleNumber || "",
        vin: refund.vin || "",
        insuranceProvider:
          refund.insuranceProvider === "기타(직접입력)"
            ? refund.insuranceProviderEtc || ""
            : refund.insuranceProvider || "",
        companyName: refund.companyName || refund.insuranceCompany || "",
        dealerName: refund.dealerName || "",
        refundMethod:
          refund.refundMethod === "card"
            ? "카드"
            : refund.refundMethod === "account"
              ? "계좌"
              : refund.refundMethod === "offset"
                ? "상계"
                : "",
        claimAmount: refund.claimAmount || "",
        refundReason: refund.refundReason || "",
        bankName: refund.bankName || "",
        accountNumber: refund.accountNumber || "",
        accountHolder: refund.accountHolder || "",
        receiptDate: refund.receiptDate || "",
        submittedAt: new Date(refund.submittedAt).toLocaleString("ko-KR"),
        processedAt: refund.processedAt ? new Date(refund.processedAt).toLocaleString("ko-KR") : "",
        notes: refund.notes || "",
      })
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    const today = new Date().toISOString().split("T")[0]
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="refunds_${today}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("[v0] Export refunds error:", error)
    return NextResponse.json({ error: "엑셀 다운로드에 실패했습니다." }, { status: 500 })
  }
}
