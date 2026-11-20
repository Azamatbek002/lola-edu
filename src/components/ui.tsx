import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Inbox } from './icons'
import { initials } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { softEnter, useExitAnimation, useInitialLoading } from '@/lib/motion'

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
export function Field({ label, error, hint, children, full }: { label?: ReactNode; error?: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      {label && <span>{label}</span>}
      {children}
      {error ? <small className="err">{error}</small> : hint ? <small className="hint">{hint}</small> : null}
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

// Avatarlar: tabiiy, yumshoq ranglar (ranglar app.css dagi .av-0 … .av-7 da)
export function Avatar({ name, size }: { name?: string | null; size?: 'lg' }) {
  const n = name || '?'
  let h = 0
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0
  return <span className={'avatar av-' + (h % 8) + (size === 'lg' ? ' avatar-lg' : '')}>{initials(n)}</span>
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

// Eski hex ranglarni yangi palitraga moslash
const STAT_TONE: Record<string, string> = {
  '#12a150': 'var(--green)',
  '#2563eb': 'var(--blue)',
  '#d97706': 'var(--yellow)',
  '#f5a524': 'var(--yellow)',
  '#dc2626': 'var(--red)',
  '#7c3aed': 'var(--purple)',
  '#64748b': 'var(--muted)',
}
export function Stat({ icon, label, value, color = 'var(--brand)', sub }: { icon: ReactNode; label: string; value: ReactNode; color?: string; sub?: ReactNode }) {
  const loading = useInitialLoading()
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="ico" style={{ color: STAT_TONE[color.toLowerCase()] ?? color }}>
          {icon}
        </span>
        <span className="lbl">{label}</span>
      </div>
      {loading ? (
        <>
          <span className="skel skel-val" />
          <span className="skel skel-sub" />
        </>
      ) : (
        <>
          <div className="val">{value}</div>
          {sub && <div className="sub">{sub}</div>}
        </>
      )}
    </div>
  )
}

/** Yuklanish skeleti: kontent shaklidagi yumshoq miltillovchi chiziqlar */
export function Skeleton({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="skel-list" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row" style={{ ['--i' as string]: i }}>
          {avatar && <span className="skel skel-circle" />}
          <div className="skel-lines">
            <span className="skel" style={{ width: `${62 - ((i * 13) % 24)}%` }} />
            <span className="skel skel-thin" style={{ width: `${38 - ((i * 7) % 14)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Empty({ text, icon }: { text?: string; icon?: ReactNode }) {
  const t = useT()
  // Ma'lumot hali kelmagan bo'lsa — "bo'sh" emas, skelet ko'rsatamiz (bo'sh holat miltillamaydi)
  if (useInitialLoading()) return <Skeleton rows={3} />
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
  const ref = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)
  // Birinchi o'lchovdan keyingina siljish animatsiyasi yoqiladi (ochilishda chiziq "uchib" kelmasin)
  const [anim, setAnim] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnim(true))
    return () => cancelAnimationFrame(id)
  }, [])
  // Faol tab ostidagi chiziq: bir tabdan ikkinchisiga siljib o'tadi
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const measure = () => {
      const on = box.querySelector<HTMLElement>('button.on')
      setInd(on ? { x: on.offsetLeft, w: on.offsetWidth } : null)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(box)
    document.fonts?.ready.then(measure).catch(() => undefined)
    return () => ro?.disconnect()
  }, [value, tabs.length])
  // Tab almashganda ostidagi kontent yumshoq paydo bo'ladi
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    softEnter(ref.current?.nextElementSibling)
  }, [value])
  return (
    <div className="tabs" role="tablist" ref={ref}>
      {tabs.map((tb) => (
        <button key={tb.key} type="button" role="tab" aria-selected={value === tb.key} className={value === tb.key ? 'on' : ''} onClick={() => onChange(tb.key)}>
          {tb.label}
        </button>
      ))}
      <span className={'tabs-ind' + (ind ? '' : ' hidden') + (anim ? ' anim' : '')} style={ind ? { transform: `translateX(${ind.x}px)`, width: ind.w } : undefined} />
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
// Bir nechta modal ustma-ust ochilganda sahifa aylantirilishi to'g'ri qulflanadi
let openModals = 0
function lockScroll() {
  if (openModals++ === 0) document.documentElement.classList.add('modal-open')
}
function unlockScroll() {
  if (--openModals <= 0) {
    openModals = 0
    document.documentElement.classList.remove('modal-open')
  }
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const bg = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useExitAnimation(bg)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Faqat eng ustdagi modal Esc'ga javob beradi
      if (e.key !== 'Escape') return
      const all = document.querySelectorAll('.modal-bg:not(.is-leaving)')
      if (all[all.length - 1] === bg.current) close.current()
    }
    document.addEventListener('keydown', h)
    lockScroll()
    bg.current?.querySelector<HTMLElement>('.modal')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', h)
      unlockScroll()
    }
  }, [])
  return createPortal(
    <div className="modal-bg" ref={bg} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className={'modal-head' + (scrolled ? ' scrolled' : '')}>
          <h2>{title}</h2>
          <Button variant="ghost" icon={<X size={18} />} onClick={onClose} aria-label="close" />
        </div>
        <div className="modal-body" ref={body} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
          {children}
        </div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
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
