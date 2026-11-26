// Telefon xotirasi (IndexedDB): yozilayotgan ovoz bo'laklari, yuklash navbati, imtihon holati.
// Sahifa yangilansa yoki internet uzilsa ham javoblar shu yerda saqlanib turadi.

const DB_NAME = 'lola-speaking'
const VERSION = 1

export interface ChunkRec {
  attemptId: string
  itemId: string
  seq: number
  blob: Blob
  mime: string
  at: number
}
export interface UploadRec {
  attemptId: string
  itemId: string
  /** Kim yozgan (boshqa foydalanuvchi kirganda uning nomidan yuklanmaydi) */
  userId: string
  mime: string
  durationMs: number
  createdAt: number
  tries: number
  lastError?: string
}
export interface StateRec {
  attemptId: string
  userId?: string
  step: number
  startedAt: number
  /** Sahifadan chiqib ketishlar soni (baholovchiga ko'rsatiladi) */
  blurs?: number
  /** Imtihon tugagan, lekin serverga "yakunlandi" hali yetib bormagan */
  finished?: boolean
}
export interface FileRec {
  path: string
  blob: Blob
  type: string
}

let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks', { keyPath: ['attemptId', 'itemId', 'seq'] })
      if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: ['attemptId', 'itemId'] })
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'attemptId' })
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'path' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  dbp.catch(() => (dbp = null))
  return dbp
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const r = fn(s)
        let result: T
        if (r) r.onsuccess = () => (result = r.result)
        t.oncomplete = () => resolve(result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export const idb = {
  putChunk: (c: ChunkRec) => tx('chunks', 'readwrite', (s) => s.put(c)),
  chunks: (attemptId: string, itemId: string) =>
    tx<ChunkRec[]>('chunks', 'readonly', (s) => s.getAll(IDBKeyRange.bound([attemptId, itemId, 0], [attemptId, itemId, Number.MAX_SAFE_INTEGER]))),
  deleteChunks: (attemptId: string, itemId: string) =>
    tx('chunks', 'readwrite', (s) => s.delete(IDBKeyRange.bound([attemptId, itemId, 0], [attemptId, itemId, Number.MAX_SAFE_INTEGER]))),
  putUpload: (u: UploadRec) => tx('uploads', 'readwrite', (s) => s.put(u)),
  uploads: () => tx<UploadRec[]>('uploads', 'readonly', (s) => s.getAll()),
  deleteUpload: (attemptId: string, itemId: string) => tx('uploads', 'readwrite', (s) => s.delete([attemptId, itemId])),
  putState: (st: StateRec) => tx('state', 'readwrite', (s) => s.put(st)),
  state: (attemptId: string) => tx<StateRec | undefined>('state', 'readonly', (s) => s.get(attemptId)),
  deleteState: (attemptId: string) => tx('state', 'readwrite', (s) => s.delete(attemptId)),
  states: () => tx<StateRec[]>('state', 'readonly', (s) => s.getAll()),
  putFile: (f: FileRec) => tx('files', 'readwrite', (s) => s.put(f)),
  file: (path: string) => tx<FileRec | undefined>('files', 'readonly', (s) => s.get(path)),
  deleteFile: (path: string) => tx('files', 'readwrite', (s) => s.delete(path)),
}

/** Saqlangan bo'laklardan bitta audio fayl yig'ish */
export async function assemble(attemptId: string, itemId: string): Promise<{ blob: Blob; mime: string } | null> {
  const parts = (await idb.chunks(attemptId, itemId)).sort((a, b) => a.seq - b.seq)
  if (!parts.length) return null
  const mime = parts[0].mime
  return { blob: new Blob(parts.map((p) => p.blob), { type: mime }), mime }
}
