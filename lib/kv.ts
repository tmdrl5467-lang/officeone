import { Redis } from "@upstash/redis"

const url = process.env.KV_REST_API_URL || process.env.KV_REST_API_URL
const token = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN

if (!url || !token) {
  throw new Error("Missing Redis configuration. Please set KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN")
}

// Log which configuration is being used (once at startup)
if (process.env.KV_REST_API_URL) {
  console.log("[KV Backend] Using KV_REST_API_URL")
} else if (process.env.KV_REST_API_URL) {
  console.log("[KV Backend] Using UPSTASH_REDIS_REST_URL")
}

const redis = new Redis({
  url,
  token,
})

export { redis }
