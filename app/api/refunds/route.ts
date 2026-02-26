import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import { del } from "@vercel/blob"
import { addToIndexes, removeFromAllIndexes, getRefundIdsFromIndex, getRefundIdsWithFilters } from "@/lib/refund-index"
import {
  checkDuplicateRefund,
  registerDuplicateKey,
  removeDuplicateKey,
  checkDuplicatesForList,
} from "@/lib/duplicate-check"

export async function POST(request: NextRequest) {
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

    const body = await request.json()

    const forceCreate = body.forceCreate === true

    if (body.type === "single") {
      if (!body.companyName?.trim()) {
        return NextResponse.json({ error: "상사명은 필수 입력 항목입니다." }, { status: 400 })
      }
      if (!body.dealerName?.trim()) {
        return NextResponse.json({ error: "딜러명은 필수 입력 항목입니다." }, { status: 400 })
      }
      if (!body.managerName?.trim()) {
        return NextResponse.json({ error: "담당자 이름은 필수 입력 항목입니다." }, { status: 400 })
      }
    }

    if (body.refundMethod === "offset" && !body.offsetReason?.trim()) {
      return NextResponse.json({ error: "상계 환불 시 상계 사유가 필요합니다." }, { status: 400 })
    }

    if (!forceCreate) {
      const duplicateRefundId = await checkDuplicateRefund(
        body.vehicleNumber,
        body.companyName,
        body.refundMethod,
        Number(body.claimAmount),
      )

      if (duplicateRefundId) {
        return NextResponse.json(
          {
            duplicate: true,
            existingRefundId: duplicateRefundId,
            message: "동일한 차량번호·상사·환불수단·금액으로 이미 환불 요청이 존재합니다.",
          },
          { status: 409 },
        )
      }
    }

    const refundId = `refund_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const refund: RefundRequest = {
      id: refundId,
      type: body.type,
      status: "pending",
      submittedAt: new Date().toISOString(),
      submittedBy: user.username,
      submittedByName: user.name,
      submittedByBranch: user.branchName,
      ...body,
    }

    await redis.set(`refund:${refundId}`, refund)
    await addToIndexes(refund)

    if (user.branchName) {
      await redis.lpush(`refunds:branch:${user.branchName}`, refundId)
    }

    await registerDuplicateKey(
      refundId,
      refund.vehicleNumber || "",
      refund.companyName,
      refund.refundMethod || "",
      refund.claimAmount || 0,
    )

    console.log(`[v0] Refund created: ${refundId} by ${user.username} (${user.name})`)

    return NextResponse.json({ success: true, refundId })
  } catch (error) {
    console.error("[v0] Create refund error:", error)
    return NextResponse.json({ error: "환불 청구 생성에 실패했습니다." }, { status: 500 })
  }
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

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from")
    const toDate = searchParams.get("to")
    const submitter = searchParams.get("submitter")
    const companyName = searchParams.get("companyName")
    const vehicleNumber = searchParams.get("vehicleNumber")
    const refundMethod = searchParams.get("refundMethod")
    const refundReason = searchParams.get("refundReason")
    const minAmount = searchParams.get("minAmount") ? Number(searchParams.get("minAmount")) : undefined
    const maxAmount = searchParams.get("maxAmount") ? Number(searchParams.get("maxAmount")) : undefined
    const acknowledged = searchParams.get("acknowledged")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20")
    const status = searchParams.get("status")

    let refundIds: string[] = []
    let totalCount = 0

    const hasFilters = fromDate || toDate || submitter || companyName || vehicleNumber || (refundMethod && refundMethod !== "all") || (refundReason && refundReason !== "all") || minAmount !== undefined || maxAmount !== undefined || (acknowledged && acknowledged !== "all")

    if (hasFilters) {
      const result = await getRefundIdsWithFilters(status, fromDate, toDate, submitter, companyName, page, pageSize, vehicleNumber || undefined, refundMethod || undefined, refundReason || undefined, minAmount, maxAmount, acknowledged || undefined)
      refundIds = result.ids
      totalCount = result.totalCount
    } else {
      const result = await getRefundIdsFromIndex(status || undefined, page, pageSize)
      refundIds = result.ids
      totalCount = result.totalCount
    }

    if (refundIds.length === 0) {
      return NextResponse.json({
        refunds: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      })
    }

    const pipeline = redis.pipeline()
    refundIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    const refunds: RefundRequest[] = results.filter((result): result is RefundRequest => result !== null)

    const refundsWithDuplicateInfo = await checkDuplicatesForList(refunds)

    const totalPages = Math.ceil(totalCount / pageSize)

    console.log(
      `[v0] Retrieved ${refundsWithDuplicateInfo.length} refunds (page ${page}/${totalPages}, total ${totalCount})`,
    )

    return NextResponse.json({
      refunds: refundsWithDuplicateInfo,
      totalCount,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error("[v0] Get refunds error:", error)
    return NextResponse.json({ error: "환불 목록 조회에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const refundId = searchParams.get("id")

    if (!refundId) {
      return NextResponse.json({ error: "환불 ID가 필요합니다." }, { status: 400 })
    }

    const refund = await redis.get<RefundRequest>(`refund:${refundId}`)
    if (!refund) {
      return NextResponse.json({ error: "환불 청구를 찾을 수 없습니다." }, { status: 404 })
    }

    const photoUrls: string[] = []
    if (refund.receiptPhotos) photoUrls.push(...refund.receiptPhotos)
    if (refund.bundledPhotos) photoUrls.push(...refund.bundledPhotos)
    if (refund.excelFile) photoUrls.push(refund.excelFile)

    const deletedPhotos: string[] = []
    const failedPhotos: string[] = []

    for (const url of photoUrls) {
      try {
        await del(url)
        deletedPhotos.push(url)
        console.log(`[v0] Deleted blob: ${url}`)
      } catch (error) {
        console.error(`[v0] Failed to delete blob ${url}:`, error)
        failedPhotos.push(url)
      }
    }

    await redis.del(`refund:${refundId}`)

    await removeFromAllIndexes(refundId)

    if (refund.submittedByBranch) {
      await redis.lrem(`refunds:branch:${refund.submittedByBranch}`, 0, refundId)
    }

    await removeDuplicateKey(
      refund.vehicleNumber || "",
      refund.companyName,
      refund.refundMethod || "",
      refund.claimAmount || 0,
    )

    console.log(
      `[v0] Refund ${refundId} deleted by ${user.username}. Photos: ${deletedPhotos.length} deleted, ${failedPhotos.length} failed`,
    )

    return NextResponse.json({
      success: true,
      message: "환불이 삭제되었습니다.",
      deletedPhotos: deletedPhotos.length,
      failedPhotos: failedPhotos.length,
    })
  } catch (error) {
    console.error("[v0] Delete refund error:", error)
    return NextResponse.json({ error: "환불 삭제에 실패했습니다." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    if (user.role !== "COMMANDER") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const refundId = searchParams.get("id")

    if (!refundId) {
      return NextResponse.json({ error: "환불 ID가 필요합니다." }, { status: 400 })
    }

    const existingRefund = await redis.get<RefundRequest>(`refund:${refundId}`)
    if (!existingRefund) {
      return NextResponse.json({ error: "환불 청구를 찾을 수 없습니다." }, { status: 404 })
    }

    const updates = await request.json()

    if (updates.refundMethod === "account") {
      if (!updates.bankName || !updates.accountNumber || !updates.accountHolder) {
        return NextResponse.json({ error: "계좌 환불 시 은행명, 계좌번호, 예금주가 필요합니다." }, { status: 400 })
      }
    }

    if (updates.refundMethod === "card" || updates.refundMethod === "offset") {
      if (!updates.receiptDate) {
        return NextResponse.json({ error: "카드/상계 환불 시 환불일자가 필요합니다." }, { status: 400 })
      }
    }

    if (updates.claimAmount !== undefined && isNaN(Number(updates.claimAmount))) {
      return NextResponse.json({ error: "총환불금액은 숫자여야 합니다." }, { status: 400 })
    }

    const updatedRefund: RefundRequest = {
      ...existingRefund,
      ...updates,
      claimAmount: updates.claimAmount ? Number(updates.claimAmount) : existingRefund.claimAmount,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    }

    await redis.set(`refund:${refundId}`, updatedRefund)

    console.log(`[v0] Refund ${refundId} updated by ${user.username}`)

    return NextResponse.json({
      success: true,
      message: "환불 정보가 수정되었습니다.",
      refund: updatedRefund,
    })
  } catch (error) {
    console.error("[v0] Update refund error:", error)
    return NextResponse.json({ error: "환불 수정에 실패했습니다." }, { status: 500 })
  }
}
