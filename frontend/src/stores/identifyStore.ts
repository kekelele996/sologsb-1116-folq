import { createStore } from 'zustand/vanilla'
import type { IdentifyLog, ReviewResult } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'

export interface ReviewPayload {
  reviewer: string
  opinion: string
  result: ReviewResult
}

export interface IdentifyState {
  logs: IdentifyLog[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (log: IdentifyLog) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 复核留痕：通过则移出队列，退回则保留原结论与意见、继续待复核 */
  submitReview: (logId: string, payload: ReviewPayload) => Promise<void>
  latestOf: (recordId: string) => IdentifyLog | undefined
  /** 该条目是否还有未结清的复核待办 */
  pendingOf: (recordId: string) => IdentifyLog | undefined
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
  submitReview: async (logId, payload) => {
    const log = get().logs.find((item) => item.id === logId)
    if (!log) return
    await get().save({
      ...log,
      reviewer: payload.reviewer,
      reviewOpinion: payload.opinion,
      reviewDate: new Date().toISOString().slice(0, 10),
      reviewResult: payload.result,
      needReview: payload.result === '退回'
    })
  },
  latestOf: (recordId) => get().logs.find((item) => item.recordId === recordId),
  pendingOf: (recordId) =>
    get().logs.find((item) => item.recordId === recordId && item.needReview)
}))
