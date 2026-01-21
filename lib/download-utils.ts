export async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error("[v0] Failed to download image:", error)
    // Fallback: open in new tab
    window.open(url, "_blank")
  }
}

export function getFileExtension(url: string): string {
  const match = url.match(/\.([a-z0-9]+)(\?|$)/i)
  return match ? match[1] : "jpg"
}
