"use client"

import { useAuth } from "./auth-provider"
import { Home, FileText, ClipboardList, BookOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const { user } = useAuth()
  const pathname = usePathname()

  const navItems = [
    {
      title: "대시보드",
      href: "/dashboard",
      icon: Home,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "환불신청",
      href: "/refund/single",
      icon: FileText,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
    {
      title: "환불관리",
      href: "/refunds",
      icon: ClipboardList,
      roles: ["COMMANDER", "STAFF"],
    },
    {
      title: "근무일지",
      href: "/worklogs",
      icon: BookOpen,
      roles: ["COMMANDER", "STAFF", "BRANCH"],
    },
  ]

  const visibleNavItems = navItems.filter((item) => item.roles.includes(user?.role || ""))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
      <div className="flex items-center justify-around">
        {visibleNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.title}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
