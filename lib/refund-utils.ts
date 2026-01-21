export function getRefundReasonLabel(reason: string | undefined): string {
  if (!reason) return "-"

  const reasonMap: Record<string, string> = {
    export: "수출",
    transfer: "상사이전",
    scrap: "폐차말소",
    auction: "경매",
    direct: "당사자거래",
    private_deal: "당사자거래",
    consignment_cancel: "위탁취소",
    other: "기타",
  }

  return reasonMap[reason] || reason
}
