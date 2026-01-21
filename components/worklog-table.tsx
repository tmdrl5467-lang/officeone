"use client"

import { Input } from "@/components/ui/input"

import { useEffect, useState } from "react"
import type { WorkLog } from "@/lib/types"
import { Button } from "./ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import {
  Eye,
  Loader2,
  Download,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { useAuth } from "./auth-provider"
import { useToast } from "@/hooks/use-toast"
import { downloadImage, getFileExtension } from "@/lib/download-utils"
import { Badge } from "./ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

const getStatusBadge = (status?: string) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">승인됨</Badge>
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">거부됨</Badge>
    case "pending":
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">대기중</Badge>
  }
}

const getStatusLabel = (status?: string) => {
  switch (status) {
    case "approved":
      return "승인됨"
    case "rejected":
      return "거부됨"
    case "pending":
    default:
      return "대기중"
  }
}

export function WorkLogTable({ apiEndpoint = "/api/worklogs" }: { apiEndpoint?: string }) {
  const [worklogs, setWorklogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedWorklog, setSelectedWorklog] = useState<WorkLog | null>(null)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editingMemo, setEditingMemo] = useState(false)
  const [editedMemo, setEditedMemo] = useState("")
  const [saveLoading, setSaveLoading] = useState(false)
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false)

  const [editingComment, setEditingComment] = useState(false)
  const [editedComment, setEditedComment] = useState("")
  const [commentSaveLoading, setCommentSaveLoading] = useState(false)
  const [statusChangeLoading, setStatusChangeLoading] = useState(false)

  const getDefaultFromDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Last 30 days
    return date.toISOString().split("T")[0]
  }

  const getDefaultToDate = () => {
    return new Date().toISOString().split("T")[0]
  }

  const [fromDate, setFromDate] = useState(getDefaultFromDate())
  const [toDate, setToDate] = useState(getDefaultToDate())
  const [showFilters, setShowFilters] = useState(false)

  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 20

  const { user } = useAuth()
  const { toast } = useToast()

  const handleStatusChange = async (worklogId: string, newStatus: string) => {
    setStatusChangeLoading(true)
    try {
      const res = await fetch(`/api/worklogs?id=${worklogId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        let errorMessage = "상태 변경에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        toast({
          title: "상태 변경 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const data = await res.json()

      // Update local state
      setWorklogs((prev) =>
        prev.map((w) =>
          w.id === worklogId
            ? { ...w, status: newStatus as WorkLog["status"], statusUpdatedAt: new Date().toISOString() }
            : w,
        ),
      )
      if (selectedWorklog?.id === worklogId) {
        setSelectedWorklog((prev) =>
          prev ? { ...prev, status: newStatus as WorkLog["status"], statusUpdatedAt: new Date().toISOString() } : null,
        )
      }

      toast({
        title: "상태 변경 완료",
        description: `상태가 "${getStatusLabel(newStatus)}"(으)로 변경되었습니다.`,
      })
    } catch (error) {
      console.error("[v0] Failed to change status:", error)
      toast({
        title: "상태 변경 실패",
        description: "상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setStatusChangeLoading(false)
    }
  }

  const handleSaveComment = async () => {
    if (!selectedWorklog) return

    setCommentSaveLoading(true)
    try {
      const res = await fetch(`/api/worklogs?id=${selectedWorklog.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commanderComment: editedComment }),
      })

      if (!res.ok) {
        let errorMessage = "답변 저장에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        toast({
          title: "저장 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const now = new Date().toISOString()

      // Update local state
      setWorklogs((prev) =>
        prev.map((w) =>
          w.id === selectedWorklog.id ? { ...w, commanderComment: editedComment, commanderCommentAt: now } : w,
        ),
      )
      setSelectedWorklog((prev) =>
        prev ? { ...prev, commanderComment: editedComment, commanderCommentAt: now } : null,
      )
      setEditingComment(false)

      toast({
        title: "저장 완료",
        description: "답변이 저장되었습니다.",
      })
    } catch (error) {
      console.error("[v0] Failed to save comment:", error)
      toast({
        title: "저장 실패",
        description: "답변 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setCommentSaveLoading(false)
    }
  }

  const handleEditComment = () => {
    setEditingComment(true)
    setEditedComment(selectedWorklog?.commanderComment || "")
  }

  const handleCancelEditComment = () => {
    setEditingComment(false)
    setEditedComment("")
  }

  const fetchWorklogs = async () => {
    try {
      setError("")
      const params = new URLSearchParams()
      if (fromDate) params.append("from", fromDate)
      if (toDate) params.append("to", toDate)
      params.append("page", page.toString())
      params.append("pageSize", pageSize.toString())

      const queryString = params.toString()
      const url = queryString ? `${apiEndpoint}?${queryString}` : apiEndpoint

      const res = await fetch(url)

      if (!res.ok) {
        let errorMessage = "근무일지 목록 조회에 실패했습니다."
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
      setWorklogs(data.worklogs || [])
      setTotalCount(data.totalCount || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error("[v0] Failed to fetch worklogs:", error)
      setError("근무일지 목록을 불러오는 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = () => {
    setPage(1)
    setLoading(true)
    fetchWorklogs()
  }

  const handleResetFilter = () => {
    setFromDate(getDefaultFromDate())
    setToDate(getDefaultToDate())
    setPage(1)
    setLoading(true)
  }

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1)
      setLoading(true)
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1)
      setLoading(true)
    }
  }

  const handleBulkImageDownload = async () => {
    if (totalCount === 0) {
      toast({
        title: "다운로드 실패",
        description: "다운로드할 근무일지가 없습니다.",
        variant: "destructive",
      })
      return
    }

    setBulkDownloadLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append("from", fromDate)
      if (toDate) params.append("to", toDate)

      const queryString = params.toString()
      const url = queryString ? `/api/worklogs/images-zip?${queryString}` : "/api/worklogs/images-zip"

      const response = await fetch(url)

      if (!response.ok) {
        let errorMessage = "이미지 다운로드에 실패했습니다."
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          // Response is not JSON
        }
        toast({
          title: "다운로드 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      // Download the ZIP file
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = "worklog_images.zip"
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      toast({
        title: "다운로드 완료",
        description: "근무일지 이미지가 다운로드되었습니다.",
      })
    } catch (error) {
      console.error("[v0] Bulk download error:", error)
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setBulkDownloadLoading(false)
    }
  }

  const downloadAllPhotos = async (worklog: WorkLog) => {
    setDownloadLoading(true)
    try {
      if (worklog.photoUrls.length === 0) {
        alert("다운로드할 사진이 없습니다.")
        return
      }

      for (let i = 0; i < worklog.photoUrls.length; i++) {
        const url = worklog.photoUrls[i]
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement("a")
        link.href = blobUrl
        link.download = `${worklog.id}_photo_${i + 1}.jpg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)

        if (i < worklog.photoUrls.length - 1) {
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

  const handleDelete = async (worklog: WorkLog) => {
    const confirmed = window.confirm(
      "삭제하면 근무일지 데이터와 첨부 사진이 모두 삭제되며 복구할 수 없습니다. 진행할까요?",
    )

    if (!confirmed) return

    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/worklogs?id=${worklog.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        let errorMessage = "삭제에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        toast({
          title: "삭제 실패",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const data = await res.json()

      if (data.failedPhotos && data.failedPhotos.length > 0) {
        toast({
          title: "일부 사진 삭제 실패",
          description: `${data.failedPhotos.length}개의 사진이 삭제되지 않았습니다.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "삭제 완료",
          description: "근무일지가 삭제되었습니다.",
        })
      }

      setWorklogs((prev) => prev.filter((w) => w.id !== worklog.id))
      setSelectedWorklog(null)
    } catch (error) {
      console.error("[v0] Failed to delete worklog:", error)
      toast({
        title: "삭제 실패",
        description: "근무일지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleEditMemo = (worklog: WorkLog) => {
    setEditingMemo(true)
    setEditedMemo(worklog.note || "")
  }

  const handleSaveMemo = async () => {
    if (!selectedWorklog) return

    setSaveLoading(true)
    try {
      const res = await fetch(`/api/worklogs?id=${selectedWorklog.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: editedMemo }),
      })

      if (!res.ok) {
        let errorMessage = "메모 수정에 실패했습니다."
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

      const data = await res.json()

      // Update local state
      setWorklogs((prev) => prev.map((w) => (w.id === selectedWorklog.id ? { ...w, note: editedMemo } : w)))
      setSelectedWorklog((prev) => (prev ? { ...prev, note: editedMemo } : null))
      setEditingMemo(false)

      toast({
        title: "수정 완료",
        description: "메모가 수정되었습니다.",
      })
    } catch (error) {
      console.error("[v0] Failed to update memo:", error)
      toast({
        title: "수정 실패",
        description: "메모 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingMemo(false)
    setEditedMemo("")
  }

  const canDelete = (worklog: WorkLog) => {
    if (!user) return false
    if (user.role === "COMMANDER") return true
    return worklog.authorId === user.username
  }

  useEffect(() => {
    fetchWorklogs()
  }, [page, fromDate, toDate]) // Re-fetch when date filters change (on reset)

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
        <Button onClick={fetchWorklogs} variant="outline" size="sm">
          다시 시도
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          필터 {showFilters ? "숨기기" : "보기"}
        </Button>

        {user?.role === "COMMANDER" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkImageDownload}
            disabled={bulkDownloadLoading || totalCount === 0}
          >
            {bulkDownloadLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            이미지 일괄 다운로드
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="fromDate" className="text-sm">
                시작일
              </Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2 flex-1">
              <Label htmlFor="toDate" className="text-sm">
                종료일
              </Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex gap-2 sm:flex-shrink-0">
              <Button onClick={handleApplyFilter} className="flex-1 sm:flex-initial">
                적용
              </Button>
              <Button onClick={handleResetFilter} variant="outline" className="flex-1 sm:flex-initial bg-transparent">
                초기화
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {user?.role === "COMMANDER" && "이미지 일괄 다운로드 시 ZIP 폴더명에 성능장명이 포함됩니다."}
          </p>
        </div>
      )}

      {worklogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {fromDate || toDate ? "해당 기간에 작성된 근무일지가 없습니다." : "아직 작성된 근무일지가 없습니다."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일지 ID</TableHead>
                  <TableHead>근무일자</TableHead>
                  <TableHead>작성자</TableHead>
                  <TableHead>성능장</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>사진 수</TableHead>
                  <TableHead>작성일시</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worklogs.map((worklog) => (
                  <TableRow key={worklog.id}>
                    <TableCell className="font-mono text-xs">{worklog.id.slice(0, 16)}...</TableCell>
                    <TableCell>{worklog.date}</TableCell>
                    <TableCell className="text-sm">{worklog.authorName || worklog.authorId}</TableCell>
                    <TableCell className="text-sm">{worklog.branchId || "-"}</TableCell>
                    <TableCell>
                      {user?.role === "COMMANDER" ? (
                        <Select
                          value={worklog.status || "pending"}
                          onValueChange={(value) => handleStatusChange(worklog.id, value)}
                          disabled={statusChangeLoading}
                        >
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">대기중</SelectItem>
                            <SelectItem value="approved">승인됨</SelectItem>
                            <SelectItem value="rejected">거부됨</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(worklog.status)
                      )}
                    </TableCell>
                    <TableCell>{worklog.photoUrls.length}장</TableCell>
                    <TableCell className="text-sm">{new Date(worklog.createdAt).toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedWorklog(worklog)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedWorklog(worklog)
                            handleEditMemo(worklog)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canDelete(worklog) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(worklog)}
                            disabled={deleteLoading}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              전체 {totalCount.toLocaleString()}건 중 {((page - 1) * pageSize + 1).toLocaleString()}-
              {Math.min(page * pageSize, totalCount).toLocaleString()}건 표시
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={page === 1 || loading}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              <div className="text-sm">
                {page} / {totalPages}
              </div>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={page >= totalPages || loading}>
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={selectedWorklog !== null}
        onOpenChange={() => {
          setSelectedWorklog(null)
          setEditingMemo(false)
          setEditingComment(false)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMemo ? "메모 수정" : "근무일지 상세"}</DialogTitle>
            <DialogDescription>
              {editingMemo ? "메모 내용을 수정할 수 있습니다." : "근무일지 정보를 확인할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>

          {selectedWorklog && (
            <div className="space-y-6">
              {editingMemo ? (
                <>
                  <div className="space-y-2">
                    <Label>메모</Label>
                    <Textarea
                      value={editedMemo}
                      onChange={(e) => setEditedMemo(e.target.value)}
                      placeholder="메모를 입력하세요"
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancelEdit} disabled={saveLoading}>
                      취소
                    </Button>
                    <Button onClick={handleSaveMemo} disabled={saveLoading}>
                      {saveLoading ? (
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
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">일지 ID</Label>
                      <p className="mt-1 text-sm font-mono">{selectedWorklog.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">근무일자</Label>
                      <p className="mt-1 text-sm">{selectedWorklog.date}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">작성자</Label>
                      <p className="mt-1 text-sm">{selectedWorklog.authorName || selectedWorklog.authorId}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">성능장</Label>
                      <p className="mt-1 text-sm">{selectedWorklog.branchId || "-"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">작성일시</Label>
                      <p className="mt-1 text-sm">{new Date(selectedWorklog.createdAt).toLocaleString("ko-KR")}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>상태</Label>
                      {selectedWorklog.statusUpdatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(selectedWorklog.statusUpdatedAt).toLocaleString("ko-KR")} 변경됨
                        </span>
                      )}
                    </div>
                    {user?.role === "COMMANDER" ? (
                      <Select
                        value={selectedWorklog.status || "pending"}
                        onValueChange={(value) => handleStatusChange(selectedWorklog.id, value)}
                        disabled={statusChangeLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-yellow-600" />
                              대기중
                            </div>
                          </SelectItem>
                          <SelectItem value="approved">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              승인됨
                            </div>
                          </SelectItem>
                          <SelectItem value="rejected">
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4 text-red-600" />
                              거부됨
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2">{getStatusBadge(selectedWorklog.status)}</div>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>커멘더 답변</Label>
                      {selectedWorklog.commanderCommentAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(selectedWorklog.commanderCommentAt).toLocaleString("ko-KR")} 작성됨
                        </span>
                      )}
                    </div>
                    {editingComment ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedComment}
                          onChange={(e) => setEditedComment(e.target.value)}
                          placeholder="답변을 입력하세요"
                          rows={4}
                          className="resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEditComment}
                            disabled={commentSaveLoading}
                          >
                            취소
                          </Button>
                          <Button size="sm" onClick={handleSaveComment} disabled={commentSaveLoading}>
                            {commentSaveLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                저장 중...
                              </>
                            ) : (
                              "저장"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {selectedWorklog.commanderComment ? (
                          <div className="rounded-lg border bg-blue-50 p-3">
                            <p className="text-sm whitespace-pre-wrap">{selectedWorklog.commanderComment}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">아직 답변이 없습니다.</p>
                        )}
                        {user?.role === "COMMANDER" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditComment}
                            className="mt-2 bg-transparent"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            {selectedWorklog.commanderComment ? "답변 수정" : "답변 작성"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedWorklog.note && (
                    <div className="space-y-2">
                      <Label>메모</Label>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <p className="text-sm whitespace-pre-wrap">{selectedWorklog.note}</p>
                      </div>
                    </div>
                  )}

                  {selectedWorklog.photoUrls && selectedWorklog.photoUrls.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>사진</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAllPhotos(selectedWorklog)}
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
                        {selectedWorklog.photoUrls.map((url, idx) => (
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
                                  `worklog_${selectedWorklog.id}_photo_${idx + 1}.${getFileExtension(url)}`,
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

                  {selectedWorklog.worklogPasteImageUrls && selectedWorklog.worklogPasteImageUrls.length > 0 && (
                    <div className="space-y-2">
                      <Label>붙여넣기 이미지 (근무일지)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedWorklog.worklogPasteImageUrls.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`붙여넣기 이미지 ${idx + 1}`}
                                className="w-full rounded-lg border object-contain hover:opacity-75 transition-opacity bg-muted"
                              />
                            </a>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                downloadImage(
                                  url,
                                  `worklog_${selectedWorklog.id}_paste_${idx + 1}.${getFileExtension(url)}`,
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

                  {canDelete(selectedWorklog) && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(selectedWorklog)}
                        disabled={deleteLoading}
                        className="w-full"
                      >
                        {deleteLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            삭제 중...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            근무일지 삭제
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
