import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import type { RefundRequest, User } from "@/lib/types"
import { del } from "@vercel/blob"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Only BRANCH role can update their own refunds
    if (user.role !== "BRANCH") {
      return NextResponse.json({ error: "성능장 계정만 수정 가능합니다." }, { status: 403 })
    }

    // Get existing refund
    const existingRefund = await redis.get<RefundRequest>(`refund:${id}`)
    if (!existingRefund) {
      return NextResponse.json({ error: "환불 신청을 찾을 수 없습니다." }, { status: 404 })
    }

    // Check ownership - must match branchName
    if (existingRefund.submittedByBranch !== user.branchName) {
      return NextResponse.json({ error: "본인이 신청한 환불만 수정할 수 있습니다." }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()

    // Validate allowed fields only
    const {
      insuranceProvider,
      insuranceProviderEtc,
      companyName,
      dealerName,
      refundReason,
      refundMethod,
      claimAmount,
      refundDate,
      receiptDate,
      bankName,
      accountNumber,
      accountHolder,
      vin,
    } = body

    // Validate amount if provided
    if (claimAmount !== undefined) {
      const amount = Number(claimAmount)
      if (Number.isNaN(amount) || amount < 0) {
        return NextResponse.json({ error: "올바른 환불금액을 입력하세요." }, { status: 400 })
      }
    }

    // Validate method-specific required fields
    if (refundMethod === "account") {
      if (!accountNumber || !accountHolder) {
        return NextResponse.json({ error: "계좌번호와 예금주는 필수입니다." }, { status: 400 })
      }
    }

    if (refundMethod === "card" || refundMethod === "offset") {
      if (!receiptDate) {
        return NextResponse.json({ error: "환불일자는 필수입니다." }, { status: 400 })
      }
    }

    // Update only allowed fields
    const updatedRefund: RefundRequest = {
      ...existingRefund,
      insuranceProvider: insuranceProvider ?? existingRefund.insuranceProvider,
      insuranceProviderEtc: insuranceProviderEtc ?? existingRefund.insuranceProviderEtc,
      companyName: companyName ?? existingRefund.companyName,
      dealerName: dealerName ?? existingRefund.dealerName,
      refundReason: refundReason ?? existingRefund.refundReason,
      refundMethod: refundMethod ?? existingRefund.refundMethod,
      claimAmount: claimAmount !== undefined ? Number(claimAmount) : existingRefund.claimAmount,
      refundDate: refundDate ?? existingRefund.refundDate,
      vin: vin ?? existingRefund.vin,
      // Method-specific fields
      receiptDate:
        refundMethod === "card" || refundMethod === "offset" ? (receiptDate ?? existingRefund.receiptDate) : undefined,
      bankName: refundMethod === "account" ? (bankName ?? existingRefund.bankName) : undefined,
      accountNumber: refundMethod === "account" ? (accountNumber ?? existingRefund.accountNumber) : undefined,
      accountHolder: refundMethod === "account" ? (accountHolder ?? existingRefund.accountHolder) : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    }

    // Save updated refund
    await redis.set(`refund:${id}`, updatedRefund)

    console.log(`[v0] BRANCH ${user.username} updated refund ${id}`)

    return NextResponse.json({ success: true, refund: updatedRefund })
  } catch (error) {
    console.error("[v0] Update refund error:", error)
    return NextResponse.json({ error: "환불 수정에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Only BRANCH role can delete their own refunds
    if (user.role !== "BRANCH") {
      return NextResponse.json({ error: "성능장 계정만 삭제 가능합니다." }, { status: 403 })
    }

    // Get existing refund
    const existingRefund = await redis.get<RefundRequest>(`refund:${id}`)
    if (!existingRefund) {
      return NextResponse.json({ error: "환불 신청을 찾을 수 없습니다." }, { status: 404 })
    }

    // Check ownership - must match branchName
    if (existingRefund.submittedByBranch !== user.branchName) {
      return NextResponse.json({ error: "본인이 신청한 환불만 삭제할 수 있습니다." }, { status: 403 })
    }

    // Collect all photo URLs to delete from Blob
    const photoUrls: string[] = []
    if (existingRefund.receiptPhotos) {
      photoUrls.push(...existingRefund.receiptPhotos)
    }
    if (existingRefund.bundledPhotos) {
      photoUrls.push(...existingRefund.bundledPhotos)
    }
    if (existingRefund.excelFile) {
      photoUrls.push(existingRefund.excelFile)
    }

    // Delete photos from Blob
    const deletedPhotos: string[] = []
    const failedPhotos: string[] = []

    for (const url of photoUrls) {
      try {
        await del(url)
        deletedPhotos.push(url)
      } catch (error) {
        console.error(`[v0] Failed to delete blob ${url}:`, error)
        failedPhotos.push(url)
      }
    }

    // Delete from Redis
    await redis.del(`refund:${id}`)

    // Remove from branch index
    if (user.branchName) {
      await redis.lrem(`refunds:branch:${user.branchName}`, 0, id)
    }

    // Remove from global index
    await redis.lrem("refunds:index", 0, id)

    console.log(
      `[v0] BRANCH ${user.username} deleted refund ${id} (photos: ${deletedPhotos.length}, failed: ${failedPhotos.length})`,
    )

    return NextResponse.json({
      success: true,
      deletedId: id,
      deletedPhotos,
      failedPhotos,
    })
  } catch (error) {
    console.error("[v0] Delete refund error:", error)
    return NextResponse.json({ error: "환불 삭제에 실패했습니다." }, { status: 500 })
  }
}
