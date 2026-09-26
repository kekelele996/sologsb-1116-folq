import type { IdentifyLog, ReviewEntry } from '@/types'

/** 鉴定结论当前状态：已留档（高置信度或复核通过）/ 待复核 / 复核退回后继续待复核 */
export type IdentifyStatus = 'archived' | 'pending' | 'returned'

export interface StatusView {
  status: IdentifyStatus
  label: string
  /** el-tag 的 type */
  type: 'success' | 'warning' | 'danger'
  /** 状态说明，用于提示与队列 */
  description: string
}

/** 最新一次复核留痕（从未复核时为 undefined） */
export function latestReview(log: IdentifyLog): ReviewEntry | undefined {
  return log.reviews.length > 0 ? log.reviews[log.reviews.length - 1] : undefined
}

export function identifyStatus(log: IdentifyLog): IdentifyStatus {
  if (!log.needReview) return 'archived'
  return latestReview(log)?.result === '退回' ? 'returned' : 'pending'
}

export function statusView(log: IdentifyLog): StatusView {
  switch (identifyStatus(log)) {
    case 'archived':
      return {
        status: 'archived',
        label: '已留档',
        type: 'success',
        description:
          log.confidence === '高' && log.reviews.length === 0
            ? '高置信度结论，已直接留档'
            : log.reviews.length > 0
              ? '复核通过，已移出待复核队列'
              : '已留档结论'
      }
    case 'returned':
      return {
        status: 'returned',
        label: '退回待核',
        type: 'danger',
        description: '复核已退回，原结论与意见保留，仍在待复核队列'
      }
    case 'pending':
    default:
      return {
        status: 'pending',
        label: '待复核',
        type: 'warning',
        description: '中低置信度结论，等待复核人处理'
      }
  }
}
