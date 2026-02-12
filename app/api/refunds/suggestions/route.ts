import { NextResponse } from "next/server"
import { redis } from "@/lib/kv"
import type { RefundRequest } from "@/lib/types"

export async function GET() {
  try {
    const companyNames = new Set<string>()
    const dealerNames = new Set<string>()

    const BATCH_SIZE = 100
    const MAX_BATCHES = 10

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const start = batch * BATCH_SIZE
      const end = start + BATCH_SIZE - 1

      const ids = (await redis.lrange("refunds:index", start, end)) as string[]
      if (!ids || ids.length === 0) break

      const pipeline = redis.pipeline()
      ids.forEach((id) => pipeline.get(`refund:${id}`))

      try {
        const results = (await pipeline.exec()) as (RefundRequest | null)[]

        for (const refund of results) {
          if (!refund) continue
          if (refund.companyName) companyNames.add(refund.companyName.trim())
          if (refund.dealerName) dealerNames.add(refund.dealerName.trim())
        }
      } catch {
        // Pipeline error - continue with next batch
      }

      if (ids.length < BATCH_SIZE) break

      // Small delay between batches
      if (batch + 1 < MAX_BATCHES) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    return NextResponse.json({
      companyNames: Array.from(companyNames).sort(),
      dealerNames: Array.from(dealerNames).sort(),
    })
  } catch (error) {
    console.error("Suggestions API error:", error)
    return NextResponse.json({ companyNames: [], dealerNames: [] })
  }
}
