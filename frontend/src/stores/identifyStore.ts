import { createStore } from 'zustand/vanilla'
import type { IdentifyLog, ReviewEntry, ReviewResult } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { identifyStatus } from '@/utils/review'

export interface ReviewInput {
  reviewer: string
  comment: string
  result: ReviewResult
}

export interface IdentifyState {
  logs: IdentifyLog[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (log: IdentifyLog) => Promise<void>
  remove: (id: string) => Promise<void>
  latestOf: (recordId: string) => IdentifyLog | undefined
  /** 该条目尚未结清（仍在待复核队列）的结论；没有则 undefined */
  pendingOf: (recordId: string) => IdentifyLog | undefined
  /** 待复核队列：按退回优先、结论日期倒序 */
  pendingQueue: () => IdentifyLog[]
  /** 复核：通过移出队列，退回保留原结论与意见并继续待复核 */
  review: (id: string, input: ReviewInput) => Promise<void>
}

export const identifyStore = createStore<IdentifyState>((set, get) => ({
  logs: [],
  loaded: false,
  hydrate: async () => {
    const logs = await syncAll<IdentifyLog>(db.identifies)
    logs.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    set({ logs, loaded: true })
  },
  save: async (log) => {
    await syncPut<IdentifyLog>(db.identifies, log)
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<IdentifyLog>(db.identifies, id)
    await get().hydrate()
  },
  latestOf: (recordId) => get().logs.find((item) => item.recordId === recordId),
  pendingOf: (recordId) =>
    get().logs.find((item) => item.recordId === recordId && item.needReview),
  pendingQueue: () =>
    get()
      .logs.filter((item) => item.needReview)
      .sort((a, b) => {
        // 被退回的优先处理，其次退回次数多的优先，再按结论日期倒序
        const rank = (log: IdentifyLog): number => (identifyStatus(log) === 'returned' ? 1 : 0)
        if (rank(a) !== rank(b)) return rank(b) - rank(a)
        if (a.reviews.length !== b.reviews.length) return b.reviews.length - a.reviews.length
        return (b.date + b.id).localeCompare(a.date + a.id)
      }),
  review: async (id, input) => {
    const current = get().logs.find((item) => item.id === id)
    if (!current) return
    const entry: ReviewEntry = {
      reviewer: input.reviewer,
      comment: input.comment,
      result: input.result,
      date: new Date().toISOString().slice(0, 10)
    }
    const updated: IdentifyLog = {
      ...current,
      reviews: [...current.reviews, entry],
      // 通过 → 移出队列；退回 → 保留原结论与意见，继续待复核
      needReview: input.result === '退回'
    }
    await syncPut<IdentifyLog>(db.identifies, updated)
    await get().hydrate()
  }
}))
