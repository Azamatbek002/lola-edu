// Javoblarni yuklash navbati. Ovoz avval telefon xotirasiga yoziladi, so'ng shu navbat orqali yopiq omborga yuboriladi.
// Internet uzilsa — kutadi va qaytganda o'zi davom etadi; sahifa yopilsa — keyingi kirishda davom etadi.
import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { assemble, idb, type UploadRec } from './idb'
import { baseMime, uploadAnswer } from './files'
import { speakingApi } from './api'

export interface UploadStatus {
  /** Yuklanishi kutilayotgan javoblar: urinish → savollar */
  pending: Record<string, string[]>
  busy: boolean
  online: boolean
  lastError?: string
}

let status: UploadStatus = { pending: {}, busy: false, online: typeof navigator === 'undefined' ? true : navigator.onLine }
const subs = new Set<() => void>()
const emit = (patch: Partial<UploadStatus>) => {
  status = { ...status, ...patch }
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

let currentUser: string | null = null
let running = false
let again = false
const done = new Set<() => void>()

async function refreshPending() {
  const list = await idb.uploads().catch(() => [] as UploadRec[])
  const pending: Record<string, string[]> = {}
  for (const u of list) if (!currentUser || u.userId === currentUser) (pending[u.attemptId] ??= []).push(u.itemId)
  emit({ pending })
}

/** Yozilgan javobni navbatga qo'yish (bo'laklar allaqachon xotirada) */
export async function enqueueUpload(rec: Omit<UploadRec, 'tries' | 'createdAt'>) {
  await idb.putUpload({ ...rec, tries: 0, createdAt: Date.now() })
  await refreshPending()
  void flushUploads()
}

export async function flushUploads(): Promise<void> {
  if (!currentUser) return
  if (running) {
    again = true
    return
  }
  running = true
  emit({ busy: true })
  try {
    do {
      again = false
      const list = (await idb.uploads()).filter((u) => u.userId === currentUser).sort((a, b) => a.createdAt - b.createdAt)
      for (const u of list) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break
        try {
          const a = await assemble(u.attemptId, u.itemId)
          if (a && a.blob.size > 0) {
            const path = await uploadAnswer(u.attemptId, u.itemId, a.blob, a.mime)
            await speakingApi.saveAnswer({ attempt_id: u.attemptId, item_id: u.itemId, audio_path: path, mime: baseMime(a.mime), duration_ms: Math.round(u.durationMs), size_bytes: a.blob.size })
          }
          await idb.deleteUpload(u.attemptId, u.itemId)
          await idb.deleteChunks(u.attemptId, u.itemId)
          emit({ lastError: undefined })
        } catch (e) {
          const msg = (e as { message?: string })?.message ?? String(e)
          await idb.putUpload({ ...u, tries: u.tries + 1, lastError: msg }).catch(() => undefined)
          emit({ lastError: msg })
        }
        await refreshPending()
      }
      // Imtihon tugagan, lekin "yakunlandi" serverga yetmagan bo'lsa
      for (const st of await idb.states().catch(() => [])) {
        if (!st.finished || (st.userId && st.userId !== currentUser)) continue
        try {
          await speakingApi.submit(st.attemptId)
          await idb.deleteState(st.attemptId)
        } catch {
          /* keyinroq yana urinamiz */
        }
      }
    } while (again)
  } finally {
    running = false
    emit({ busy: false })
    await refreshPending()
    done.forEach((f) => f())
  }
}

/** Joriy urinish bo'yicha yuklanmagan javoblar */
export function useUploadStatus(attemptId?: string) {
  const s = useSyncExternalStore(subscribe, () => status)
  return { ...s, left: attemptId ? s.pending[attemptId]?.length ?? 0 : Object.values(s.pending).reduce((n, l) => n + l.length, 0) }
}

/** Ilovaga bir marta ulanadi: kirgan foydalanuvchi nomidan navbatni yuklab boradi */
export function useAnswerUploader(userId: string | null | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    currentUser = userId ?? null
    if (!userId || typeof indexedDB === 'undefined') return
    const onDone = () => {
      qc.invalidateQueries({ queryKey: ['speaking_answers'] })
      qc.invalidateQueries({ queryKey: ['speaking_attempts'] })
    }
    done.add(onDone)
    const kick = () => {
      emit({ online: navigator.onLine })
      void flushUploads()
    }
    void refreshPending().then(kick)
    window.addEventListener('online', kick)
    window.addEventListener('offline', kick)
    const timer = window.setInterval(() => {
      if (Object.keys(status.pending).length) kick()
    }, 15_000)
    return () => {
      done.delete(onDone)
      window.removeEventListener('online', kick)
      window.removeEventListener('offline', kick)
      window.clearInterval(timer)
    }
  }, [userId, qc])
}
