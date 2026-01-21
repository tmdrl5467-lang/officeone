"use client"

import { SingleRefundForm } from "@/components/single-refund-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SingleRefundPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">단건 환불 청구</h1>
        <p className="text-muted-foreground">개별 환불 청구서를 작성하고 제출합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>환불 청구 정보</CardTitle>
          <CardDescription>고객 정보와 환불 상세 내역을 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <SingleRefundForm />
        </CardContent>
      </Card>
    </div>
  )
}
