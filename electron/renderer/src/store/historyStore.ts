import { create } from 'zustand'
import type { PlayHistory } from '@/types'

// IndexedDB 数据库配置
const DB_NAME = 'LingGuangBaoHe'
const DB_VERSION = 1
const STORE_NAME = 'playHistory'

// IndexedDB 操作类
class IndexedDBService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'courseId' })
        }
      }
    })
  }

  async get(courseId: string): Promise<PlayHistory | undefined> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(courseId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async set(history: PlayHistory): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(history)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(courseId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(courseId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

const dbService = new IndexedDBService()

interface HistoryState {
  history: Record<string, PlayHistory>

  // Actions
  getHistory: (courseId: string) => Promise<PlayHistory | undefined>
  setHistory: (courseId: string, pageIndex: number) => Promise<void>
  deleteHistory: (courseId: string) => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set) => ({
  history: {},

  getHistory: async (courseId: string) => {
    try {
      await dbService.init()
      const record = await dbService.get(courseId)
      if (record) {
        set((state) => ({
          history: { ...state.history, [courseId]: record },
        }))
        return record
      }
    } catch (error) {
      console.error('Failed to get play history:', error)
    }
  },

  setHistory: async (courseId: string, pageIndex: number) => {
    try {
      await dbService.init()
      const history: PlayHistory = {
        courseId,
        pageIndex,
        lastPlayedAt: new Date().toISOString(),
      }
      await dbService.set(history)
      set((state) => ({
        history: { ...state.history, [courseId]: history },
      }))
    } catch (error) {
      console.error('Failed to save play history:', error)
    }
  },

  deleteHistory: async (courseId: string) => {
    try {
      await dbService.init()
      await dbService.delete(courseId)
      set((state) => {
        const newHistory = { ...state.history }
        delete newHistory[courseId]
        return { history: newHistory }
      })
    } catch (error) {
      console.error('Failed to delete play history:', error)
    }
  },
}))
