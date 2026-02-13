"use client"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Eye, Loader2, Pencil, Trash2, Filter, X, FileSpreadsheet, Download } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import type { RefundRequest } from "@/lib/types"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import ExcelJS from "exceljs"
import { getRefundReasonLabel } from "@/lib/refund-utils"
import { downloadImage, getFileExtension } from "@/lib/download-utils"

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

export default function BranchRefundsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const hasFetchedRef = useRef(false)

  const [editForm, setEditForm] = useState({
    insuranceProvider: "",
    insuranceProviderEtc: "",
    companyName: "",
    dealerName: "",
    refundReason: "",
    refundMethod: "",
    claimAmount: "",
    refundDate: "",
    receiptDate: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    vin: "",
  })

  useEffect(() => {
    // Security: Only BRANCH users can access this page
    if (user && user.role !== "BRANCH") {
      router.push("/dashboard")
      return
    }

    if (user?.role === "BRANCH" && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchRefunds()
    }
  }, [user, router])

  useEffect(() => {
    if (selectedRefund && editMode) {
      setEditForm({
        insuranceProvider: selectedRefund.insuranceProvider || "",
        insuranceProviderEtc: selectedRefund.insuranceProviderEtc || "",
        companyName: selectedRefund.companyName || selectedRefund.insuranceCompany || "",
        dealerName: selectedRefund.dealerName || "",
        refundReason: selectedRefund.refundReason || "",
        refundMethod: selectedRefund.refundMethod || "",
        claimAmount: selectedRefund.claimAmount?.toString() || "",
        refundDate: selectedRefund.refundDate || "",
        receiptDate: selectedRefund.receiptDate || "",
        bankName: selectedRefund.bankName || "",
        accountNumber: selectedRefund.accountNumber || "",
        accountHolder: selectedRefund.accountHolder || "",
        vin: selectedRefund.vin || "",
      })
    }
  }, [selectedRefund, editMode])

  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCompanyName, setFilterCompanyName] = useState("all")
  const [filterVehicleNumber, setFilterVehicleNumber] = useState("")
  const [debouncedVehicleNumber, setDebouncedVehicleNumber] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedVehicleNumber(filterVehicleNumber)
    }, 300)

    return () => clearTimeout(timer)
  }, [filterVehicleNumber])

  const fetchRefunds = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/branch/refunds")

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "조회 실패")
      }

      const data = await response.json()
      setRefunds(data.refunds || [])
    } catch (error) {
      console.error("Failed to fetch refunds:", error)
      toast({
        title: "오류",
        description: "환불 목록을 불러올 수 없습니다.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!selectedRefund) return

    try {
      setSaving(true)

      const response = await fetch(`/api/branch/refunds/${selectedRefund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "수정 실패")
      }

      toast({
        title: "수정 완료",
        description: "환불 신청이 수정되었습니다.",
      })

      setEditMode(false)
      setSelectedRefund(null)
      await fetchRefunds()
    } catch (error) {
      toast({
        title: "수정 실패",
        description: error instanceof Error ? error.message : "수정에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (refund: RefundRequest) => {
    const confirmed = window.confirm("삭제하면 데이터와 첨부 사진이 모두 삭제되며 복구할 수 없습니다. 진행할까요?")

    if (!confirmed) return

    try {
      setDeleting(true)

      const response = await fetch(`/api/branch/refunds/${refund.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "삭제 실패")
      }

      const result = await response.json()

      toast({
        title: "삭제 완료",
        description: `환불 신청이 삭제되었습니다.${result.failedPhotos?.length > 0 ? " (일부 사진 삭제 실패)" : ""}`,
      })

      setSelectedRefund(null)
      await fetchRefunds()
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: error instanceof Error ? error.message : "삭제에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      // Use the same Excel generation logic as commander
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("환불건")

      // Define columns (same as commander API)
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
        { header: "담당자", key: "managerName", width: 15 },
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

      // Style header row (same as commander)
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      }

      // Add filtered refunds data
      refunds.forEach((refund) => {
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
          managerName: refund.managerName || "",
          refundMethod:
            refund.refundMethod === "card"
              ? "카드"
              : refund.refundMethod === "account"
                ? "계좌"
                : refund.refundMethod === "offset"
                  ? "상계"
                  : "",
          claimAmount: refund.claimAmount || "",
          refundReason: getRefundReasonLabel(refund.refundReason),
          bankName: refund.bankName || "",
          accountNumber: refund.accountNumber || "",
          accountHolder: refund.accountHolder || "",
          receiptDate: refund.receiptDate || "",
          submittedAt: new Date(refund.submittedAt).toLocaleString("ko-KR"),
          processedAt: refund.processedAt ? new Date(refund.processedAt).toLocaleString("ko-KR") : "",
          notes: refund.notes || "",
        })
      })

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const urlObj = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = urlObj

      const today = new Date().toISOString().split("T")[0]
      link.download = `refunds_branch_${today}.xlsx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(urlObj)
    } catch (error) {
      console.error("[v0] Failed to export Excel:", error)
      alert("엑셀 다운로드 중 오류가 발생했습니다.")
    } finally {
      setExportLoading(false)
    }
  }

  const setQuickDate = (days: number) => {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - days)
    setFilterFrom(from.toISOString().split("T")[0])
    setFilterTo(today.toISOString().split("T")[0])
  }

  const resetFilters = () => {
    setFilterFrom("")
    setFilterTo("")
    setFilterStatus("all")
    setFilterCompanyName("all")
    setFilterVehicleNumber("")
  }

  const filteredRefunds = refunds.filter((refund) => {
    // Date range filter
    if (filterFrom && refund.refundDate) {
      if (refund.refundDate < filterFrom) return false
    }
    if (filterTo && refund.refundDate) {
      if (refund.refundDate > filterTo) return false
    }

    // Status filter
    if (filterStatus && filterStatus !== "all") {
      if (refund.status !== filterStatus) return false
    }

    // Company name filter
    if (filterCompanyName && filterCompanyName !== "all") {
      const companyName = refund.companyName || refund.insuranceCompany
      if (companyName !== filterCompanyName) return false
    }

    if (debouncedVehicleNumber) {
      const searchTerm = debouncedVehicleNumber.replace(/[\s-]/g, "").toLowerCase()
      const vehicleNumber = (refund.vehicleNumber || "").replace(/[\s-]/g, "").toLowerCase()
      if (!vehicleNumber.includes(searchTerm)) return false
    }

    return true
  })

  const uniqueCompanyNames = Array.from(
    new Set(refunds.map((r) => r.companyName || r.insuranceCompany).filter(Boolean)),
  ).sort()

  const getStatusBadge = (status: string, acknowledgedAt?: string, approvedAt?: string, isDuplicate?: boolean) => {
    const statusBadge = (() => {
      switch (status) {
        case "pending":
          return (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              대기중
            </Badge>
          )
        case "approved":
          return (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                승인됨
              </Badge>
              {approvedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(approvedAt).toLocaleDateString("ko-KR")}
                </span>
              )}
            </div>
          )
        case "rejected":
          return (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                거부됨
              </Badge>
              {acknowledgedAt && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  확인됨
                </Badge>
              )}
            </div>
          )
        default:
          return <Badge variant="outline">{status}</Badge>
      }
    })()

    if (isDuplicate) {
      return (
        <div className="flex items-center gap-2">
          {statusBadge}
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
            title="동일 조건 환불건이 존재합니다"
          >
            중복
          </Badge>
        </div>
      )
    }

    return statusBadge
  }

  const canModify = (refund: RefundRequest) => {
    return refund.status === "pending" || refund.status === "rejected"
  }

  useEffect(() => {
    const acknowledgeRejectedRefund = async (refund: RefundRequest) => {
      // Only acknowledge if status is rejected and not yet acknowledged
      if (refund.status === "rejected" && !refund.acknowledgedAt) {
        try {
          await fetch(`/api/refunds/${refund.id}/acknowledge`, {
            method: "POST",
          })
          // Refresh the list to show updated acknowledgment status
          fetchRefunds()
        } catch (error) {
          console.error("[v0] Failed to acknowledge refund:", error)
        }
      }
    }

    if (selectedRefund) {
      acknowledgeRejectedRefund(selectedRefund)
    }
  }, [selectedRefund])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내 환불 신청</h1>
          <p className="text-muted-foreground">{user?.branchName} 성능장에서 신청한 환불 내역입니다.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            대시보드로
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>환불 신청 목록</CardTitle>
          <CardDescription>총 {refunds.length}건의 환불 신청이 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                필터 {showFilters ? "숨기기" : "표시"}
              </Button>
              <Button onClick={handleExportExcel} disabled={exportLoading} variant="outline" size="sm">
                {exportLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                엑셀 다운로드
              </Button>
            </div>

            {showFilters && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="filter-from">시작일</Label>
                    <Input
                      id="filter-from"
                      type="date"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-to">종료일</Label>
                    <Input
                      id="filter-to"
                      type="date"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-status">상태</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger id="filter-status">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        <SelectItem value="pending">대기중</SelectItem>
                        <SelectItem value="approved">승인됨</SelectItem>
                        <SelectItem value="rejected">거부됨</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-company">상사명</Label>
                    <Select value={filterCompanyName} onValueChange={setFilterCompanyName}>
                      <SelectTrigger id="filter-company">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {uniqueCompanyNames.map((name) => (
                          <SelectItem key={name} value={name!}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-vehicle">차량번호 검색</Label>
                  <Input
                    id="filter-vehicle"
                    type="text"
                    placeholder="차량번호 검색"
                    value={filterVehicleNumber}
                    onChange={(e) => setFilterVehicleNumber(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setQuickDate(0)}>
                      오늘
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setQuickDate(7)}>
                      7일
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setQuickDate(30)}>
                      30일
                    </Button>
                  </div>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="mr-2 h-4 w-4" />
                    초기화
                  </Button>
                </div>
              </div>
            )}
          </div>

          {refunds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>아직 신청한 환불이 없습니다.</p>
              <Button variant="link" asChild className="mt-2">
                <Link href="/refund/single">첫 환불 신청하기</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>환불신청일자</TableHead>
                    <TableHead>차량번호</TableHead>
                    <TableHead>총환불금액</TableHead>
                    <TableHead>환불수단</TableHead>
                    <TableHead>환불사유</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRefunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell>{refund.refundDate || "-"}</TableCell>
                      <TableCell>{refund.vehicleNumber || "-"}</TableCell>
                      <TableCell>{refund.claimAmount ? `${refund.claimAmount.toLocaleString()}원` : "-"}</TableCell>
                      <TableCell>
                        {refund.refundMethod === "card"
                          ? "카드"
                          : refund.refundMethod === "account"
                            ? "계좌"
                            : refund.refundMethod === "offset"
                              ? "상계"
                              : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {getRefundReasonLabel(refund.refundReason)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(refund.status, refund.acknowledgedAt, refund.approvedAt, refund.isDuplicate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(refund.submittedAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRefund(refund)
                              setEditMode(false)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canModify(refund) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRefund(refund)
                                  setEditMode(true)
                                }}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(refund)}
                                disabled={deleting}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedRefund !== null}
        onOpenChange={() => {
          setSelectedRefund(null)
          setEditMode(false)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? "환불 신청 수정" : "환불 신청 상세"}</DialogTitle>
            <DialogDescription>
              {editMode ? "환불 신청 내용을 수정할 수 있습니다." : "환불 신청 내역을 확인할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-6">
              {!editMode ? (
                // View Mode
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">신청 ID</Label>
                      <p className="mt-1 text-sm font-mono">{selectedRefund.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">상태</Label>
                      <p className="mt-1">
                        {getStatusBadge(
                          selectedRefund.status,
                          selectedRefund.acknowledgedAt,
                          selectedRefund.approvedAt,
                        )}
                      </p>
                      {selectedRefund.acknowledgedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          확인 시간: {new Date(selectedRefund.acknowledgedAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                      {selectedRefund.status === "approved" && selectedRefund.approvedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          승인일시: {new Date(selectedRefund.approvedAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">환불신청일자</Label>
                      <p className="mt-1 text-sm">{selectedRefund.refundDate || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">차량번호</Label>
                      <p className="mt-1 text-sm">{selectedRefund.vehicleNumber || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">차대번호</Label>
                      <p className="mt-1 text-sm">{selectedRefund.vin || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">보험사</Label>
                      <p className="mt-1 text-sm">
                        {selectedRefund.insuranceProvider === "기타(직접입력)"
                          ? selectedRefund.insuranceProviderEtc || "-"
                          : selectedRefund.insuranceProvider || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">상사명</Label>
                      <p className="mt-1 text-sm">
                        {selectedRefund.companyName || selectedRefund.insuranceCompany || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">딜러명</Label>
                      <p className="mt-1 text-sm">{selectedRefund.dealerName || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">환불수단</Label>
                      <p className="mt-1 text-sm">
                        {selectedRefund.refundMethod === "card"
                          ? "카드"
                          : selectedRefund.refundMethod === "account"
                            ? "계좌"
                            : selectedRefund.refundMethod === "offset"
                              ? "상계"
                              : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">총환불금액</Label>
                      <p className="mt-1 text-sm">
                        {selectedRefund.claimAmount ? `${selectedRefund.claimAmount.toLocaleString()}원` : "-"}
                      </p>
                    </div>

                    {selectedRefund.refundMethod === "account" && (
                      <>
                        <div>
                          <Label className="text-muted-foreground">은행명</Label>
                          <p className="mt-1 text-sm">{selectedRefund.bankName || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">계좌번호</Label>
                          <p className="mt-1 text-sm">{selectedRefund.accountNumber || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">예금주</Label>
                          <p className="mt-1 text-sm">{selectedRefund.accountHolder || "-"}</p>
                        </div>
                      </>
                    )}

                    {(selectedRefund.refundMethod === "card" || selectedRefund.refundMethod === "offset") && (
                      <div>
                        <Label className="text-muted-foreground">환불일자</Label>
                        <p className="mt-1 text-sm">{selectedRefund.receiptDate || "-"}</p>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">환불사유</Label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {getRefundReasonLabel(selectedRefund.refundReason)}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">등록일시</Label>
                      <p className="mt-1 text-sm">{new Date(selectedRefund.submittedAt).toLocaleString("ko-KR")}</p>
                    </div>
                  </div>

                  {selectedRefund.receiptPhotos && selectedRefund.receiptPhotos.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-muted-foreground">첨부된 영수증 사진</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            for (let i = 0; i < selectedRefund.receiptPhotos!.length; i++) {
                              await downloadImage(
                                selectedRefund.receiptPhotos![i],
                                `refund_${selectedRefund.id}_${i + 1}.${getFileExtension(selectedRefund.receiptPhotos![i])}`,
                              )
                              if (i < selectedRefund.receiptPhotos!.length - 1) {
                                await new Promise((resolve) => setTimeout(resolve, 300))
                              }
                            }
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          전체 다운로드
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {selectedRefund.receiptPhotos.map((url, i) => (
                          <div key={i} className="relative group">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`영수증 ${i + 1}`}
                                className="w-full rounded-lg border hover:opacity-80 transition-opacity"
                              />
                            </a>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                downloadImage(url, `refund_${selectedRefund.id}_${i + 1}.${getFileExtension(url)}`)
                              }
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRefund.processedBy && (
                    <div className="rounded-lg bg-muted p-4">
                      <h3 className="font-semibold mb-2">처리 정보</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">처리자:</span> {selectedRefund.processedBy}
                        </div>
                        <div>
                          <span className="text-muted-foreground">처리일시:</span>{" "}
                          {selectedRefund.processedAt
                            ? new Date(selectedRefund.processedAt).toLocaleString("ko-KR")
                            : "-"}
                        </div>
                        {selectedRefund.notes && (
                          <div>
                            <span className="text-muted-foreground">처리 메모:</span>
                            <p className="mt-1 whitespace-pre-wrap">{selectedRefund.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {canModify(selectedRefund) && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setEditMode(true)} className="flex-1">
                        <Pencil className="mr-2 h-4 w-4" />
                        수정
                      </Button>
                      <Button variant="destructive" onClick={() => handleDelete(selectedRefund)} disabled={deleting}>
                        {deleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            삭제 중...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                // Edit Mode
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-refundDate">환불신청일자 *</Label>
                      <Input
                        id="edit-refundDate"
                        type="date"
                        value={editForm.refundDate}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, refundDate: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-vin">차대번호</Label>
                      <Input
                        id="edit-vin"
                        value={editForm.vin}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, vin: e.target.value }))}
                        placeholder="KMHXX00XXXX000000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-insuranceProvider">보험사 *</Label>
                      <Select
                        value={editForm.insuranceProvider}
                        onValueChange={(value) => setEditForm((prev) => ({ ...prev, insuranceProvider: value }))}
                      >
                        <SelectTrigger id="edit-insuranceProvider">
                          <SelectValue placeholder="보험사 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KB손해보험">KB손해보험</SelectItem>
                          <SelectItem value="현대해상">현대해상</SelectItem>
                          <SelectItem value="기타(직접입력)">기타(직접입력)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editForm.insuranceProvider === "기타(직접입력)" && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-insuranceProviderEtc">보험사(기타) *</Label>
                        <Input
                          id="edit-insuranceProviderEtc"
                          value={editForm.insuranceProviderEtc}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, insuranceProviderEtc: e.target.value }))}
                          placeholder="보험사명"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="edit-companyName">상사명</Label>
                      <Input
                        id="edit-companyName"
                        value={editForm.companyName}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-dealerName">딜러명</Label>
                      <Input
                        id="edit-dealerName"
                        value={editForm.dealerName}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, dealerName: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-refundMethod">환불수단 *</Label>
                      <Select
                        value={editForm.refundMethod}
                        onValueChange={(value) => setEditForm((prev) => ({ ...prev, refundMethod: value }))}
                      >
                        <SelectTrigger id="edit-refundMethod">
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
                      <Label htmlFor="edit-claimAmount">총환불금액 (원) *</Label>
                      <Input
                        id="edit-claimAmount"
                        type="number"
                        value={editForm.claimAmount}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, claimAmount: e.target.value }))}
                        min="0"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="edit-refundReason">환불사유 *</Label>
                      <Select
                        value={editForm.refundReason}
                        onValueChange={(value) => setEditForm((prev) => ({ ...prev, refundReason: value }))}
                      >
                        <SelectTrigger id="edit-refundReason">
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

                    {editForm.refundMethod === "account" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="edit-bankName">은행명</Label>
                          <Select
                            value={editForm.bankName}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, bankName: value }))}
                          >
                            <SelectTrigger id="edit-bankName">
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
                          <Label htmlFor="edit-accountNumber">계좌번호 *</Label>
                          <Input
                            id="edit-accountNumber"
                            value={editForm.accountNumber}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="edit-accountHolder">예금주 *</Label>
                          <Input
                            id="edit-accountHolder"
                            value={editForm.accountHolder}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, accountHolder: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {(editForm.refundMethod === "card" || editForm.refundMethod === "offset") && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="edit-receiptDate">환불일자 *</Label>
                        <Input
                          id="edit-receiptDate"
                          type="date"
                          value={editForm.receiptDate}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, receiptDate: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving} className="flex-1">
                      취소
                    </Button>
                    <Button onClick={handleEditSubmit} disabled={saving} className="flex-1">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        "저장"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
