"use client"

import { useAuth } from "@/components/auth-provider"
import { WorkLogTable } from "@/components/worklog-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MiddleManagerWorkLogsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "MIDDLE_MANAGER")) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!user || user.role !== "MIDDLE_MANAGER") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>중간관리자 권한이 필요합니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">일일 근무일지 (장한평 제외)</h1>
          <p className="text-muted-foreground">장한평 성능장을 제외한 근무 일지를 조회합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="hidden sm:flex">
            <Home className="mr-2 h-4 w-4" />
            대시보드
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard")} className="sm:hidden">
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>근무일지 목록</CardTitle>
          <CardDescription>장한평 성능장을 제외한 모든 근무일지 내역을 조회할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkLogTable apiEndpoint="/api/middle-manager/worklogs" />
        </CardContent>
      </Card>
    </div>
  )
}
