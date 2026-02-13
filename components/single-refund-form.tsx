"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { useAuth } from "./auth-provider"
import { ImageUpload } from "./image-upload"
import { Loader2, Calculator, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"

interface PhotoPreview {
  id: string
  file: File
  preview: string
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

export function SingleRefundForm() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [insuranceFee, setInsuranceFee] = useState("")
  const [inspectionFee, setInspectionFee] = useState("")
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean
    existingRefundId: string
    message: string
  }>({ show: false, existingRefundId: "", message: "" })
  const [suggestions, setSuggestions] = useState<{ companyNames: string[]; dealerNames: string[] }>({
    companyNames: [],
    dealerNames: [],
  })
  const [submitSuccess, setSubmitSuccess] = useState(false)

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

  const [formData, setFormData] = useState({
    refundDate: getTodayDate(),
    vehicleNumber: "",
    vin: "",
    insuranceProvider: "",
    insuranceProviderEtc: "",
    companyName: "",
    dealerName: "",
    managerName: "",
    refundMethod: "",
    claimAmount: "",
    refundReason: "",
    customReason: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    receiptDate: "",
    offsetReason: "", // New field for offset reason
  })

  const calculatedResult = (() => {
    const insurance = Number.parseFloat(insuranceFee.replace(/,/g, "")) || 0
    const inspection = Number.parseFloat(inspectionFee.replace(/,/g, "")) || 0
    return insurance - inspection
  })()

  const applyCalculatedAmount = () => {
    setFormData((prev) => ({ ...prev, claimAmount: calculatedResult.toString() }))
    setCalculatorOpen(false)
    setInsuranceFee("")
    setInspectionFee("")
  }

  const formatNumber = (value: string) => {
    const num = value.replace(/[^\d]/g, "")
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent, forceCreate = false) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (
        !formData.refundDate ||
        !formData.vehicleNumber ||
        !formData.insuranceProvider ||
        !formData.companyName ||
        !formData.dealerName ||
        !formData.managerName ||
        !formData.refundMethod ||
        !formData.claimAmount ||
        !formData.refundReason
      ) {
        throw new Error("모든 필수 항목을 입력해주세요.")
      }

      if (formData.insuranceProvider === "기타(직접입력)" && !formData.insuranceProviderEtc.trim()) {
        throw new Error("보험사(기타)를 입력해주세요.")
      }

      if (formData.refundMethod === "account") {
        if (!formData.accountNumber || !formData.accountHolder) {
          throw new Error("계좌번호와 예금주를 입력해주세요.")
        }
      }

      if (formData.refundMethod === "offset") {
        if (!formData.offsetReason.trim()) {
          throw new Error("상계 사유를 입력해주세요.")
        }
      }

      if (formData.refundMethod === "card" || formData.refundMethod === "offset") {
        if (!formData.receiptDate) {
          throw new Error("환불일자(영수증 날짜)를 입력해주세요.")
        }
      }

      const photoUrls: string[] = []
      for (const photo of photos) {
        const formDataObj = new FormData()
        formDataObj.append("file", photo.file)

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formDataObj,
        })

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text()
          throw new Error(errorText || "사진 업로드에 실패했습니다.")
        }

        const uploadData = await uploadRes.json()
        photoUrls.push(uploadData.url)
      }

      const refundData = {
        type: "single",
        refundDate: formData.refundDate,
        vehicleNumber: formData.vehicleNumber,
        vin: formData.vin || undefined,
        insuranceProvider: formData.insuranceProvider,
        insuranceProviderEtc:
          formData.insuranceProvider === "기타(직접입력)" ? formData.insuranceProviderEtc : undefined,
        companyName: formData.companyName || undefined,
        dealerName: formData.dealerName || undefined,
        managerName: formData.managerName || undefined,
        refundMethod: formData.refundMethod,
        claimAmount: Number.parseFloat(formData.claimAmount),
        refundReason: formData.refundReason === "other" ? formData.customReason : formData.refundReason,
        bankName: formData.refundMethod === "account" ? formData.bankName : undefined,
        accountNumber: formData.refundMethod === "account" ? formData.accountNumber : undefined,
        accountHolder: formData.refundMethod === "account" ? formData.accountHolder : undefined,
        receiptDate: formData.refundMethod !== "account" ? formData.receiptDate : undefined,
        offsetReason: formData.refundMethod === "offset" ? formData.offsetReason : undefined, // Include offset reason
        receiptPhotos: photoUrls,
        forceCreate,
      }

      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refundData),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDuplicateWarning({
          show: true,
          existingRefundId: data.existingRefundId,
          message: data.message,
        })
        setLoading(false)
        return
      }

      if (!res.ok) {
        let errorMessage = "환불 청구 제출에 실패했습니다."
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
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }

      setSubmitSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const resetFormForContinue = () => {
    setFormData({
      refundDate: getTodayDate(),
      vehicleNumber: "",
      vin: "",
      insuranceProvider: formData.insuranceProvider,
      insuranceProviderEtc: formData.insuranceProviderEtc,
      companyName: formData.companyName,
      dealerName: formData.dealerName,
      managerName: formData.managerName,
      refundMethod: formData.refundMethod,
      claimAmount: "",
      refundReason: "",
      customReason: "",
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      accountHolder: formData.accountHolder,
      receiptDate: "",
      offsetReason: "",
    })
    setPhotos([])
    setError("")
    setSubmitSuccess(false)
  }

  const handleForceCreate = async () => {
    setDuplicateWarning({ show: false, existingRefundId: "", message: "" })
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent
    await handleSubmit(syntheticEvent, true)
  }

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="refundDate">
              환불신청일자 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="refundDate"
              name="refundDate"
              type="date"
              value={formData.refundDate}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleNumber">
              차량번호(변경 시 구번호와 같이 기재) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vehicleNumber"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleInputChange}
              placeholder="12가3456"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vin">차대번호(VIN)</Label>
            <Input
              id="vin"
              name="vin"
              value={formData.vin}
              onChange={handleInputChange}
              placeholder="KMHXX00XXXX000000"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insuranceProvider">
              보험사 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.insuranceProvider}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, insuranceProvider: value }))}
              disabled={loading}
            >
              <SelectTrigger id="insuranceProvider">
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

          {formData.insuranceProvider === "기타(직접입력)" && (
            <div className="space-y-2">
              <Label htmlFor="insuranceProviderEtc">
                보험사(기타) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="insuranceProviderEtc"
                name="insuranceProviderEtc"
                value={formData.insuranceProviderEtc}
                onChange={handleInputChange}
                placeholder="보험사명을 입력하세요"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="companyName">
              상사명 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              placeholder="상사명을 입력하세요"
              required
              disabled={loading}
              list="companyName-list"
              autoComplete="off"
            />
            <datalist id="companyName-list">
              {suggestions.companyNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealerName">
              딜러명 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dealerName"
              name="dealerName"
              value={formData.dealerName}
              onChange={handleInputChange}
              placeholder="홍길동"
              required
              disabled={loading}
              list="dealerName-list"
              autoComplete="off"
            />
            <datalist id="dealerName-list">
              {suggestions.dealerNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerName">
              담당자 이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="managerName"
              name="managerName"
              value={formData.managerName}
              onChange={handleInputChange}
              placeholder="담당자 이름 입력"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refundMethod">
              환불수단 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.refundMethod}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, refundMethod: value, offsetReason: "" }))}
              disabled={loading}
            >
              <SelectTrigger id="refundMethod">
                <SelectValue placeholder="환불수단 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">카드</SelectItem>
                <SelectItem value="account">계좌</SelectItem>
                <SelectItem value="offset">상계</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimAmount">
              총환불금액 (원) <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="claimAmount"
                name="claimAmount"
                type="number"
                value={formData.claimAmount}
                onChange={handleInputChange}
                placeholder="100000"
                required
                disabled={loading}
                min="0"
                step="1"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCalculatorOpen(true)}
                disabled={loading}
                title="계산기"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refundReason">
              환불사유 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.refundReason}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, refundReason: value }))}
              disabled={loading}
            >
              <SelectTrigger id="refundReason">
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

          {formData.refundReason === "other" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customReason">
                환불사유 (직접입력) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customReason"
                name="customReason"
                value={formData.customReason}
                onChange={handleInputChange}
                placeholder="환불 사유를 입력하세요"
                required
                disabled={loading}
              />
            </div>
          )}
        </div>

        {formData.refundMethod === "offset" && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-sm">상계 정보</h3>
            <div className="space-y-2">
              <Label htmlFor="offsetReason">
                상계 사유 <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="offsetReason"
                name="offsetReason"
                value={formData.offsetReason}
                onChange={(e) => setFormData((prev) => ({ ...prev, offsetReason: e.target.value }))}
                placeholder="상계 처리 사유를 입력해 주세요."
                required
                disabled={loading}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {formData.refundMethod === "account" && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-sm">계좌 정보</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">은행명</Label>
                <Select
                  value={formData.bankName}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, bankName: value }))}
                  disabled={loading}
                >
                  <SelectTrigger id="bankName">
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
                <Label htmlFor="accountNumber">
                  계좌번호 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="123-456-789012"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="accountHolder">
                  예금주 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accountHolder"
                  name="accountHolder"
                  value={formData.accountHolder}
                  onChange={handleInputChange}
                  placeholder="홍길동"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {(formData.refundMethod === "card" ||
          formData.refundMethod === "offset" ||
          formData.refundMethod === "account") && (
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold text-sm">성능정보</h3>
            <div className="space-y-2">
              <Label htmlFor="receiptDate">
                성능완료일 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="receiptDate"
                name="receiptDate"
                type="date"
                value={formData.receiptDate}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>
          </div>
        )}

        <ImageUpload photos={photos} onPhotosChange={setPhotos} disabled={loading} label="영수증 사진" required />

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

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
              "환불 청구 제출"
            )}
          </Button>
        </div>
      </form>

      <Dialog open={submitSuccess} onOpenChange={(open) => !open && setSubmitSuccess(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>환불 청구 완료</DialogTitle>
            <DialogDescription>환불 청구가 성공적으로 제출되었습니다.</DialogDescription>
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

      <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>총환불금액 계산기</DialogTitle>
            <DialogDescription>보험료와 검사비를 입력하면 자동으로 계산됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="insuranceFee">보험료 (원)</Label>
              <Input
                id="insuranceFee"
                value={insuranceFee}
                onChange={(e) => setInsuranceFee(formatNumber(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspectionFee">검사비 (원)</Label>
              <Input
                id="inspectionFee"
                value={inspectionFee}
                onChange={(e) => setInspectionFee(formatNumber(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">계산 결과 (보험료 - 검사비)</span>
                <span className="text-lg font-bold">{calculatedResult.toLocaleString()}원</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCalculatorOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={applyCalculatedAmount}>
              적용하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateWarning.show}
        onOpenChange={(open) => !open && setDuplicateWarning({ show: false, existingRefundId: "", message: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              중복 환불 가능성
            </DialogTitle>
            <DialogDescription className="pt-2">{duplicateWarning.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">기존 환불건 번호:</p>
              <p className="text-sm text-muted-foreground font-mono">{duplicateWarning.existingRefundId}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              동일한 <strong>차량번호, 상사명, 환불수단, 청구금액</strong>으로 등록된 환불 요청이 있습니다. 기존
              환불건을 확인하거나, 그래도 새로 등록할 수 있습니다.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDuplicateWarning({ show: false, existingRefundId: "", message: "" })
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
