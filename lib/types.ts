export interface RefundRequest {
  id: string
  type: "single" | "bulk" | "bundled"
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  submittedBy: string
  submittedByName?: string
  submittedByBranch?: string

  isDuplicate?: boolean // 중복 환불 여부 (조회 시 계산)
  duplicateRefundId?: string // 중복된 환불건 ID (첫 번째 것만)

  // Single refund fields
  refundDate?: string // 환불신청일자
  vehicleNumber?: string // 차량번호
  vin?: string // 차대번호
  insuranceProvider?: string // 보험사 (KB손해보험, 현대해상, 기타(직접입력))
  insuranceProviderEtc?: string // 보험사(기타) - for custom input
  insuranceCompany?: string // 상사명 (kept for backward compatibility, will be renamed to companyName)
  companyName?: string // 상사명 (new field name)
  dealerName?: string // 딜러명 (renamed from customerName)
  managerName?: string // 담당자
  refundMethod?: "card" | "account" | "offset" // 환불수단
  claimAmount?: number // 총환불금액
  refundReason?: string // 환불사유

  // Conditional fields for account
  bankName?: string
  accountNumber?: string
  accountHolder?: string

  // Conditional field for card/offset
  receiptDate?: string // 환불일자 (영수증 날짜)
  offsetReason?: string // 상계 사유 (required when refundMethod is "offset")

  receiptPhotos?: string[] // blob URLs

  // Bulk/Bundled fields
  excelFile?: string // blob URL
  bundledPhotos?: string[] // blob URLs for bundled type

  // Admin fields
  processedAt?: string
  processedBy?: string
  approvedAt?: string // ISO string - set when status becomes "approved"
  notes?: string
  updatedAt?: string
  updatedBy?: string

  acknowledgedAt?: string // ISO string - when branch user viewed rejected refund
  acknowledgedBy?: string // username of branch user who acknowledged
}

export interface User {
  username: string
  role: "COMMANDER" | "STAFF" | "BRANCH" | "MIDDLE_MANAGER" // Added MIDDLE_MANAGER role
  name: string
  branchName?: string // For BRANCH role
  mustChangePassword?: boolean // Flag for forcing password change on first login
}

export interface BatchRefundLineItem {
  id: string // Temporary client-side ID for tracking
  refundDate: string
  vehicleNumber: string
  vin?: string
  claimAmount: number
  refundReason: string
  receiptDate?: string
  receiptPhotos?: string[]
}

export interface BatchRefundHeader {
  insuranceProvider: string
  insuranceProviderEtc?: string
  companyName: string // Required: Same dealer/merchant
  dealerName?: string
  managerName?: string
  refundMethod: "card" | "account" | "offset" // Required
  // Account fields
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  offsetReason?: string // 상계 사유 (required when refundMethod is "offset")
}

export interface WorkLog {
  id: string
  date: string // 근무일자
  authorRole: string
  authorId: string
  authorName: string
  branchId?: string
  note?: string // 메모
  photoUrls: string[] // 사진들
  worklogPasteImageUrls?: string[] // 붙여넣기 이미지 (근무일지 전용)
  createdAt: string
  status?: "pending" | "approved" | "rejected" // 대기중/승인됨/거부됨 (기본값: pending)
  statusUpdatedAt?: string // 상태 변경 시각
  commanderComment?: string // 커멘더 답변
  commanderCommentAt?: string // 커멘더 답변 작성/수정 시각
}

export interface StatusChangeLog {
  id: string
  refundId: string
  changedBy: string // username
  changedByName: string // display name
  changedAt: string // ISO string
  fromStatus: "pending" | "approved" | "rejected"
  toStatus: "pending" | "approved" | "rejected"
  reason: string
}
