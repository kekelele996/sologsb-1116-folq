/** 鉴定依据 */
export const ID_BASES = ['形态特征', '孢子印', '显微观察'] as const
export type IdBasis = (typeof ID_BASES)[number]

/** 置信度 */
export const ID_CONFIDENCES = ['高', '中', '低'] as const
export type IdConfidence = (typeof ID_CONFIDENCES)[number]

/** 复核结论 */
export const REVIEW_RESULTS = ['通过', '退回'] as const
export type ReviewResult = (typeof REVIEW_RESULTS)[number]

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
  /** 是否在待复核队列中（高置信度直接留档为 false） */
  needReview: boolean
  /** 复核人（复核时填写） */
  reviewer: string
  /** 复核意见 */
  reviewOpinion: string
  /** 复核日期 */
  reviewDate: string
  /** 最近一次复核结果；空串表示尚未复核 */
  reviewResult: ReviewResult | ''
  date: string
}
