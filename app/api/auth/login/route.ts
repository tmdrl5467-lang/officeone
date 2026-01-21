import { type NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import { cookies } from "next/headers"
import { findAuthUser } from "@/lib/auth-users"
import { hashPassword, verifyPassword, isPasswordHashed } from "@/lib/password"

function normalizeUsername(input: string): string {
  const match = input.match(/(a\d{4})/)
  if (match) {
    return match[1]
  }
  return input.trim().replace(/[\s-]+/g, "")
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 })
    }

    const normalizedUsername = normalizeUsername(username)

    const authUser = findAuthUser(normalizedUsername)

    if (!authUser) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
    }

    let user = await redis.get<{
      password: string
      role: string
      name: string
      branchName?: string
      mustChangePassword?: boolean
    }>(`user:${normalizedUsername}`)

    // If user doesn't exist in Redis, create with hashed password
    if (!user) {
      const hashedPassword = await hashPassword(authUser.password)
      user = {
        password: hashedPassword,
        role: authUser.role,
        name: authUser.name,
        branchName: authUser.branchName,
        mustChangePassword: authUser.username === "a0020",
      }
      await redis.set(`user:${normalizedUsername}`, user)
    } else {
      user.name = authUser.name
      user.branchName = authUser.branchName
      user.role = authUser.role
      await redis.set(`user:${normalizedUsername}`, user)
    }

    const isValidPassword = isPasswordHashed(user.password)
      ? await verifyPassword(password, user.password)
      : password === user.password

    if (!isPasswordHashed(user.password) && password === user.password) {
      const hashedPassword = await hashPassword(password)
      user.password = hashedPassword
      await redis.set(`user:${normalizedUsername}`, user)
    }

    if (!isValidPassword) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
    }

    const sessionId = crypto.randomUUID()
    const sessionData = {
      username: normalizedUsername,
      role: user.role,
      name: user.name,
      branchName: user.branchName,
      mustChangePassword: user.mustChangePassword || false,
    }

    const ttl = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60
    await redis.setex(`session:${sessionId}`, ttl, sessionData)

    const cookieStore = await cookies()
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ttl,
      path: "/",
    })

    return NextResponse.json({
      success: true,
      user: {
        username: normalizedUsername,
        role: user.role,
        name: user.name,
        branchName: user.branchName,
        mustChangePassword: user.mustChangePassword || false,
      },
    })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
