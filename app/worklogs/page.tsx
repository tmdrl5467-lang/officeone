"use client"

import { useAuth } from "@/components/auth-provider"
import { WorkLogTable } from "@/components/worklog-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function WorkLogsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>로그인이 필요합니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">일일 근무일지</h1>
          <p className="text-muted-foreground">근무 일지를 작성하고 조회합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/worklog/create")} className="hidden sm:flex">
            <Plus className="mr-2 h-4 w-4" />
            일지 작성
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/worklog/create")} className="sm:hidden">
            <Plus className="h-4 w-4" />
          </Button>

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
          <CardDescription>
            {user.role === "BRANCH" ? "내가 작성한 근무일지 내역입니다." : "모든 근무일지 내역을 조회할 수 있습니다."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkLogTable />
        </CardContent>
      </Card>
    </div>
  )
}
