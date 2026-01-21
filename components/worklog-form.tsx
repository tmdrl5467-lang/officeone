"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { useAuth } from "./auth-provider"
import { ImageUpload } from "./image-upload"
import { Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface PhotoPreview {
  id: string
  file: File
  preview: string
}

interface PasteImagePreview {
  id: string
  dataUrl: string
  file: File
}

export function WorkLogForm() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [pasteImages, setPasteImages] = useState<PasteImagePreview[]>([])
  const pasteAreaRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      e.preventDefault()
      const items = e.clipboardData?.items
      if (!items) return

      let imageProcessed = false

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile()
          if (blob) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string
              const id = `paste-${Date.now()}-${Math.random()}`
              const file = new File([blob], `paste-${Date.now()}.png`, { type: "image/png" })

              setPasteImages((prev) => [...prev, { id, dataUrl, file }])
              toast({ description: "이미지가 추가되었습니다." })
            }
            reader.readAsDataURL(blob)
            imageProcessed = true
            break
          }
        }
      }

      if (imageProcessed) return

      let htmlContent = ""
      for (const item of Array.from(items)) {
        if (item.type === "text/html") {
          htmlContent = await new Promise((resolve) => {
            item.getAsString((str) => resolve(str))
          })
          break
        } else if (item.type === "text/plain" && !htmlContent) {
          htmlContent = await new Promise((resolve) => {
            item.getAsString((str) =>
              resolve(`<pre style="white-space: pre-wrap; font-family: sans-serif;">${str}</pre>`),
            )
          })
        }
      }

      if (htmlContent) {
        convertHtmlToImage(htmlContent)
      }
    },
    [toast],
  )

  const convertHtmlToImage = async (html: string) => {
    try {
      const container = document.createElement("div")
      container.style.position = "absolute"
      container.style.left = "-9999px"
      container.style.top = "0"
      container.style.background = "white"
      container.style.padding = "20px"
      container.style.maxWidth = "800px"
      container.innerHTML = html

      document.body.appendChild(container)

      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
      })

      document.body.removeChild(container)

      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            const id = `paste-${Date.now()}-${Math.random()}`
            const file = new File([blob], `paste-${Date.now()}.png`, { type: "image/png" })

            setPasteImages((prev) => [...prev, { id, dataUrl, file }])
            toast({ description: "붙여넣기 내용이 이미지로 변환되었습니다." })
          }
          reader.readAsDataURL(blob)
        }
      }, "image/png")
    } catch (err) {
      console.error("[v0] Error converting to image:", err)
      toast({ description: "이미지 변환에 실패했습니다.", variant: "destructive" })
    }
  }

  const removePasteImage = (id: string) => {
    setPasteImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!formData.date) {
        throw new Error("근무일자를 선택해주세요.")
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

      const worklogPasteImageUrls: string[] = []
      for (const pasteImg of pasteImages) {
        const formDataObj = new FormData()
        formDataObj.append("file", pasteImg.file)

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formDataObj,
        })

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text()
          throw new Error(errorText || "붙여넣기 이미지 업로드에 실패했습니다.")
        }

        const uploadData = await uploadRes.json()
        worklogPasteImageUrls.push(uploadData.url)
      }

      const workLogData = {
        date: formData.date,
        note: formData.note || undefined,
        photoUrls,
        worklogPasteImageUrls: worklogPasteImageUrls.length > 0 ? worklogPasteImageUrls : undefined,
      }

      const res = await fetch("/api/worklogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workLogData),
      })

      if (!res.ok) {
        let errorMessage = "근무일지 제출에 실패했습니다."
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          const text = await res.text()
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }

      router.push("/worklogs?success=created")
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="date">
          근무일자 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="date"
          name="date"
          type="date"
          value={formData.date}
          onChange={handleInputChange}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">메모 (선택)</Label>
        <Textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleInputChange}
          placeholder="근무 내용이나 특이사항을 입력하세요"
          rows={4}
          disabled={loading}
        />
      </div>

      <ImageUpload photos={photos} onPhotosChange={setPhotos} disabled={loading} label="사진 업로드 (선택)" />

      <div className="space-y-2">
        <Label>붙여넣기 이미지 (선택)</Label>
        <p className="text-sm text-muted-foreground">
          엑셀에서 복사한 내용을 아래 영역에 붙여넣으면 자동으로 이미지로 변환됩니다.
        </p>

        <div
          ref={pasteAreaRef}
          onPaste={handlePaste}
          contentEditable={!loading}
          suppressContentEditableWarning
          className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ outline: "none" }}
        >
          <span className="text-muted-foreground">여기에 붙여넣기 (Ctrl+V)</span>
        </div>

        {pasteImages.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">변환된 이미지 ({pasteImages.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pasteImages.map((img) => (
                <div key={img.id} className="relative group rounded-md border overflow-hidden">
                  <img src={img.dataUrl || "/placeholder.svg"} alt="붙여넣기 이미지" className="w-full h-auto" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removePasteImage(img.id)}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
            "근무일지 제출"
          )}
        </Button>
      </div>
    </form>
  )
}
