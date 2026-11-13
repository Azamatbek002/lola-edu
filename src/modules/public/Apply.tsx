// Ochiq ariza formasi: /apply — Instagram/Telegram/sayt uchun. Arizalar lid bo'lib tushadi.
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { db, supabase } from '@/lib/db'
import { useRows } from '@/lib/data'
import { Button, Field, Input, Select } from '@/components/ui'
import { LangSwitch } from '@/layout/AppShell'
import { money, normalizePhone } from '@/lib/format'
import { LEVELS } from '@/lib/types'

export default function ApplyPage() {
  const t = useT()
  const courses = useRows('courses').filter((c) => c.is_active)
  const branches = useRows('branches').filter((b) => b.is_active)
  const [v, setV] = useState({ full_name: '', phone: '', course_id: '', branch_id: '', level: '', time: '' })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const params = new URLSearchParams(location.search)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ph = normalizePhone(v.phone)
    if (v.full_name.trim().length < 2 || ph.length < 13) return setErr(t('common.required'))
    setBusy(true)
    const lead = {
      full_name: v.full_name.trim(),
      phone: ph,
      course_id: v.course_id || null,
      branch_id: v.branch_id || null,
      level: (v.level || null) as any,
      source: params.get('utm_source') ? capitalize(params.get('utm_source')!) : 'Sayt',
      utm_source: params.get('utm_source'),
      utm_campaign: params.get('utm_campaign'),
      stage: 'new' as const,
      notes: v.time ? `${t('apply.preferredTime')}: ${t('apply.' + v.time)}` : null,
    }
    try {
      if (supabase) {
        // Anonim foydalanuvchi faqat shu funksiya orqali lid qo'sha oladi (RLS)
        const { error } = await supabase.rpc('submit_lead', { payload: lead })
        if (error) throw error
      } else await db.insert('leads', lead)
      setDone(true)
    } catch (e: any) {
      setErr(e?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff 0%, var(--brand-50) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 28 }}>
        <div className="row between mb">
          <div className="row">
            <img src="/logo.svg" alt="" style={{ width: 48, height: 48 }} />
            <div>
              <b>Lola Edu</b>
              <div className="small muted">{t('app.tagline')}</div>
            </div>
          </div>
          <LangSwitch />
        </div>
        {done ? (
          <div className="empty">
            <CheckCircle2 size={56} color="var(--green)" />
            <h2 className="mt">{t('apply.success')}</h2>
          </div>
        ) : (
          <form onSubmit={submit} className="col" style={{ gap: 12 }}>
            <h1>{t('apply.title')}</h1>
            <p className="muted">{t('apply.subtitle')}</p>
            <Field label={t('common.fullName') + ' *'}>
              <Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} required />
            </Field>
            <Field label={t('common.phone') + ' *'}>
              <Input type="tel" value={v.phone} placeholder="+998 90 123 45 67" onChange={(e) => setV({ ...v, phone: e.target.value })} required />
            </Field>
            <Field label={t('lead.course')}>
              <Select value={v.course_id} placeholder="—" options={courses.map((c) => ({ value: c.id, label: `${c.name} · ${money(c.monthly_price)}` }))} onChange={(e) => setV({ ...v, course_id: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label={t('apply.yourLevel')}>
                <Select value={v.level} placeholder="—" options={LEVELS.map((l) => ({ value: l, label: l === 'A0' ? 'A0 (0)' : l }))} onChange={(e) => setV({ ...v, level: e.target.value })} />
              </Field>
              <Field label={t('apply.preferredTime')}>
                <Select value={v.time} placeholder="—" options={['morning', 'afternoon', 'evening'].map((x) => ({ value: x, label: t('apply.' + x) }))} onChange={(e) => setV({ ...v, time: e.target.value })} />
              </Field>
            </div>
            {branches.length > 1 && (
              <Field label={t('common.branch')}>
                <Select value={v.branch_id} placeholder="—" options={branches.map((b) => ({ value: b.id, label: b.name }))} onChange={(e) => setV({ ...v, branch_id: e.target.value })} />
              </Field>
            )}
            {err && <div className="badge badge-red" style={{ padding: 8 }}>{err}</div>}
            <Button variant="primary" type="submit" block disabled={busy}>{t('common.send')}</Button>
          </form>
        )}
      </div>
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
