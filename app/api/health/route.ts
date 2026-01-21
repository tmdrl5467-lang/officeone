import { NextResponse } from "next/server"
import { redis } from "@/lib/kv"

export async function GET() {
  try {
    // Test Redis connection with a simple ping
    await redis.ping()
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("[v0] Health check failed:", error)
    return NextResponse.json({ status: "error", message: "Database connection failed" }, { status: 500 })
  }
}
