"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { FileSpreadsheet, X, Loader2, Download } from "lucide-react"
import { useRouter } from "next/navigation"

export function BulkRefundForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [excelFile, setExcelFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check if it's an Excel file
      const isExcel =
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel" ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")

      if (!isExcel) {
        setError("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.")
        return
      }

      setExcelFile(file)
      setError("")
    }
  }

  const removeFile = () => {
    setExcelFile(null)
  }

  const downloadTemplate = () => {
    // This would download a template Excel file
    // For now, we'll just alert
    alert("엑셀 템플릿 다운로드 기능은 곧 제공됩니다.")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!excelFile) {
        throw new Error("엑셀 파일을 선택해주세요.")
      }

      // Upload Excel file
      const formData = new FormData()
      formData.append("file", excelFile)

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error("파일 업로드에 실패했습니다.")
      }

      const uploadData = await uploadRes.json()

      // Submit bulk refund request
      const refundData = {
        type: "bulk",
        excelFile: uploadData.url,
      }

      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refundData),
      })

      if (!res.ok) {
        const data = await res.json()

        if (
          res.status === 401 ||
          data.error?.includes("인증이 필요합니다") ||
          data.error?.includes("세션이 만료되었습니다")
        ) {
          alert("세션이 만료되었습니다. 다시 로그인해주세요.")
          router.push("/")
          return
        }

        throw new Error(data.error || "환불 청구 제출에 실패했습니다.")
      }

      // Success - redirect to dashboard
      router.push("/dashboard?success=bulk")
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>
            엑셀 파일 <span className="text-destructive">*</span>
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            템플릿 다운로드
          </Button>
        </div>

        {excelFile ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">{excelFile.name}</p>
              <p className="text-xs text-muted-foreground">{(excelFile.size / 1024).toFixed(2)} KB</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={removeFile} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 py-12 transition-colors hover:bg-muted">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <span className="mt-4 text-sm font-medium text-muted-foreground">엑셀 파일을 선택하거나 드래그하세요</span>
            <span className="mt-1 text-xs text-muted-foreground">.xlsx, .xls</span>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
          </label>
        )}

        <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">엑셀 파일 작성 가이드</p>
          <ul className="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
            <li>• 고객명, 주민등록번호, 전화번호, 보험사, 청구금액 컬럼이 필요합니다.</li>
            <li>• 첫 번째 행은 헤더로 사용됩니다.</li>
            <li>• 각 행은 하나의 환불 청구 건을 나타냅니다.</li>
          </ul>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          취소
        </Button>
        <Button type="submit" disabled={loading || !excelFile} className="flex-1">
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
  )
}
