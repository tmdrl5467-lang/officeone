"use client"

import { BulkRefundForm } from "@/components/bulk-refund-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BulkRefundPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">다건 환불 청구</h1>
        <p className="text-muted-foreground">엑셀 파일로 여러 건의 환불 청구를 한번에 제출합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>다건 환불 청구</CardTitle>
          <CardDescription>엑셀 파일을 업로드하여 여러 건의 환불 청구를 제출하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <BulkRefundForm />
        </CardContent>
      </Card>
    </div>
  )
}
