"use client"

import { useState, useMemo, useCallback, useEffect } from "react" // Added useEffect
import type { RefundRequest } from "@/lib/types"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import {
  Eye,
  Edit,
  Trash2,
  Download,
  XCircle,
  CheckCircle,
  Loader2,
  Filter,
  X,
  RefreshCw,
  FileDown,
  FileSpreadsheet,
  FileArchive,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Textarea } from "./ui/textarea"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useAuth } from "./auth-provider"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { getRefundReasonLabel } from "@/lib/refund-utils"
import { downloadImage, getFileExtension } from "@/lib/download-utils"
import { Checkbox } from "./ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function RefundManagementTable({ apiEndpoint = "/api/refunds" }: { apiEndpoint?: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false) // Renamed deleteLoading to isDeleting for clarity
  const [editDialogOpen, setEditDialogOpen] = useState(false) // New state for edit dialog

  const [actionLoading, setActionLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)
  // const [deleteLoading, setDeleteLoading] = useState(false) // Removed as isDeleting is added
  const [notes, setNotes] = useState("")

  const [editMode, setEditMode] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm, setEditForm] = useState<Partial<RefundRequest>>({})

  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false)
  const [statusChangeLoading, setStatusChangeLoading] = useState(false)
  const [newStatus, setNewStatus] = useState<"pending" | "approved" | "rejected">("pending")
  const [statusChangeReason, setStatusChangeReason] = useState("")
  const [confirmStatusChange, setConfirmStatusChange] = useState(false)

  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState(searchParams.get("from") || "")
  const [filterTo, setFilterTo] = useState(searchParams.get("to") || "")
  const [filterSubmitter, setFilterSubmitter] = useState(searchParams.get("submitter") || "all")
  const [filterCompanyName, setFilterCompanyName] = useState(searchParams.get("companyName") || "all")
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "pending")

  const [vehicleSearch, setVehicleSearch] = useState("")

  const [quickActionRefund, setQuickActionRefund] = useState<RefundRequest | null>(null)
  const [quickActionType, setQuickActionType] = useState<"approve" | "reject" | null>(null)
  const [quickActionNotes, setQuickActionNotes] = useState("")
  const [quickActionLoading, setQuickActionLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState(Number.parseInt(searchParams.get("page") || "1"))
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 20

  const uniqueSubmitters = Array.from(new Set(refunds.map((r) => r.submittedBy))).sort()
  const uniqueCompanyNames = Array.from(
    new Set(refunds.map((r) => r.companyName || r.insuranceCompany).filter(Boolean)),
  ).sort()

  const filterKey = useMemo(() => {
    return JSON.stringify({
      from: filterFrom,
      to: filterTo,
      submitter: filterSubmitter,
      companyName: filterCompanyName,
      status: filterStatus,
    })
  }, [filterFrom, filterTo, filterSubmitter, filterCompanyName, filterStatus])

  const fetchRefunds = useCallback(async () => {
    try {
      setError("")
      setLoading(true)
      const params = new URLSearchParams()
      if (filterFrom) params.set("from", filterFrom)
      if (filterTo) params.set("to", filterTo)
      if (filterSubmitter && filterSubmitter !== "all") params.set("submitter", filterSubmitter)
      if (filterCompanyName && filterCompanyName !== "all") params.set("companyName", filterCompanyName)
      if (filterStatus && filterStatus !== "all") params.set("status", filterStatus)
      params.set("page", currentPage.toString())
      params.set("pageSize", pageSize.toString())

      const queryString = params.toString()
      const url = `${apiEndpoint}${queryString ? `?${queryString}` : ""}`

      console.log("[v0] Fetching refunds:", { page: currentPage, url })

      const res = await fetch(url)

      if (!res.ok) {
        let errorMessage = "환불 목록 조회에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        setError(errorMessage)
        return
      }

      const data = await res.json()
      setRefunds(data.refunds)
      setTotalCount(data.totalCount || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error("[v0] Failed to fetch refunds:", error)
      setError("환불 목록을 불러오는 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [currentPage, filterFrom, filterTo, filterSubmitter, filterCompanyName, filterStatus, apiEndpoint]) // Added all dependencies so fetchRefunds updates when filters or page changes

  const applyFilters = () => {
    setCurrentPage(1)
    setTimeout(() => fetchRefunds(), 0)
  }

  const resetFilters = () => {
    setFilterFrom("")
    setFilterTo("")
    setFilterSubmitter("all")
    setFilterCompanyName("all")
    setFilterStatus("pending") // Reset to default 'pending'
    setCurrentPage(1)
    router.push("/refunds")
  }

  const setQuickDate = (days: number) => {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - days)
    setFilterFrom(from.toISOString().split("T")[0])
    setFilterTo(today.toISOString().split("T")[0])
  }

  const handleAction = async (refundId: string, action: "approve" | "reject") => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/refunds/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId, action, notes }),
      })

      if (!res.ok) {
        let errorMessage = "처리 중 오류가 발생했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        alert(errorMessage)
        return
      }

      await fetchRefunds()
      setSelectedRefund(null)
      setNotes("")
    } catch (error) {
      console.error("[v0] Failed to process action:", error)
      alert("처리 중 오류가 발생했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleQuickAction = async () => {
    if (!quickActionRefund || !quickActionType) return

    if (quickActionType === "reject" && !quickActionNotes.trim()) {
      alert("거부 사유를 입력해주세요.")
      return
    }

    setQuickActionLoading(true)
    try {
      const res = await fetch("/api/refunds/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundId: quickActionRefund.id,
          action: quickActionType,
          notes: quickActionNotes,
        }),
      })

      if (!res.ok) {
        let errorMessage = "처리 중 오류가 발생했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        alert(errorMessage)
        return
      }

      await fetchRefunds()
      setQuickActionRefund(null)
      setQuickActionType(null)
      setQuickActionNotes("")
    } catch (error) {
      console.error("[v0] Quick action failed:", error)
      alert("처리 중 오류가 발생했습니다.")
    } finally {
      setQuickActionLoading(false)
    }
  }

  const handleStatusChange = async () => {
    if (!selectedRefund) return
    if (!statusChangeReason || statusChangeReason.length < 3) {
      alert("사유는 최소 3자 이상 입력해주세요.")
      return
    }
    if (!confirmStatusChange) {
      alert("변경 내용을 확인해주세요.")
      return
    }

    setStatusChangeLoading(true)
    try {
      const res = await fetch(`/api/refunds/${selectedRefund.id}/change-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: newStatus,
          reason: statusChangeReason,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "처리 중 오류가 발생했습니다.")
        return
      }

      const { refund: updatedRefund } = await res.json()

      // Update local state
      setRefunds((prev) => prev.map((r) => (r.id === updatedRefund.id ? updatedRefund : r)))
      setSelectedRefund(updatedRefund)

      // Reset dialog state
      setStatusChangeDialogOpen(false)
      setStatusChangeReason("")
      setConfirmStatusChange(false)

      alert("상태가 변경되었습니다.")

      await fetchRefunds()
    } catch (error) {
      console.error("[v0] Failed to change status:", error)
      alert("처리 중 오류가 발생했습니다.")
    } finally {
      setStatusChangeLoading(false)
    }
  }

  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set("from", filterFrom)
      if (filterTo) params.set("to", filterTo)
      if (filterSubmitter && filterSubmitter !== "all") params.set("submitter", filterSubmitter)
      if (filterCompanyName && filterCompanyName !== "all") params.set("companyName", filterCompanyName)
      // Export should also respect filters, but not pagination
      params.set("page", "1") // Start from the first page for export
      params.set("pageSize", (totalCount || refunds.length).toString()) // Export all records

      const queryString = params.toString()
      const url = `/api/refunds/export/xlsx${queryString ? `?${queryString}` : ""}`

      const res = await fetch(url)

      if (!res.ok) {
        let errorMessage = "엑셀 다운로드에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        alert(errorMessage)
        return
      }

      const blob = await res.blob()
      const urlObj = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = urlObj

      const today = new Date().toISOString().split("T")[0]
      link.download = `refunds_${today}.xlsx`

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

  const handleDownloadPhotosZip = async () => {
    setZipLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set("from", filterFrom)
      if (filterTo) params.set("to", filterTo)
      if (filterSubmitter && filterSubmitter !== "all") params.set("submitter", filterSubmitter)
      if (filterCompanyName && filterCompanyName !== "all") params.set("companyName", filterCompanyName)
      // ZIP download should also respect filters, but not pagination
      params.set("page", "1") // Start from the first page for ZIP download
      params.set("pageSize", (totalCount || refunds.length).toString()) // Download all relevant photos

      const queryString = params.toString()
      const url = `/api/refunds/photos-zip${queryString ? `?${queryString}` : ""}`

      const res = await fetch(url)

      if (!res.ok) {
        let errorMessage = "사진 ZIP 다운로드에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        alert(errorMessage)
        return
      }

      const blob = await res.blob()
      const urlObj = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = urlObj

      const today = new Date().toISOString().split("T")[0]
      link.download = `refund_photos_${today}.zip`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(urlObj)

      // Use toast for user feedback
      toast({
        title: "다운로드 완료",
        description: "사진 ZIP 파일이 다운로드되었습니다.",
      })
    } catch (error) {
      console.error("[v0] Failed to download photos ZIP:", error)
      alert("사진 ZIP 다운로드 중 오류가 발생했습니다.")
    } finally {
      setZipLoading(false)
    }
  }

  const downloadAllPhotos = async (refund: RefundRequest) => {
    setDownloadLoading(true)
    try {
      const photos: string[] = []

      if (refund.receiptPhotos) {
        photos.push(...refund.receiptPhotos)
      }

      if (refund.bundledPhotos) {
        photos.push(...refund.bundledPhotos)
      }

      if (photos.length === 0) {
        alert("다운로드할 사진이 없습니다.")
        return
      }

      for (let i = 0; i < photos.length; i++) {
        const url = photos[i]
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement("a")
        link.href = blobUrl
        link.download = `${refund.id}_photo_${i + 1}.jpg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)

        if (i < photos.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    } catch (error) {
      console.error("[v0] Failed to download photos:", error)
      alert("사진 다운로드 중 오류가 발생했습니다.")
    } finally {
      setDownloadLoading(false)
    }
  }

  const downloadExcel = async (url: string, refundId: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${refundId}_refund.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("[v0] Failed to download Excel:", error)
      alert("엑셀 다운로드 중 오류가 발생했습니다.")
    }
  }

  const handleDelete = async (refundId: string) => {
    // Confirm deletion with a more user-friendly dialog or alert
    const confirmDelete = window.confirm(
      "삭제하면 DB 데이터와 첨부 사진이 모두 삭제되며 복구할 수 없습니다. 진행할까요?",
    )
    if (!confirmDelete) return

    setIsDeleting(true) // Use isDeleting state
    try {
      const res = await fetch(`/api/refunds?id=${refundId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        let errorMessage = "삭제 중 오류가 발생했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        toast({
          // Use the toast hook
          title: "삭제 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const result = await res.json()
      toast({
        // Use the toast hook
        title: "삭제 완료",
        description: `환불이 삭제되었습니다. (사진 ${result.deletedPhotos}개 삭제${result.failedPhotos > 0 ? `, ${result.failedPhotos}개 실패` : ""})`,
      })

      setSelectedRefund(null)
      await fetchRefunds() // Re-fetch refunds to update the list
    } catch (error) {
      console.error("[v0] Failed to delete refund:", error)
      toast({
        // Use the toast hook
        title: "삭제 실패",
        description: "삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false) // Reset deleting state
    }
  }

  const handleEditStart = () => {
    if (!selectedRefund) return
    setEditForm({
      insuranceProvider: selectedRefund.insuranceProvider,
      insuranceProviderEtc: selectedRefund.insuranceProviderEtc,
      companyName: selectedRefund.companyName || selectedRefund.insuranceCompany,
      dealerName: selectedRefund.dealerName,
      refundReason: selectedRefund.refundReason,
      refundMethod: selectedRefund.refundMethod,
      claimAmount: selectedRefund.claimAmount,
      refundDate: selectedRefund.refundDate,
      vin: selectedRefund.vin,
      bankName: selectedRefund.bankName,
      accountNumber: selectedRefund.accountNumber,
      accountHolder: selectedRefund.accountHolder,
      receiptDate: selectedRefund.receiptDate,
      managerName: selectedRefund.managerName,
    })
    setEditMode(true)
    setEditDialogOpen(true) // Open the edit dialog
  }

  const handleEditCancel = () => {
    setEditMode(false)
    setEditForm({})
    setEditDialogOpen(false) // Close the edit dialog
  }

  const handleEditSave = async () => {
    if (!selectedRefund) return

    setEditLoading(true)
    try {
      const res = await fetch(`/api/refunds?id=${selectedRefund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      if (!res.ok) {
        let errorMessage = "수정 중 오류가 발생했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        toast({
          title: "수정 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const result = await res.json()
      toast({
        title: "수정 완료",
        description: "환불 정보가 수정되었습니다.",
      })

      setEditMode(false)
      setEditForm({})
      setEditDialogOpen(false) // Close the edit dialog
      setSelectedRefund(result.refund) // Update selectedRefund with the latest data
      await fetchRefunds() // Re-fetch to ensure consistency
    } catch (error) {
      console.error("[v0] Failed to update refund:", error)
      toast({
        title: "수정 실패",
        description: "수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setEditLoading(false)
    }
  }

  const formatApprovalDate = (approvedAt?: string) => {
    if (!approvedAt) return null
    const date = new Date(approvedAt)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    fetchRefunds()
  }, [currentPage, filterKey, fetchRefunds])

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
              {acknowledgedAt ? (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  확인됨
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                  확인대기
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

  const getRefundMethodLabel = (method?: string) => {
    switch (method) {
      case "card":
        return "카드"
      case "account":
        return "계좌"
      case "offset":
        return "상계"
      default:
        return "-"
    }
  }

  const getRefundMethodBadge = (method?: string) => {
    const label = getRefundMethodLabel(method)
    const colorClass =
      method === "card"
        ? "bg-blue-100 text-blue-700"
        : method === "account"
          ? "bg-green-100 text-green-700"
          : method === "offset"
            ? "bg-purple-100 text-purple-700"
            : "bg-gray-100 text-gray-700"

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "single":
        return <Badge variant="secondary">단건</Badge>
      case "bulk":
        return <Badge variant="secondary">일괄</Badge>
      case "bundled":
        return <Badge variant="secondary">묶음</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  // The actual filtering by vehicleSearch is still client-side for immediate feedback
  const filteredRefunds = vehicleSearch
    ? refunds.filter((r) => {
        const vn = (r.vehicleNumber || "").replace(/[\s-]/g, "").toLowerCase()
        const search = vehicleSearch.replace(/[\s-]/g, "").toLowerCase()
        return vn.includes(search)
      })
    : refunds

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive mb-2">{error}</p>
        <Button onClick={fetchRefunds} variant="outline" size="sm">
          다시 시도
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {" "}
      {/* Wrapper div for pagination and table */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex-shrink-0">
            <Filter className="mr-2 h-4 w-4" />
            필터 {showFilters ? "숨기기" : "표시"}
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleExportExcel} disabled={exportLoading} variant="outline" size="sm">
              {exportLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              엑셀 다운로드
            </Button>
            {user?.role === "COMMANDER" && (
              <Button onClick={handleDownloadPhotosZip} disabled={zipLoading} variant="outline" size="sm">
                {zipLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ZIP 생성 중...
                  </>
                ) : (
                  <>
                    <FileArchive className="mr-2 h-4 w-4" />
                    사진 ZIP 다운로드
                  </>
                )}
              </Button>
            )}
            <div className="relative">
              <Input
                placeholder="차량번호 검색"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className="w-48 pr-8"
              />
              {vehicleSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={() => setVehicleSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
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
                <Label htmlFor="filter-submitter">제출자</Label>
                <Select value={filterSubmitter} onValueChange={setFilterSubmitter}>
                  <SelectTrigger id="filter-submitter">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {uniqueSubmitters.map((submitter) => (
                      <SelectItem key={submitter} value={submitter}>
                        {submitter}
                      </SelectItem>
                    ))}
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="filter-status">상태</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="filter-status">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="pending">대기중</SelectItem>
                    <SelectItem value="rejected">거부됨</SelectItem>
                    <SelectItem value="approved">승인됨</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Button size="sm" onClick={applyFilters}>
                <Filter className="mr-2 h-4 w-4" />
                적용
              </Button>
            </div>
          </div>
        )}
      </div>
      {filteredRefunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {vehicleSearch ? "검색 결과가 없습니다." : "필터 조건에 맞는 환불 청구가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>청구 ID</TableHead>
                  <TableHead>차량번호</TableHead>
                  <TableHead>제출자</TableHead>
                  <TableHead>환불수단</TableHead>
                  <TableHead>상사명</TableHead>
                  <TableHead>딜러명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>청구금액</TableHead>
                  <TableHead>제출일시</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono text-xs">{refund.id.slice(0, 16)}...</TableCell>
                    <TableCell className="font-semibold">{refund.vehicleNumber || "-"}</TableCell>
                    <TableCell className="text-sm">
                      <div>{refund.submittedByName || refund.submittedBy}</div>
                      {refund.submittedByBranch && (
                        <div className="text-xs text-muted-foreground">{refund.submittedByBranch}</div>
                      )}
                    </TableCell>
                    <TableCell>{getRefundMethodBadge(refund.refundMethod)}</TableCell>
                    <TableCell>{refund.companyName || refund.insuranceCompany || "-"}</TableCell>
                    <TableCell>{refund.dealerName || "-"}</TableCell>
                    <TableCell>{refund.managerName || "-"}</TableCell>
                    <TableCell>{refund.claimAmount ? `${refund.claimAmount.toLocaleString()}원` : "-"}</TableCell>
                    <TableCell className="text-sm">{new Date(refund.submittedAt).toLocaleString("ko-KR")}</TableCell>
                    <TableCell>
                      {getStatusBadge(refund.status, refund.acknowledgedAt, refund.approvedAt, refund.isDuplicate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {refund.status === "pending" && user?.role === "COMMANDER" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setQuickActionRefund(refund)
                                setQuickActionType("approve")
                                setQuickActionNotes("")
                              }}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setQuickActionRefund(refund)
                                setQuickActionType("reject")
                                setQuickActionNotes("")
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRefund(refund)
                            setNotes(refund.notes || "")
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {!loading && filteredRefunds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            전체 {totalCount}건 중 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)}건
            표시
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            <div className="text-sm">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              다음
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={selectedRefund !== null}
        onOpenChange={() => {
          setSelectedRefund(null)
          setEditMode(false)
          setEditForm({})
          setEditDialogOpen(false) // Ensure edit dialog is closed
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? "환불 청구 수정" : "환불 청구 상세"}</DialogTitle>
            <DialogDescription>
              {editMode ? "환불 청구 정보를 수정할 수 있습니다." : "환불 청구 정보를 확인하고 처리할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-6">
              {!editMode && user?.role === "COMMANDER" && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleEditStart}>
                    <Edit className="mr-2 h-4 w-4" />
                    수정
                  </Button>
                </div>
              )}

              {editMode ? (
                // Edit Form (Now uses the editDialogOpen state to control visibility)
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="edit-insurance">보험사</Label>
                      <Select
                        value={editForm.insuranceProvider}
                        onValueChange={(v) => setEditForm({ ...editForm, insuranceProvider: v })}
                      >
                        <SelectTrigger id="edit-insurance">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KB손해보험">KB손해보험</SelectItem>
                          <SelectItem value="현대해상">현대해상</SelectItem>
                          <SelectItem value="기타(직접입력)">기타(직접입력)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editForm.insuranceProvider === "기타(직접입력)" && (
                      <div>
                        <Label htmlFor="edit-insurance-etc">보험사 (기타)</Label>
                        <Input
                          id="edit-insurance-etc"
                          value={editForm.insuranceProviderEtc || ""}
                          onChange={(e) => setEditForm({ ...editForm, insuranceProviderEtc: e.target.value })}
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="edit-company">상사명</Label>
                      <Input
                        id="edit-company"
                        value={editForm.companyName || ""}
                        onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-dealer">딜러명</Label>
                      <Input
                        id="edit-dealer"
                        value={editForm.dealerName || ""}
                        onChange={(e) => setEditForm({ ...editForm, dealerName: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-method">환불수단</Label>
                      <Select
                        value={editForm.refundMethod}
                        onValueChange={(v: "card" | "account" | "offset") =>
                          setEditForm({ ...editForm, refundMethod: v })
                        }
                      >
                        <SelectTrigger id="edit-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">카드</SelectItem>
                          <SelectItem value="account">계좌</SelectItem>
                          <SelectItem value="offset">상계</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="edit-amount">총환불금액</Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        value={editForm.claimAmount || ""}
                        onChange={(e) => setEditForm({ ...editForm, claimAmount: Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-refund-date">환불신청일자</Label>
                      <Input
                        id="edit-refund-date"
                        type="date"
                        value={editForm.refundDate || ""}
                        onChange={(e) => setEditForm({ ...editForm, refundDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-vin">차대번호(VIN)</Label>
                      <Input
                        id="edit-vin"
                        value={editForm.vin || ""}
                        onChange={(e) => setEditForm({ ...editForm, vin: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-manager">담당자</Label>
                      <Input
                        id="edit-manager"
                        value={editForm.managerName || ""}
                        onChange={(e) => setEditForm({ ...editForm, managerName: e.target.value })}
                      />
                    </div>

                    {editForm.refundMethod === "account" && (
                      <>
                        <div>
                          <Label htmlFor="edit-bank">은행명</Label>
                          <Input
                            id="edit-bank"
                            value={editForm.bankName || ""}
                            onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-account">계좌번호</Label>
                          <Input
                            id="edit-account"
                            value={editForm.accountNumber || ""}
                            onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-holder">예금주</Label>
                          <Input
                            id="edit-holder"
                            value={editForm.accountHolder || ""}
                            onChange={(e) => setEditForm({ ...editForm, accountHolder: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {(editForm.refundMethod === "card" || editForm.refundMethod === "offset") && (
                      <div>
                        <Label htmlFor="edit-receipt-date">환불일자 (영수증 날짜)</Label>
                        <Input
                          id="edit-receipt-date"
                          type="date"
                          value={editForm.receiptDate || ""}
                          onChange={(e) => setEditForm({ ...editForm, receiptDate: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <Label htmlFor="edit-reason">환불사유</Label>
                      <Textarea
                        id="edit-reason"
                        value={editForm.refundReason || ""}
                        onChange={(e) => setEditForm({ ...editForm, refundReason: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleEditCancel}
                      disabled={editLoading}
                      className="flex-1 bg-transparent"
                    >
                      취소
                    </Button>
                    <Button onClick={handleEditSave} disabled={editLoading} className="flex-1">
                      {editLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode (existing detail view)
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">청구 ID</Label>
                      <p className="mt-1 text-sm font-mono">{selectedRefund.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">차량번호</Label>
                      <p className="mt-1 text-sm">{selectedRefund.vehicleNumber || "-"}</p>
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
                      {selectedRefund.status === "rejected" && selectedRefund.acknowledgedAt && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          <p>성능장 확인: {new Date(selectedRefund.acknowledgedAt).toLocaleString("ko-KR")}</p>
                          {selectedRefund.acknowledgedBy && <p>확인자: {selectedRefund.acknowledgedBy}</p>}
                        </div>
                      )}
                      {selectedRefund.status === "rejected" && !selectedRefund.acknowledgedAt && (
                        <p className="mt-2 text-xs text-orange-600">성능장 확인 대기중</p>
                      )}
                      {selectedRefund.status === "approved" && selectedRefund.approvedAt && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          승인일시: {new Date(selectedRefund.approvedAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">제출자</Label>
                      <p className="mt-1 text-sm">{selectedRefund.submittedBy}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">환불수단</Label>
                      <p className="mt-1">{getRefundMethodBadge(selectedRefund.refundMethod)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">상사명</Label>
                      <p className="mt-1 text-sm">
                        {selectedRefund.companyName || selectedRefund.insuranceCompany || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">담당자</Label>
                      <p className="mt-1 text-sm">{selectedRefund.managerName || "-"}</p>
                    </div>
                  </div>

                  {selectedRefund.type === "single" && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="font-semibold">환불 정보</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-muted-foreground">환불신청일자</Label>
                          <p className="mt-1 text-sm">{selectedRefund.refundDate || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">차량번호</Label>
                          <p className="mt-1 text-sm">{selectedRefund.vehicleNumber || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">차대번호(VIN)</Label>
                          <p className="mt-1 text-sm font-mono">{selectedRefund.vin || "-"}</p>
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
                          <p className="mt-1 text-sm font-semibold">{selectedRefund.claimAmount?.toLocaleString()}원</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">환불사유</Label>
                          <p className="mt-1 text-sm">{getRefundReasonLabel(selectedRefund.refundReason)}</p>
                        </div>

                        {selectedRefund.refundMethod === "account" && (
                          <>
                            <div>
                              <Label className="text-muted-foreground">은행명</Label>
                              <p className="mt-1 text-sm">{selectedRefund.bankName || "-"}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">계좌번호</Label>
                              <p className="mt-1 text-sm font-mono">{selectedRefund.accountNumber || "-"}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">예금주</Label>
                              <p className="mt-1 text-sm">{selectedRefund.accountHolder || "-"}</p>
                            </div>
                          </>
                        )}

                        {(selectedRefund.refundMethod === "card" || selectedRefund.refundMethod === "offset") && (
                          <div>
                            <Label className="text-muted-foreground">환불일자 (영수증 날짜)</Label>
                            <p className="mt-1 text-sm">{selectedRefund.receiptDate || "-"}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRefund.receiptPhotos && selectedRefund.receiptPhotos.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>영수증 사진</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAllPhotos(selectedRefund)}
                          disabled={downloadLoading}
                        >
                          {downloadLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          전체 다운로드
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedRefund.receiptPhotos.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`영수증 ${idx + 1}`}
                                className="h-24 w-full rounded-lg border object-cover hover:opacity-75 transition-opacity"
                              />
                            </a>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                downloadImage(url, `refund_${selectedRefund.id}_${idx + 1}.${getFileExtension(url)}`)
                              }
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRefund.excelFile && (
                    <div className="space-y-2">
                      <Label>엑셀 파일</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadExcel(selectedRefund.excelFile!, selectedRefund.id)}
                        className="w-full"
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        엑셀 다운로드
                      </Button>
                    </div>
                  )}

                  {selectedRefund.bundledPhotos && selectedRefund.bundledPhotos.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>관련 사진</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAllPhotos(selectedRefund)}
                          disabled={downloadLoading}
                        >
                          {downloadLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          전체 다운로드
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedRefund.bundledPhotos.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`사진 ${idx + 1}`}
                                className="h-24 w-full rounded-lg border object-cover hover:opacity-75 transition-opacity"
                              />
                            </a>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                downloadImage(
                                  url,
                                  `refund_${selectedRefund.id}_bundled_${idx + 1}.${getFileExtension(url)}`,
                                )
                              }
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">처리 메모</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="처리 내용이나 메모를 입력하세요"
                      rows={3}
                      disabled={selectedRefund.status !== "pending" || actionLoading}
                    />
                  </div>

                  {selectedRefund.status === "pending" && user?.role === "COMMANDER" && (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleAction(selectedRefund.id, "reject")}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        거부
                      </Button>
                      <Button
                        onClick={() => handleAction(selectedRefund.id, "approve")}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        승인
                      </Button>
                    </div>
                  )}

                  {selectedRefund.status !== "pending" && (
                    <div className="rounded-lg border bg-muted p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">처리 상태</span>
                        {getStatusBadge(
                          selectedRefund.status,
                          selectedRefund.acknowledgedAt,
                          selectedRefund.approvedAt,
                        )}
                      </div>
                      {selectedRefund.processedAt && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div>처리 시간: {new Date(selectedRefund.processedAt).toLocaleString("ko-KR")}</div>
                          {selectedRefund.processedBy && <div>처리자: {selectedRefund.processedBy}</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {user?.role === "COMMANDER" && (
                    <div className="rounded-lg border bg-blue-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">관리자 전용 상태 변경</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            상태를 자유롭게 변경할 수 있습니다 (이력 기록됨)
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewStatus(selectedRefund.status)
                            setStatusChangeReason("")
                            setConfirmStatusChange(false)
                            setStatusChangeDialogOpen(true)
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          상태 변경
                        </Button>
                      </div>
                    </div>
                  )}

                  {user?.role === "COMMANDER" && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(selectedRefund.id)}
                        disabled={isDeleting || actionLoading} // Use isDeleting state
                        className="w-full"
                      >
                        {isDeleting ? ( // Use isDeleting state
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        삭제
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>환불건 상태 변경</DialogTitle>
            <DialogDescription>
              상태 변경은 즉시 적용되며 이력에 기록됩니다. 변경 사유를 반드시 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRefund && (
              <div className="rounded-lg border bg-muted p-3">
                <div className="text-xs text-muted-foreground mb-1">환불건 ID</div>
                <div className="font-mono text-sm">{selectedRefund.id}</div>
                <div className="text-xs text-muted-foreground mt-2 mb-1">현재 상태</div>
                <div>{getStatusBadge(selectedRefund.status, selectedRefund.approvedAt)}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-status">새 상태 *</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
                <SelectTrigger id="new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="approved">승인됨</SelectItem>
                  <SelectItem value="rejected">거부됨</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-reason">변경 사유 * (최소 3자)</Label>
              <Textarea
                id="status-reason"
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                placeholder="상태를 변경하는 이유를 입력하세요"
                rows={3}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">{statusChangeReason.length}/100 (최소 3자 필요)</div>
            </div>

            <div className="flex items-start space-x-2 rounded-lg border bg-amber-50 p-3">
              <Checkbox
                id="confirm-change"
                checked={confirmStatusChange}
                onCheckedChange={(checked) => setConfirmStatusChange(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="confirm-change"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  상태 변경은 이력에 기록되며 즉시 적용됩니다
                </label>
                <p className="text-xs text-muted-foreground">누가, 언제, 어떤 상태로 변경했는지 모두 기록됩니다</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStatusChangeDialogOpen(false)} disabled={statusChangeLoading}>
              취소
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={
                statusChangeLoading ||
                !statusChangeReason ||
                statusChangeReason.length < 3 ||
                !confirmStatusChange ||
                (selectedRefund && selectedRefund.status === newStatus)
              }
            >
              {statusChangeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  변경 중...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  변경 실행
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={quickActionRefund !== null && quickActionType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQuickActionRefund(null)
            setQuickActionType(null)
            setQuickActionNotes("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{quickActionType === "approve" ? "환불 승인 확인" : "환불 거부 확인"}</AlertDialogTitle>
            <AlertDialogDescription>
              {quickActionType === "approve" ? "이 환불건을 승인 처리할까요?" : "이 환불건을 거부 처리할까요?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {quickActionRefund && (
            <div className="space-y-3 py-4">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">차량번호:</span>
                  <span className="font-semibold">{quickActionRefund.vehicleNumber || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">제출자:</span>
                  <span>{quickActionRefund.submittedByName || quickActionRefund.submittedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">청구금액:</span>
                  <span>
                    {quickActionRefund.claimAmount ? `${quickActionRefund.claimAmount.toLocaleString()}원` : "-"}
                  </span>
                </div>
              </div>

              {quickActionType === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="quick-reject-notes">거부 사유 (필수)</Label>
                  <Textarea
                    id="quick-reject-notes"
                    value={quickActionNotes}
                    onChange={(e) => setQuickActionNotes(e.target.value)}
                    placeholder="거부 사유를 입력해주세요"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={quickActionLoading}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuickAction} disabled={quickActionLoading}>
              {quickActionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : quickActionType === "approve" ? (
                "승인"
              ) : (
                "거부"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
