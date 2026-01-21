"use client"

import { useRef } from "react"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { Camera, ImagePlus, X } from "lucide-react"

interface PhotoPreview {
  id: string
  file: File
  preview: string
}

interface ImageUploadProps {
  photos: PhotoPreview[]
  onPhotosChange: (photos: PhotoPreview[]) => void
  disabled?: boolean
  label?: string
  required?: boolean
}

// Compress image before upload
async function compressImage(file: File, maxSize = 2000): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let { width, height } = img

        // Calculate new dimensions
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }))
            } else {
              resolve(file)
            }
          },
          "image/jpeg",
          0.9,
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function ImageUpload({ photos, onPhotosChange, disabled, label, required }: ImageUploadProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const compressedFiles = await Promise.all(Array.from(files).map((file) => compressImage(file)))

    const newPhotos: PhotoPreview[] = compressedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))

    onPhotosChange([...photos, ...newPhotos])
  }

  const removePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (photo) {
      URL.revokeObjectURL(photo.preview)
    }
    onPhotosChange(photos.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-3">
      {label && (
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {/* Photo previews */}
      <div className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative h-24 w-24">
            <img
              src={photo.preview || "/placeholder.svg"}
              alt="사진"
              className="h-full w-full rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-lg"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Upload buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1 bg-transparent"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
        >
          <Camera className="mr-2 h-4 w-4" />
          카메라로 찍기
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 bg-transparent"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          갤러리에서 선택
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      <p className="text-xs text-muted-foreground">사진을 여러 장 업로드할 수 있습니다. (자동 압축됨)</p>
    </div>
  )
}
