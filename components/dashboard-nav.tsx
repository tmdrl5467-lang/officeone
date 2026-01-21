"use client"

import { useAuth } from "./auth-provider"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { Home, FileText, Settings, LogOut, Menu, X, ClipboardList, BookOpen, List } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

export function DashboardNav() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    {
      title: "대시보드",
      href: "/dashboard",
      icon: Home,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "단건 환불",
      href: "/refund/single",
      icon: FileText,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "일괄 환불",
      href: "/refund/batch",
      icon: List,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "일일 근무일지",
      href: "/worklogs",
      icon: BookOpen,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "환불건 관리",
      href: "/refunds",
      icon: ClipboardList,
      roles: ["COMMANDER", "STAFF"],
    },
  ]

  const visibleNavItems = navItems.filter((item) => item.roles.includes(user?.role || ""))

  const handleLogout = async () => {
    await logout()
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col min-h-[100dvh] lg:min-h-0">
          {/* Header */}
          <div className="border-b p-6 flex-shrink-0">
            <h2 className="text-xl font-bold">성능오피스원</h2>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
            {user?.branchName && <p className="text-xs text-muted-foreground">({user.branchName})</p>}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto lg:overflow-visible">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <div key={item.href}>
                  <Link href={item.href} onClick={() => setMobileOpen(false)}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                  </Link>
                  {item.href === "/worklogs" && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 px-3 py-2 h-auto text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={async () => {
                        setMobileOpen(false)
                        await handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </Button>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-4 space-y-1 flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:pb-4">
            {user?.role === "COMMANDER" && (
              <Button variant="ghost" className="w-full justify-start gap-3" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  환경설정
                </Link>
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
