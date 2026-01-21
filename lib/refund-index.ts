import { redis } from "@/lib/kv"
import type { RefundRequest } from "@/lib/types"

// Add refund to LIST indexes
export async function addToIndexes(refund: RefundRequest): Promise<void> {
  const id = refund.id
  // Add to main index
  await redis.lpush("refunds:index", id)
}

// Remove refund from all indexes
export async function removeFromAllIndexes(refundId: string): Promise<void> {
  await redis.lrem("refunds:index", 0, refundId)
}

// Update indexes when status changes (no-op for LIST-based approach)
export async function updateStatusIndexes(
  refundId: string,
  oldStatus: string,
  newStatus: string,
  score: number,
): Promise<void> {
  // No index changes needed for status in LIST-based approach
  // Status filtering happens at query time
}

export async function getRefundIdsFromIndex(
  status?: string,
  page = 1,
  pageSize = 20,
): Promise<{ ids: string[]; totalCount: number }> {
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1

  // No status filter: fetch only the page range
  if (!status || status === "all") {
    const totalCount = (await redis.llen("refunds:index")) || 0
    const ids = (await redis.lrange("refunds:index", start, end)) as string[]
    return { ids: ids || [], totalCount }
  }

  const windowSize = 250
  const maxWindows = 10
  const allMatchedIds: string[] = []
  let currentWindow = 0

  while (currentWindow < maxWindows) {
    const windowStart = currentWindow * windowSize
    const windowEnd = windowStart + windowSize - 1

    const windowIds = (await redis.lrange("refunds:index", windowStart, windowEnd)) as string[]

    if (!windowIds || windowIds.length === 0) break

    // Fetch refund data for this window
    const pipeline = redis.pipeline()
    windowIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    // Filter by status
    const matchedIds = results.filter((r): r is RefundRequest => r !== null && r.status === status).map((r) => r.id)

    allMatchedIds.push(...matchedIds)

    // If we got fewer IDs than window size, we've reached the end
    if (windowIds.length < windowSize) break

    currentWindow++
  }

  const totalCount = allMatchedIds.length
  const pageStart = (page - 1) * pageSize
  const pageEnd = pageStart + pageSize
  const pageIds = allMatchedIds.slice(pageStart, pageEnd)

  return { ids: pageIds, totalCount }
}

export async function getRefundIdsWithFilters(
  status: string | null,
  fromDate?: string,
  toDate?: string,
  submitter?: string,
  companyName?: string,
  page = 1,
  pageSize = 20,
): Promise<{ ids: string[]; totalCount: number; hasMore: boolean }> {
  const pageStart = (page - 1) * pageSize
  const pageEnd = pageStart + pageSize

  // Window-based filtering approach
  const windowSize = 250
  const maxWindows = 10
  const allMatchedIds: string[] = []
  let currentWindow = 0

  while (currentWindow < maxWindows) {
    const windowStart = currentWindow * windowSize
    const windowEnd = windowStart + windowSize - 1

    const windowIds = (await redis.lrange("refunds:index", windowStart, windowEnd)) as string[]

    if (!windowIds || windowIds.length === 0) break

    // Fetch refund data for this window
    const pipeline = redis.pipeline()
    windowIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    // Filter refunds
    const filtered = results.filter((refund): refund is RefundRequest => {
      if (!refund) return false

      // Status filter
      if (status && status !== "all" && refund.status !== status) return false

      // Date filter
      if (fromDate) {
        const refundTime = new Date(refund.submittedAt).getTime()
        const fromTime = new Date(fromDate).getTime()
        if (refundTime < fromTime) return false
      }

      if (toDate) {
        const refundTime = new Date(refund.submittedAt).getTime()
        const toTime = new Date(toDate).setHours(23, 59, 59, 999)
        if (refundTime > toTime) return false
      }

      // Submitter filter
      if (submitter && refund.submittedBy !== submitter) return false

      // Company name filter
      if (companyName) {
        const company = (refund.companyName || refund.insuranceCompany || "").toLowerCase()
        if (!company.includes(companyName.toLowerCase())) return false
      }

      return true
    })

    allMatchedIds.push(...filtered.map((r) => r.id))

    // If we got fewer IDs than window size, we've reached the end
    if (windowIds.length < windowSize) break

    currentWindow++
  }

  const totalCount = allMatchedIds.length
  const ids = allMatchedIds.slice(pageStart, pageEnd)
  const hasMore = pageEnd < totalCount

  return { ids, totalCount, hasMore }
}

// Helper: Get timestamp score from refund (kept for compatibility)
export function getRefundScore(refund: RefundRequest): number {
  const dateStr = refund.refundDate || refund.submittedAt
  return new Date(dateStr).getTime()
}

export async function getRefundIdsExcludingBranch(
  excludeBranch: string,
  status?: string,
  fromDate?: string,
  toDate?: string,
  submitter?: string,
  companyName?: string,
  page = 1,
  pageSize = 20,
): Promise<{ ids: string[]; totalCount: number }> {
  const windowSize = 250
  const maxWindows = 10
  const allMatchedIds: string[] = []
  let currentWindow = 0

  while (currentWindow < maxWindows) {
    const windowStart = currentWindow * windowSize
    const windowEnd = windowStart + windowSize - 1

    const windowIds = (await redis.lrange("refunds:index", windowStart, windowEnd)) as string[]

    if (!windowIds || windowIds.length === 0) break

    // Fetch refund data for this window using pipeline
    const pipeline = redis.pipeline()
    windowIds.forEach((id) => pipeline.get(`refund:${id}`))
    const results = (await pipeline.exec()) as (RefundRequest | null)[]

    // Filter refunds: exclude branch + apply other filters
    const filtered = results.filter((refund): refund is RefundRequest => {
      if (!refund) return false

      // Exclude specific branch
      if (refund.submittedByBranch === excludeBranch) return false

      // Status filter
      if (status && status !== "all" && refund.status !== status) return false

      // Date filter
      if (fromDate) {
        const refundTime = new Date(refund.submittedAt).getTime()
        const fromTime = new Date(fromDate).getTime()
        if (refundTime < fromTime) return false
      }

      if (toDate) {
        const refundTime = new Date(refund.submittedAt).getTime()
        const toTime = new Date(toDate).setHours(23, 59, 59, 999)
        if (refundTime > toTime) return false
      }

      // Submitter filter
      if (submitter && refund.submittedBy !== submitter) return false

      // Company name filter
      if (companyName) {
        const company = (refund.companyName || refund.insuranceCompany || "").toLowerCase()
        if (!company.includes(companyName.toLowerCase())) return false
      }

      return true
    })

    allMatchedIds.push(...filtered.map((r) => r.id))

    // If we got fewer IDs than window size, we've reached the end
    if (windowIds.length < windowSize) break

    currentWindow++
  }

  // Apply pagination after collecting all matched IDs
  const totalCount = allMatchedIds.length
  const pageStart = (page - 1) * pageSize
  const pageEnd = pageStart + pageSize
  const pageIds = allMatchedIds.slice(pageStart, pageEnd)

  return { ids: pageIds, totalCount }
}
