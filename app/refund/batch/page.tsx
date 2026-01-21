"use client"

import { BatchRefundForm } from "@/components/batch-refund-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BatchRefundPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">일괄 환불 청구</h1>
        <p className="text-muted-foreground">같은 상사 및 계좌 정보로 여러 건의 환불을 한번에 청구합니다.</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">사용 방법</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. 공통 정보(보험사, 상사명, 환불수단, 계좌정보)를 입력하세요.</p>
          <p>2. 각 라인에 환불신청일자, 차량번호, 금액, 사유, 사진을 입력하세요.</p>
          <p>3. [추가하기] 버튼으로 라인을 추가하거나 [복사] 버튼으로 기존 라인을 복제할 수 있습니다.</p>
          <p className="text-muted-foreground">※ 복사 시 차량번호와 사진은 제외되며, 직접 입력해야 합니다.</p>
        </CardContent>
      </Card>

      <BatchRefundForm />
    </div>
  )
}
