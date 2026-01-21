import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const branchMapping: Record<string, string> = {
  a0001: "울산",
  a0002: "kc",
  a0003: "전주오토월드",
  a0004: "광주풍암",
  a0005: "광주오토파크",
  a0006: "장한평",
  a0007: "포항1번지",
  a0008: "진주일번지",
  a0009: "진주오토원",
  a0010: "사천용당",
  a0011: "마산중부",
  a0012: "천차만차",
  a0013: "김해모터스",
  a0014: "동김해",
  a0015: "김해진영",
  a0016: "sk원카",
  a0017: "거제",
  a0018: "영천",
  a0019: "순천용당",
}

async function createUsers() {
  console.log("[v0] Creating users for 명월AI...")

  await redis.set("user:tmdrl5467", {
    password: "1111",
    role: "COMMANDER",
    name: "총괄담당자",
  })
  console.log("[v0] ✓ Commander created: tmdrl5467")

  await redis.set("user:tjdsmd1234", {
    password: "tjdsmd1!",
    role: "STAFF",
    name: "직원",
  })
  console.log("[v0] ✓ Staff created: tjdsmd1234")

  await redis.set("user:jg1234", {
    password: "tjdsmd1!",
    role: "MIDDLE_MANAGER",
    name: "중간관리자",
  })
  console.log("[v0] ✓ Middle Manager created: jg1234")

  for (const [branchId, branchName] of Object.entries(branchMapping)) {
    await redis.set(`user:${branchId}`, {
      password: "1234",
      role: "BRANCH",
      name: branchName,
      branchName: branchName,
    })
    console.log(`[v0] ✓ Branch created: ${branchId} (${branchName})`)
  }

  console.log("\n[v0] ========================================")
  console.log("[v0] 모든 계정 생성 완료!")
  console.log("[v0] ========================================")
  console.log("[v0] 총괄담당자: tmdrl5467 / 1111")
  console.log("[v0] 직원: tjdsmd1234 / tjdsmd1!")
  console.log("[v0] 중간관리자: jg1234 / tjdsmd1!") // Added log
  console.log("[v0] 성능장 (a0001~a0019): 비밀번호 1234 통일")
  console.log("[v0] ========================================")
}

createUsers()
