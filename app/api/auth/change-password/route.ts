import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import { hashPassword, verifyPassword } from "@/lib/password"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (!sessionId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const sessionData = await redis.get<{
      username: string
      role: string
      name: string
      branchName?: string
      mustChangePassword?: boolean
    }>(`session:${sessionId}`)

    if (!sessionData) {
      return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호를 입력해주세요." }, { status: 400 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: "새 비밀번호는 최소 4자 이상이어야 합니다." }, { status: 400 })
    }

    const user = await redis.get<{
      password: string
      role: string
      name: string
      branchName?: string
      mustChangePassword?: boolean
    }>(`user:${sessionData.username}`)

    if (!user) {
      return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 404 })
    }

    const isValidPassword = await verifyPassword(currentPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 })
    }

    const hashedNewPassword = await hashPassword(newPassword)
    user.password = hashedNewPassword
    user.mustChangePassword = false

    await redis.set(`user:${sessionData.username}`, user)

    // Update session
    sessionData.mustChangePassword = false
    const ttl = await redis.ttl(`session:${sessionId}`)
    await redis.setex(`session:${sessionId}`, ttl > 0 ? ttl : 7 * 24 * 60 * 60, sessionData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Change password error:", error)
    return NextResponse.json({ error: "비밀번호 변경 중 오류가 발생했습니다." }, { status: 500 })
  }
}
