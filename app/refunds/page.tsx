"use client"

import { useAuth } from "@/components/auth-provider"
import { RefundManagementTable } from "@/components/refund-management-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function RefundsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      if (user.role !== "COMMANDER" && user.role !== "STAFF" && user.role !== "MIDDLE_MANAGER") {
        router.push("/dashboard")
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!user || (user.role !== "COMMANDER" && user.role !== "STAFF" && user.role !== "MIDDLE_MANAGER")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>이 페이지에 접근할 권한이 없습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">환불건 관리</h1>
          <p className="text-muted-foreground">제출된 환불 청구를 확인하고 처리합니다.</p>
        </div>
        <div className="flex gap-2">
          {/* Desktop version */}
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="hidden sm:flex">
            <Home className="mr-2 h-4 w-4" />
            대시보드
          </Button>
          {/* Mobile version - icon only */}
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard")} className="sm:hidden">
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>환불 청구 목록</CardTitle>
          <CardDescription>모든 환불 청구 내역을 관리할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <RefundManagementTable />
        </CardContent>
      </Card>
    </div>
  )
}
