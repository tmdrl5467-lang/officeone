"use client"

import { BundledRefundForm } from "@/components/bundled-refund-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BundledRefundPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">묶음 환불 청구</h1>
        <p className="text-muted-foreground">엑셀 파일과 관련 사진들을 함께 제출합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>묶음 환불 청구</CardTitle>
          <CardDescription>엑셀 파일과 관련 사진을 함께 업로드하여 환불 청구를 제출하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <BundledRefundForm />
        </CardContent>
      </Card>
    </div>
  )
}
