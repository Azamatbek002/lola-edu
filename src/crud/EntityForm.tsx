import { useState, type ReactNode } from 'react'
import { Button, Checkbox, DaysPicker, Field, Input, Modal, Select, Textarea, type Opt } from '@/components/ui'
import { useT } from '@/lib/i18n'
import { normalizePhone } from '@/lib/format'

export type FieldType =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'time'
  | 'month'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'phone'
  | 'email'
  | 'password'
  | 'days'
  | 'color'
  | 'url'

export interface FieldDef<V = any> {
  name: string
  label: string
  type?: FieldType
  options?: Opt[]
  required?: boolean
  full?: boolean
  placeholder?: string
  hint?: string
  show?: (v: V) => boolean
  min?: number
  max?: number
}

export function EntityForm<V extends Record<string, any>>({
  title,
  fields,
  initial,
  onSubmit,
  onClose,
  extra,
  wide,
  submitLabel,
  validate,
}: {
  title: ReactNode
  fields: FieldDef<V>[]
  initial: V
  onSubmit: (v: V) => Promise<unknown> | void
  onClose: () => void
  extra?: (v: V, set: (patch: Partial<V>) => void) => ReactNode
  wide?: boolean
  submitLabel?: string
  validate?: (v: V) => string | null
}) {
  const t = useT()
  const [v, setV] = useState<V>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<V>) => setV((x) => ({ ...x, ...patch }))

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (f.show && !f.show(v)) continue
      const val = v[f.name]
      if (f.required && (val === '' || val == null || (Array.isArray(val) && !val.length))) errs[f.name] = t('common.required')
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    const custom = validate?.(v)
    setFormError(custom ?? null)
    if (custom) return
    // Turlarni tozalash
    const out: any = { ...v }
    for (const f of fields) {
      const val = out[f.name]
      if (f.type === 'number' || f.type === 'money') out[f.name] = val === '' || val == null ? null : Number(val)
      else if (f.type === 'phone' && val) out[f.name] = normalizePhone(val)
      else if ((f.type === 'date' || f.type === 'select' || f.type === 'time' || f.type === 'month') && val === '') out[f.name] = null
    }
    setBusy(true)
    try {
      await onSubmit(out)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={wide}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => submit()}>
            {submitLabel ?? t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="form-grid">
        {fields
          .filter((f) => !f.show || f.show(v))
          .map((f) => (
            <Field key={f.name} label={f.label + (f.required ? ' *' : '')} error={errors[f.name] ?? f.hint} full={f.full || f.type === 'textarea' || f.type === 'days'}>
              <FieldInput f={f} value={v[f.name]} onChange={(val) => set({ [f.name]: val } as Partial<V>)} />
            </Field>
          ))}
        {extra && <div className="full">{extra(v, set)}</div>}
        {formError && (
          <div className="full badge badge-red" style={{ padding: '8px 12px', borderRadius: 9, whiteSpace: 'normal' }}>
            {formError}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: any; onChange: (v: any) => void }) {
  const t = useT()
  switch (f.type) {
    case 'textarea':
      return <Textarea value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
    case 'select':
      return <Select value={value ?? ''} options={f.options ?? []} placeholder={f.required ? t('common.select') : '—'} onChange={(e) => onChange(e.target.value)} />
    case 'checkbox':
      return <Checkbox label={f.placeholder ?? ''} checked={!!value} onChange={onChange} />
    case 'days':
      return <DaysPicker value={value ?? []} onChange={onChange} />
    case 'number':
    case 'money':
      return <Input type="number" inputMode="numeric" min={f.min ?? 0} max={f.max} step={f.type === 'money' ? 1000 : 'any'} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
    case 'phone':
      return <Input type="tel" value={value ?? ''} placeholder={f.placeholder ?? '+998 90 123 45 67'} onChange={(e) => onChange(e.target.value)} />
    case 'color':
      return <Input type="color" value={value || '#c0272d'} onChange={(e) => onChange(e.target.value)} style={{ padding: 3, height: 38 }} />
    default:
      return <Input type={f.type ?? 'text'} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
  }
}
