import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { X, Search, Inbox } from 'lucide-react'
import { initials } from '@/lib/format'
import { useT } from '@/lib/i18n'

// ─── Button ──────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'
export function Button({
  variant = 'secondary',
  size,
  icon,
  block,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'; icon?: ReactNode; block?: boolean }) {
  const cls = ['btn', 'btn-' + variant, size === 'sm' && 'btn-sm', !children && 'btn-icon', block && 'btn-block', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} {...rest}>
      {icon}
      {children}
    </button>
  )
}

// ─── Form fields ─────────────────────────────────────
export function Field({ label, error, children, full }: { label?: ReactNode; error?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      {label && <span>{label}</span>}
      {children}
      {error && <small className="err">{error}</small>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />
}

export interface Opt {
  value: string
  label: string
}

export function Select({ options, placeholder, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: Opt[]; placeholder?: string }) {
  return (
    <select className="select" {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Checkbox({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function DaysPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const t = useT()
  return (
    <div className="days">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <button
          type="button"
          key={d}
          className={value.includes(d) ? 'on' : ''}
          onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort())}
        >
          {t('day.' + d)}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useT()
  return (
    <div className="search">
      <Search size={16} />
      <input className="input" value={value} placeholder={placeholder ?? t('common.search')} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ─── Display ─────────────────────────────────────────
export type Tone = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'brand'
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={'badge badge-' + tone}>{children}</span>
}

const AV_COLORS = ['#c0272d', '#2563eb', '#7c3aed', '#0d9488', '#d97706', '#db2777', '#4f46e5', '#059669']
export function Avatar({ name, size }: { name?: string | null; size?: 'lg' }) {
  const n = name || '?'
  let h = 0
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0
  return (
    <span className={'avatar' + (size === 'lg' ? ' avatar-lg' : '')} style={{ background: AV_COLORS[h % AV_COLORS.length] }}>
      {initials(n)}
    </span>
  )
}

export function Card({ title, actions, children, className = '', pad }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={'card ' + className}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {actions && <div className="row-wrap">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </div>
  )
}

export function Stat({ icon, label, value, color = 'var(--brand)', sub }: { icon: ReactNode; label: string; value: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="ico" style={{ background: color + '1a', color }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="lbl">{label}</div>
        <div className="val">{value}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Empty({ text, icon }: { text?: string; icon?: ReactNode }) {
  const t = useT()
  return (
    <div className="empty">
      {icon ?? <Inbox size={34} />}
      <div>{text ?? t('common.empty')}</div>
    </div>
  )
}

export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <div style={{ width: Math.min(100, Math.max(0, value)) + '%', background: color }} />
    </div>
  )
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.key} role="tab" className={value === tb.key ? 'on' : ''} onClick={() => onChange(tb.key)}>
          {tb.label}
        </button>
      ))}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        {title && <h1>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} ref={ref} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" icon={<X size={18} />} onClick={onClose} aria-label="close" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Confirm ─────────────────────────────────────────
type ConfirmFn = (msg?: string) => Promise<boolean>
const ConfirmCtx = createContext<ConfirmFn>(async () => true)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [state, setState] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null)
  const confirm = useCallback<ConfirmFn>((msg) => new Promise((resolve) => setState({ msg: msg ?? '', resolve })), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={t('common.confirmDelete')}
          onClose={() => close(false)}
          footer={
            <>
              <Button onClick={() => close(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={() => close(true)}>
                {t('common.yes')}
              </Button>
            </>
          }
        >
          <p>{state.msg}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

/** Oy tanlagich */
export function MonthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="month" className="input" style={{ width: 170 }} value={value} onChange={(e) => onChange(e.target.value)} />
}
