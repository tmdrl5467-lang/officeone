import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { redis } from "@/lib/kv"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (sessionId) {
      // Delete session from KV
      await redis.del(`session:${sessionId}`)
    }

    // Clear cookie
    cookieStore.delete("session")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: "로그아웃 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
