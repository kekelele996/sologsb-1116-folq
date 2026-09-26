/** 鉴定依据 */
export const ID_BASES = ['形态特征', '孢子印', '显微观察'] as const
export type IdBasis = (typeof ID_BASES)[number]

/** 置信度 */
export const ID_CONFIDENCES = ['高', '中', '低'] as const
export type IdConfidence = (typeof ID_CONFIDENCES)[number]

/** 复核结论 */
export const REVIEW_RESULTS = ['通过', '退回'] as const
export type ReviewResult = (typeof REVIEW_RESULTS)[number]

/** 一次复核留痕：复核人填写姓名与意见后生成 */
export interface ReviewEntry {
  /** 复核人姓名 */
  reviewer: string
  /** 复核意见 */
  comment: string
  result: ReviewResult
  /** 复核日期 */
  date: string
}

/** IdentifyLog 鉴定结论 */
export interface IdentifyLog {
  id: string
  recordId: string
  /** 结论学名 */
  conclusion: string
  basis: IdBasis
  /** 参考图鉴名称 */
  referenceBook: string
  /** 页码 */
  referencePage: string
  confidence: IdConfidence
  /** 是否仍在复核队列：非高置信度入队为 true，复核通过后置 false；退回保持 true */
  needReview: boolean
  /** 出结论的鉴定人（旧字段 reviewer 迁移而来） */
  submitter: string
  /** 出结论日期 */
  date: string
  /** 复核留痕（通过 / 退回均记录，追加不覆盖） */
  reviews: ReviewEntry[]
}
