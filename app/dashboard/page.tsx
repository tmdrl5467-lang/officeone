"use client"

import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FolderKanban, Settings, BookOpen, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

interface DashboardStats {
  totalCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  pendingAckCount: number
  acknowledgedCount: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === "COMMANDER" || user?.role === "STAFF" || user?.role === "MIDDLE_MANAGER") {
      fetchStats()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    {
      title: "단건 환불 청구",
      description: "개별 환불 청구서를 제출합니다",
      icon: FileText,
      href: "/refund/single",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "일괄 환불 청구",
      description: "같은 상사/계좌정보로 여러 건을 한 번에 청구",
      icon: FileText,
      href: "/refund/batch",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "일일 근무일지",
      description: "근무 내용을 기록하고 관리합니다",
      icon: BookOpen,
      href: "/worklogs",
      color: "text-green-600",
      bgColor: "bg-green-50",
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "내 환불 신청 목록",
      description: "제출한 환불 신청 내역을 확인합니다",
      icon: FolderKanban,
      href: "/branch/refunds",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      roles: ["BRANCH"],
    },
    {
      title: "환불건 관리",
      description: "제출된 환불 청구를 확인하고 처리합니다",
      icon: FolderKanban,
      href: "/refunds",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      roles: ["COMMANDER", "STAFF"],
    },
    {
      title: "환불건 관리 (장한평 제외)",
      description: "장한평을 제외한 환불 청구를 확인하고 처리합니다",
      icon: FolderKanban,
      href: "/middle-manager/refunds",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      roles: ["MIDDLE_MANAGER"],
    },
    {
      title: "근무일지 관리 (장한평 제외)",
      description: "장한평을 제외한 근무 일지를 조회합니다",
      icon: BookOpen,
      href: "/middle-manager/worklogs",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      roles: ["MIDDLE_MANAGER"],
    },
    {
      title: "환경설정",
      description: "시스템 설정 및 계정 관리",
      icon: Settings,
      href: "/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      roles: ["COMMANDER"],
    },
  ]

  const visibleActions = quickActions.filter((action) => action.roles.includes(user?.role || ""))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          환영합니다, {user?.name}님{user?.branchName ? ` (${user.branchName})` : ""}.
        </p>
      </div>

      {(user?.role === "COMMANDER" || user?.role === "STAFF" || user?.role === "MIDDLE_MANAGER") && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">대기중</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">승인됨</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">거부됨</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejectedCount}</div>
            </CardContent>
          </Card>
          <Link href="/refunds?filter=pending-ack">
            <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  반려 확인 대기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pendingAckCount}</div>
                <p className="text-xs text-muted-foreground mt-1">성능장 확인 필요</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleActions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.href} href={action.href}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2.5 ${action.bgColor}`}>
                      <Icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{action.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
