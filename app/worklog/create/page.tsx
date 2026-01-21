"use client"

import { WorkLogForm } from "@/components/worklog-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CreateWorkLogPage() {
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
    return null
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">일일 근무일지 작성</h1>
        <p className="text-muted-foreground">오늘의 근무 내용을 기록합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>근무일지 정보</CardTitle>
          <CardDescription>근무일자와 사진을 첨부하여 제출하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkLogForm />
        </CardContent>
      </Card>
    </div>
  )
}
