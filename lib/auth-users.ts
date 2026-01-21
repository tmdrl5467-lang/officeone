// Hardcoded user accounts for the system
export interface AuthUser {
  username: string
  password: string
  role: "COMMANDER" | "STAFF" | "BRANCH" | "MIDDLE_MANAGER" // Added MIDDLE_MANAGER role
  name: string
  branchName?: string
}

export const AUTH_USERS: AuthUser[] = [
  // Commander
  {
    username: "tmdrl5467",
    password: "1111",
    role: "COMMANDER",
    name: "커멘더",
  },
  // Staff
  {
    username: "tjdsmd1234",
    password: "tjdsmd1!",
    role: "STAFF",
    name: "직원",
  },
  {
    username: "jg1234",
    password: "tjdsmd1!",
    role: "MIDDLE_MANAGER",
    name: "중간관리자",
  },
  // Branch accounts (all with password "1234")
  {
    username: "a0001",
    password: "1234",
    role: "BRANCH",
    name: "울산 성능장",
    branchName: "울산",
  },
  {
    username: "a0002",
    password: "1234",
    role: "BRANCH",
    name: "kc 성능장",
    branchName: "kc",
  },
  {
    username: "a0003",
    password: "1234",
    role: "BRANCH",
    name: "전주오토월드 성능장",
    branchName: "전주오토월드",
  },
  {
    username: "a0004",
    password: "1234",
    role: "BRANCH",
    name: "광주풍암 성능장",
    branchName: "광주풍암",
  },
  {
    username: "a0005",
    password: "1234",
    role: "BRANCH",
    name: "광주오토파크 성능장",
    branchName: "광주오토파크",
  },
  {
    username: "a0006",
    password: "1234",
    role: "BRANCH",
    name: "장한평 성능장",
    branchName: "장한평",
  },
  {
    username: "a0007",
    password: "1234",
    role: "BRANCH",
    name: "포항1번지 성능장",
    branchName: "포항1번지",
  },
  {
    username: "a0008",
    password: "1234",
    role: "BRANCH",
    name: "진주일번지 성능장",
    branchName: "진주일번지",
  },
  {
    username: "a0009",
    password: "1234",
    role: "BRANCH",
    name: "진주오토원 성능장",
    branchName: "진주오토원",
  },
  {
    username: "a0010",
    password: "1234",
    role: "BRANCH",
    name: "사천용당 성능장",
    branchName: "사천용당",
  },
  {
    username: "a0011",
    password: "1234",
    role: "BRANCH",
    name: "마산중부 성능장",
    branchName: "마산중부",
  },
  {
    username: "a0012",
    password: "1234",
    role: "BRANCH",
    name: "천차만차 성능장",
    branchName: "천차만차",
  },
  {
    username: "a0013",
    password: "1234",
    role: "BRANCH",
    name: "김해모터스 성능장",
    branchName: "김해모터스",
  },
  {
    username: "a0014",
    password: "1234",
    role: "BRANCH",
    name: "동김해 성능장",
    branchName: "동김해",
  },
  {
    username: "a0015",
    password: "1234",
    role: "BRANCH",
    name: "김해진영 성능장",
    branchName: "김해진영",
  },
  {
    username: "a0016",
    password: "1234",
    role: "BRANCH",
    name: "sk원카 성능장",
    branchName: "sk원카",
  },
  {
    username: "a0017",
    password: "1234",
    role: "BRANCH",
    name: "거제 성능장",
    branchName: "거제",
  },
  {
    username: "a0018",
    password: "1234",
    role: "BRANCH",
    name: "영천 성능장",
    branchName: "영천",
  },
  {
    username: "a0019",
    password: "1234",
    role: "BRANCH",
    name: "순천용당 성능장",
    branchName: "순천용당",
  },
  {
    username: "a0020",
    password: "1234",
    role: "BRANCH",
    name: "양산가산 성능장",
    branchName: "양산가산",
  },
]

// Helper function to find a user by username
export function findAuthUser(username: string): AuthUser | undefined {
  return AUTH_USERS.find((u) => u.username === username)
}

export const branchAccounts = AUTH_USERS.filter((u) => u.role === "BRANCH")
