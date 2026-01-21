import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { redis } from "@/lib/kv"
import type { User } from "@/lib/types"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (!sessionId) {
      return NextResponse.json({ user: null })
    }

    const user = await redis.get<User>(`session:${sessionId}`)

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Get user error:", error)
    return NextResponse.json({ user: null })
  }
}
