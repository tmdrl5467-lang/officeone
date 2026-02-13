"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { useAuth } from "./auth-provider"
import { ImageUpload } from "./image-upload"
import { Loader2, Plus, Copy, Trash2, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import type { BatchRefundHeader, BatchRefundLineItem } from "@/lib/types"

interface PhotoPreview {
  id: string
  file: File
  preview: string
}

interface LineItemWithPhotos extends Omit<BatchRefundLineItem, "receiptPhotos"> {
  photos: PhotoPreview[]
}

const REFUND_REASONS = [
  { value: "export", label: "수출" },
  { value: "transfer", label: "상사이전" },
  { value: "scrap", label: "폐차말소" },
  { value: "auction", label: "경매" },
  { value: "direct", label: "당사자거래" },
  { value: "other", label: "기타" },
]

const BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "SC제일은행",
  "한국씨티은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "경남은행",
  "광주은행",
  "새마을금고",
  "우체국",
  "기타",
]

export function BatchRefundForm() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean
    duplicates: { index: number; vehicleNumber: string; existingRefundId: string }[]
    message: string
  }>({ show: false, duplicates: [], message: "" })
  const [suggestions, setSuggestions] = useState<{ companyNames: string[]; dealerNames: string[] }>({
    companyNames: [],
    dealerNames: [],
  })
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)

  useEffect(() => {
    fetch("/api/refunds/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestions(data))
      .catch(() => {})
  }, [])

  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const [header, setHeader] = useState<BatchRefundHeader>({
    insuranceProvider: "",
    insuranceProviderEtc: "",
    companyName: "",
    dealerName: "",
    managerName: "",
    refundMethod: "" as any,
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    offsetReason: "", // New field for offset reason
  })

  const [lineItems, setLineItems] = useState<LineItemWithPhotos[]>([
    {
      id: crypto.randomUUID(),
      refundDate: getTodayDate(), // Auto-set to today
      vehicleNumber: "",
      vin: "",
      claimAmount: 0,
      refundReason: "",
      receiptDate: "",
      photos: [],
    },
  ])

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        refundDate: getTodayDate(), // Auto-set to today
        vehicleNumber: "",
        vin: "",
        claimAmount: 0,
        refundReason: "",
        receiptDate: "",
        photos: [],
      },
    ])
  }

  const copyLineItem = (index: number) => {
    const source = lineItems[index]
    const copied: LineItemWithPhotos = {
      id: crypto.randomUUID(),
      refundDate: getTodayDate(), // Excluded from copy, set to today
      vehicleNumber: "", // Excluded from copy
      vin: source.vin,
      claimAmount: 0, // Excluded from copy
      refundReason: source.refundReason,
      receiptDate: source.receiptDate,
      photos: [], // Excluded from copy
    }
    const newItems = [...lineItems]
    newItems.splice(index + 1, 0, copied)
    setLineItems(newItems)
  }

  const deleteLineItem = (index: number) => {
    if (lineItems.length === 1) {
      setError("최소 1개 이상의 라인이 필요합니다.")
      return
    }
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: keyof LineItemWithPhotos, value: any) => {
    const newItems = [...lineItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setLineItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent, forceCreate = false) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!header.insuranceProvider || !header.companyName || !header.refundMethod) {
        throw new Error("보험사, 상사명, 환불수단은 필수 항목입니다.")
      }

      if (header.insuranceProvider === "기타(직접입력)" && !header.insuranceProviderEtc.trim()) {
        throw new Error("보험사(기타)를 입력해주세요.")
      }

      if (header.refundMethod === "account") {
        if (!header.accountNumber || !header.accountHolder) {
          throw new Error("계좌번호와 예금주를 입력해주세요.")
        }
      }

      if (header.refundMethod === "offset") {
        if (!header.offsetReason?.trim()) {
          throw new Error("상계 사유를 입력해주세요.")
        }
      }

      // Validate line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]
        if (!item.refundDate || !item.vehicleNumber || !item.claimAmount || !item.refundReason) {
          throw new Error(`라인 ${i + 1}: 필수 항목을 입력해주세요.`)
        }
        if (header.refundMethod !== "account" && !item.receiptDate) {
          throw new Error(`라인 ${i + 1}: 성능완료일을 입력해주세요.`)
        }
        if (item.photos.length === 0) {
          throw new Error(`라인 ${i + 1}: 최소 1장의 영수증 사진을 첨부해주세요.`)
        }
      }

      // Upload photos for each line item
      const processedItems: BatchRefundLineItem[] = []

      for (const item of lineItems) {
        const photoUrls: string[] = []

        for (const photo of item.photos) {
          const formData = new FormData()
          formData.append("file", photo.file)

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text()
            throw new Error(errorText || "사진 업로드에 실패했습니다.")
          }

          const uploadData = await uploadRes.json()
          photoUrls.push(uploadData.url)
        }

        processedItems.push({
          id: item.id,
          refundDate: item.refundDate,
          vehicleNumber: item.vehicleNumber,
          vin: item.vin || undefined,
          claimAmount: Number(item.claimAmount),
          refundReason: item.refundReason,
          receiptDate: item.receiptDate || undefined,
          receiptPhotos: photoUrls,
        })
      }

      // Submit batch refund
      const res = await fetch("/api/refunds/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            ...header,
            insuranceProviderEtc:
              header.insuranceProvider === "기타(직접입력)" ? header.insuranceProviderEtc : undefined,
          },
          items: processedItems,
          forceCreate,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDuplicateWarning({
          show: true,
          duplicates: data.duplicates,
          message: data.message,
        })
        setLoading(false)
        return
      }

      if (!res.ok) {
        let errorMessage = "일괄 환불 청구 제출에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage

          if (
            res.status === 401 ||
            errorMessage.includes("인증이 필요합니다") ||
            errorMessage.includes("세션이 만료되었습니다")
          ) {
            alert("세션이 만료되었습니다. 다시 로그인해주세요.")
            router.push("/")
            return
          }

          // Show failed items detail
          if (data.failedItems) {
            const failedDetails = data.failedItems.map((f: any) => `라인 ${f.index + 1}: ${f.reason}`).join("\n")
            errorMessage = `${errorMessage}\n\n실패 내역:\n${failedDetails}`
          }
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setSubmitCount(data.createdCount)
      setSubmitSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const resetFormForContinue = () => {
    setLineItems([
      {
        id: crypto.randomUUID(),
        refundDate: getTodayDate(),
        vehicleNumber: "",
        vin: "",
        claimAmount: 0,
        refundReason: "",
        receiptDate: "",
        photos: [],
      },
    ])
    setError("")
    setSubmitSuccess(false)
    setSubmitCount(0)
  }

  const handleForceCreate = async () => {
    setDuplicateWarning({ show: false, duplicates: [], message: "" })
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent
    await handleSubmit(syntheticEvent, true)
  }

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Header Section */}
        <Card>
          <CardHeader>
            <CardTitle>공통 정보</CardTitle>
            <CardDescription>모든 라인에 적용될 공통 정보를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="insuranceProvider">
                  보험사 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={header.insuranceProvider}
                  onValueChange={(value) => setHeader({ ...header, insuranceProvider: value, offsetReason: "" })} // Reset offset reason when changing method
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="보험사를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KB손해보험">KB손해보험</SelectItem>
                    <SelectItem value="메리츠">메리츠</SelectItem>
                    <SelectItem value="현대해상">현대해상</SelectItem>
                    <SelectItem value="기타(직접입력)">기타(직접입력)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {header.insuranceProvider === "기타(직접입력)" && (
                <div className="space-y-2">
                  <Label htmlFor="insuranceProviderEtc">
                    보험사(기타) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={header.insuranceProviderEtc}
                    onChange={(e) => setHeader({ ...header, insuranceProviderEtc: e.target.value })}
                    placeholder="보험사명을 입력하세요"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="companyName">
                  상사명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={header.companyName}
                  onChange={(e) => setHeader({ ...header, companyName: e.target.value })}
                  placeholder="상사명을 입력하세요"
                  required
                  disabled={loading}
                  list="batch-companyName-list"
                  autoComplete="off"
                />
                <datalist id="batch-companyName-list">
                  {suggestions.companyNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dealerName">딜러명</Label>
                <Input
                  value={header.dealerName}
                  onChange={(e) => setHeader({ ...header, dealerName: e.target.value })}
                  placeholder="홍길동"
                  disabled={loading}
                  list="batch-dealerName-list"
                  autoComplete="off"
                />
                <datalist id="batch-dealerName-list">
                  {suggestions.dealerNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerName">담당자</Label>
                <Input
                  value={header.managerName}
                  onChange={(e) => setHeader({ ...header, managerName: e.target.value })}
                  placeholder="담당자 이름 입력"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundMethod">
                  환불수단 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={header.refundMethod}
                  onValueChange={(value: any) => setHeader({ ...header, refundMethod: value, offsetReason: "" })} // Reset offset reason when changing method
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="환불수단 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">카드</SelectItem>
                    <SelectItem value="account">계좌</SelectItem>
                    <SelectItem value="offset">상계</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {header.refundMethod === "offset" && (
              <div className="rounded-lg border p-4 space-y-4 mt-4">
                <h3 className="font-semibold text-sm">상계 정보</h3>
                <div className="space-y-2">
                  <Label>
                    상계 사유 <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    value={header.offsetReason}
                    onChange={(e) => setHeader({ ...header, offsetReason: e.target.value })}
                    placeholder="상계 처리 사유를 입력해 주세요."
                    disabled={loading}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {header.refundMethod === "account" && (
              <div className="rounded-lg border p-4 space-y-4 mt-4">
                <h3 className="font-semibold text-sm">계좌 정보</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>은행명</Label>
                    <Select
                      value={header.bankName}
                      onValueChange={(value) => setHeader({ ...header, bankName: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="은행 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {BANKS.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      계좌번호 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={header.accountNumber}
                      onChange={(e) => setHeader({ ...header, accountNumber: e.target.value })}
                      placeholder="123-456-789012"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      예금주 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={header.accountHolder}
                      onChange={(e) => setHeader({ ...header, accountHolder: e.target.value })}
                      placeholder="홍길동"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">환불 항목 ({lineItems.length}건)</h3>
            <Button type="button" onClick={addLineItem} disabled={loading} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              추가하기
            </Button>
          </div>

          {lineItems.map((item, index) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">라인 {index + 1}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLineItem(index)}
                      disabled={loading}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      복사
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteLineItem(index)}
                      disabled={loading || lineItems.length === 1}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      삭제
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      환불신청일자 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={item.refundDate}
                      onChange={(e) => updateLineItem(index, "refundDate", e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      차량번호 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={item.vehicleNumber}
                      onChange={(e) => updateLineItem(index, "vehicleNumber", e.target.value)}
                      placeholder="12가3456"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>차대번호(VIN)</Label>
                    <Input
                      value={item.vin}
                      onChange={(e) => updateLineItem(index, "vin", e.target.value)}
                      placeholder="KMHXX00XXXX000000"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      총환불금액 (원) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={item.claimAmount || ""}
                      onChange={(e) => updateLineItem(index, "claimAmount", Number(e.target.value))}
                      placeholder="100000"
                      required
                      disabled={loading}
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      환불사유 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={item.refundReason}
                      onValueChange={(value) => updateLineItem(index, "refundReason", value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="환불사유 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {REFUND_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(header.refundMethod === "card" || header.refundMethod === "offset" || header.refundMethod === "account") && (
                    <div className="space-y-2">
                      <Label>
                        성능완료일 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={item.receiptDate}
                        onChange={(e) => updateLineItem(index, "receiptDate", e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>

                <ImageUpload
                  photos={item.photos}
                  onPhotosChange={(photos) => updateLineItem(index, "photos", photos)}
                  disabled={loading}
                  label={`영수증 사진 (라인 ${index + 1})`}
                  required
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">{error}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            취소
          </Button>
          <Button type="submit" disabled={loading} className="w-full sm:flex-1">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              `일괄 청구 제출 (${lineItems.length}건)`
            )}
          </Button>
        </div>
      </form>

      <Dialog open={submitSuccess} onOpenChange={(open) => !open && setSubmitSuccess(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 환불 청구 완료</DialogTitle>
            <DialogDescription>{submitCount}건의 환불 청구가 성공적으로 제출되었습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로 이동
            </Button>
            <Button type="button" onClick={resetFormForContinue}>
              추가 입력
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <Dialog
        open={duplicateWarning.show}
        onOpenChange={(open) => !open && setDuplicateWarning({ show: false, duplicates: [], message: "" })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              중복 환불 가능성
            </DialogTitle>
            <DialogDescription className="pt-2">{duplicateWarning.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[300px] overflow-y-auto">
            {duplicateWarning.duplicates.map((dup) => (
              <div key={dup.index} className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">
                  라인 {dup.index + 1} - 차량번호: {dup.vehicleNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  기존 환불건: <span className="font-mono">{dup.existingRefundId}</span>
                </p>
              </div>
            ))}
            <p className="text-sm text-muted-foreground pt-2">
              동일한 <strong>차량번호, 상사명, 환불수단, 청구금액</strong>으로 등록된 환불 요청이 있습니다. 기존
              환불건을 확인하거나, 그래도 새로 등록할 수 있습니다.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDuplicateWarning({ show: false, duplicates: [], message: "" })
                router.push("/refunds")
              }}
            >
              기존 환불건 확인
            </Button>
            <Button type="button" onClick={handleForceCreate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  등록 중...
                </>
              ) : (
                "그래도 새로 등록"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
