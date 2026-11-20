import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from './icons'

interface ToastApi {
  success: (msg: string) => void
  error: (msg: string) => void
}

const Ctx = createContext<ToastApi>({ success: () => {}, error: () => {} })

type Item = { id: number; msg: string; kind: 'ok' | 'error'; leaving?: boolean }
const LEAVE_MS = 240

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const dismiss = useCallback((id: number) => {
    // Avval chiqish animatsiyasi, keyin ro'yxatdan olib tashlash
    setItems((x) => x.map((i) => (i.id === id ? { ...i, leaving: true } : i)))
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), LEAVE_MS)
  }, [])
  const push = useCallback(
    (msg: string, kind: 'ok' | 'error') => {
      const id = Date.now() + Math.random()
      // Bir xil xabar ketma-ket chiqmasin
      setItems((x) => [...x.filter((i) => i.msg !== msg || i.leaving), { id, msg, kind }].slice(-4))
      setTimeout(() => dismiss(id), kind === 'error' ? 5000 : 2600)
    },
    [dismiss],
  )
  const api = useMemo(() => ({ success: (m: string) => push(m, 'ok'), error: (m: string) => push(m, 'error') }), [push])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={'toast' + (i.kind === 'error' ? ' error' : '') + (i.leaving ? ' leaving' : '')} onClick={() => dismiss(i.id)}>
            {i.kind === 'ok' ? <CheckCircle2 size={17} weight="fill" /> : <AlertCircle size={17} weight="fill" />}
            <span>{i.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
