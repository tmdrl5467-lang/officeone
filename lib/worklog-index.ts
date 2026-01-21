import { redis } from "@/lib/kv"
import type { WorkLog } from "@/lib/types"

export async function getWorklogIdsExcludingBranch(
  excludeBranch: string,
  fromDate?: string,
  toDate?: string,
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

    const windowIds = (await redis.lrange("worklogs:index", windowStart, windowEnd)) as string[]

    if (!windowIds || windowIds.length === 0) break

    // Fetch worklog data for this window using pipeline
    const pipeline = redis.pipeline()
    windowIds.forEach((id) => pipeline.get(`worklog:${id}`))
    const results = (await pipeline.exec()) as (WorkLog | null)[]

    // Filter worklogs: exclude branch + apply date filters
    const filtered = results.filter((worklog): worklog is WorkLog => {
      if (!worklog) return false

      // Exclude specific branch
      if (worklog.branchId === excludeBranch) return false

      // Date filter
      const worklogDate = worklog.date
      if (!worklogDate) return false

      if (fromDate && worklogDate < fromDate) return false
      if (toDate && worklogDate > toDate) return false

      return true
    })

    allMatchedIds.push(...filtered.map((w) => w.id))

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
