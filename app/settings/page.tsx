"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { branchAccounts } from "@/lib/auth-users"

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "error">("checking")

  useEffect(() => {
    if (!loading && user?.role !== "COMMANDER") {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  useEffect(() => {
    // Check system health
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health")
        if (res.ok) {
          setHealthStatus("ok")
        } else {
          setHealthStatus("error")
        }
      } catch {
        setHealthStatus("error")
      }
    }
    checkHealth()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!user || user.role !== "COMMANDER") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>이 페이지는 총괄담당자만 접근할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">환경설정</h1>
        <p className="text-muted-foreground">시스템 설정 및 계정 관리</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>계정 정보</CardTitle>
          <CardDescription>현재 로그인한 계정의 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">아이디</p>
            <p className="mt-1">{user.username}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">이름</p>
            <p className="mt-1">{user.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">권한</p>
            <p className="mt-1">
              {user.role === "COMMANDER"
                ? "총괄담당자"
                : user.role === "STAFF"
                  ? "직원"
                  : user.role === "BRANCH"
                    ? "성능장"
                    : "사용자"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>시스템 상태</CardTitle>
          <CardDescription>데이터베이스 및 시스템 연결 상태</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">데이터베이스 연결</span>
            <Badge variant={healthStatus === "ok" ? "default" : healthStatus === "error" ? "destructive" : "secondary"}>
              {healthStatus === "ok" ? "정상" : healthStatus === "error" ? "오류" : "확인 중..."}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">버전 2.0.0</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>성능장 계정 매핑</CardTitle>
          <CardDescription>등록된 성능장 계정 목록 (읽기 전용)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>계정 ID</TableHead>
                <TableHead>성능장명</TableHead>
                <TableHead>비밀번호</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchAccounts.map((account) => (
                <TableRow key={account.username}>
                  <TableCell className="font-mono text-sm">{account.username}</TableCell>
                  <TableCell>{account.branchName}</TableCell>
                  <TableCell className="text-muted-foreground">••••</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
