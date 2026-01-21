import { redis } from "@/lib/kv"
import type { RefundRequest } from "@/lib/types"
import { getRefundScore } from "@/lib/refund-index"

async function migrateRefundsToZset() {
  console.log("[Migration] Starting refund ZSET migration...")

  try {
    // Get all refund IDs from old index
    const allIds = (await redis.lrange("refunds:index", 0, -1)) as string[]
    console.log(`[Migration] Found ${allIds.length} refunds to migrate`)

    if (allIds.length === 0) {
      console.log("[Migration] No refunds to migrate")
      return
    }

    // Fetch all refunds
    const pipeline = redis.pipeline()
    allIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    const refunds: RefundRequest[] = results.filter((r): r is RefundRequest => r !== null)
    console.log(`[Migration] Successfully fetched ${refunds.length} refunds`)

    // Build ZSET indexes
    const allScores: { score: number; member: string }[] = []
    const pendingScores: { score: number; member: string }[] = []
    const approvedScores: { score: number; member: string }[] = []
    const rejectedScores: { score: number; member: string }[] = []

    for (const refund of refunds) {
      const score = getRefundScore(refund)
      const member = refund.id

      allScores.push({ score, member })

      if (refund.status === "pending") {
        pendingScores.push({ score, member })
      } else if (refund.status === "approved") {
        approvedScores.push({ score, member })
      } else if (refund.status === "rejected") {
        rejectedScores.push({ score, member })
      }
    }

    // Add to ZSET indexes in batches
    const BATCH_SIZE = 100

    console.log(`[Migration] Adding ${allScores.length} entries to refunds:z:all...`)
    for (let i = 0; i < allScores.length; i += BATCH_SIZE) {
      const batch = allScores.slice(i, i + BATCH_SIZE)
      await redis.zadd("refunds:z:all", ...batch)
    }

    console.log(`[Migration] Adding ${pendingScores.length} entries to refunds:z:pending...`)
    for (let i = 0; i < pendingScores.length; i += BATCH_SIZE) {
      const batch = pendingScores.slice(i, i + BATCH_SIZE)
      await redis.zadd("refunds:z:pending", ...batch)
    }

    console.log(`[Migration] Adding ${approvedScores.length} entries to refunds:z:approved...`)
    for (let i = 0; i < approvedScores.length; i += BATCH_SIZE) {
      const batch = approvedScores.slice(i, i + BATCH_SIZE)
      await redis.zadd("refunds:z:approved", ...batch)
    }

    console.log(`[Migration] Adding ${rejectedScores.length} entries to refunds:z:rejected...`)
    for (let i = 0; i < rejectedScores.length; i += BATCH_SIZE) {
      const batch = rejectedScores.slice(i, i + BATCH_SIZE)
      await redis.zadd("refunds:z:rejected", ...batch)
    }

    console.log("[Migration] Migration completed successfully!")
    console.log(`[Migration] Summary:`)
    console.log(`  - Total: ${allScores.length}`)
    console.log(`  - Pending: ${pendingScores.length}`)
    console.log(`  - Approved: ${approvedScores.length}`)
    console.log(`  - Rejected: ${rejectedScores.length}`)
  } catch (error) {
    console.error("[Migration] Migration failed:", error)
    throw error
  }
}

// Run migration
migrateRefundsToZset()
  .then(() => {
    console.log("[Migration] Script finished")
    process.exit(0)
  })
  .catch((error) => {
    console.error("[Migration] Script failed:", error)
    process.exit(1)
  })
