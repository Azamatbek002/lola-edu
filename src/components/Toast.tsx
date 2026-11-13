import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface ToastApi {
  success: (msg: string) => void
  error: (msg: string) => void
}

const Ctx = createContext<ToastApi>({ success: () => {}, error: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: 'ok' | 'error' }[]>([])
  const push = useCallback((msg: string, kind: 'ok' | 'error') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, msg, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 5000 : 2600)
  }, [])
  const api = useMemo(() => ({ success: (m: string) => push(m, 'ok'), error: (m: string) => push(m, 'error') }), [push])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status">
        {items.map((i) => (
          <div key={i.id} className={'toast ' + (i.kind === 'error' ? 'error' : '')}>
            {i.kind === 'ok' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
