import type { IdentifyLog } from '@/types'

/** 鉴定结论的流转状态 */
export type IdentifyStatus = 'pending' | 'returned' | 'approved' | 'archived'

/** 由留痕字段推导当前状态：在队列中看是否被退回过，出队列看是复核通过还是高置信度直接留档 */
export function identifyStatus(log: IdentifyLog): IdentifyStatus {
  if (log.needReview) return log.reviewResult === '退回' ? 'returned' : 'pending'
  return log.reviewResult === '通过' ? 'approved' : 'archived'
}

export const IDENTIFY_STATUS_META: Record<
  IdentifyStatus,
  { label: string; tag: 'warning' | 'danger' | 'success' | 'info' }
> = {
  pending: { label: '待复核', tag: 'warning' },
  returned: { label: '退回待复核', tag: 'danger' },
  approved: { label: '复核通过', tag: 'success' },
  archived: { label: '高置信度留档', tag: 'info' }
}

export function identifyStatusLabel(log: IdentifyLog): string {
  return IDENTIFY_STATUS_META[identifyStatus(log)].label
}
