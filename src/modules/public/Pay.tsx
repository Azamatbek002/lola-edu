// Ochiq to'lov sahifasi: /pay/<to'lov raqami>?a=<summa> — ota-ona eslatmadagi havolani bosib, kirmasdan to'laydi.
// Faqat yashirilgan ism ("Gulshoda N.") ko'rsatiladi; qarz summasi bazadan o'qilmaydi (havoladagi ?a= dan olinadi).
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ShieldCheck } from '@/components/icons'
import { useT } from '@/lib/i18n'
import { db, supabase } from '@/lib/db'
import { Field, Input } from '@/components/ui'
import { LangSwitch } from '@/layout/AppShell'
import { clickCheckoutUrl, paymeCheckoutUrl } from '@/lib/finance'
import { readOnlinePay } from '@/lib/onlinepay'
import { money } from '@/lib/format'

interface Info {
  ok: boolean
  code?: string
  name?: string
  center?: string
  payme?: string | null
  click_service?: string | null
  click_merchant?: string | null
}

async function loadInfo(code: string): Promise<Info> {
  if (!/^\d{6}$/.test(code)) return { ok: false }
  if (supabase) {
    const { data, error } = await supabase.rpc('pay_info', { p_code: code })
    if (error) throw error
    return data as Info
  }
  // Demo rejim
  const [students, settings] = await Promise.all([db.list('students'), db.list('settings')])
  const s = students.find((x) => x.pay_code === code && x.status !== 'left')
  if (!s) return { ok: false }
  const op = readOnlinePay(settings.find((x) => x.key === 'online_pay')?.value)
  const [first, second] = s.full_name.trim().split(/\s+/)
  return { ok: true, code, name: second ? `${first} ${second[0]}.` : first, center: 'Lola Edu', payme: op.payme || null, click_service: op.clickService || null, click_merchant: op.clickMerchant || null }
}

export default function PayPage() {
  const t = useT()
  const { code = '', status } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState(false)
  const initial = Number(new URLSearchParams(location.search).get('a')) || 0
  const [sum, setSum] = useState(initial > 0 ? String(Math.round(initial)) : '')

  useEffect(() => {
    loadInfo(code).then(setInfo, () => setErr(true))
  }, [code])

  const n = Math.round(Number(sum) || 0)
  const okSum = n >= 1000
  // Qaytish manzilida "?"/"=" ishlatilmaydi: Payme parametrlari ";" va "=" bilan ajratiladi
  const ret = location.origin + '/pay/' + code + '/ok'
  const done = status === 'ok'
  const hasClick = !!(info?.click_service && info?.click_merchant)

  return (
    <div className="pay-page">
      <div className="card pay-card">
        <div className="row between mb">
          <div className="row">
            <img src="/logo.svg" alt="" style={{ width: 44, height: 44 }} />
            <div>
              <b>{info?.center || 'Lola Edu'}</b>
              <div className="small muted">{t('pay.online')}</div>
            </div>
          </div>
          <LangSwitch />
        </div>

        {err ? (
          <Notice icon={<AlertCircle size={44} color="var(--red)" />} text={t('common.error')} />
        ) : !info ? (
          <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>…</div>
        ) : !info.ok ? (
          <Notice icon={<AlertCircle size={44} color="var(--yellow)" />} text={t('payPage.notFound')} />
        ) : done ? (
          <Notice icon={<CheckCircle2 size={52} color="var(--green)" />} text={t('payPage.thanks')} />
        ) : (
          <div className="col" style={{ gap: 14 }}>
            <div className="pay-who">
              <div className="small muted">{t('payPage.student')}</div>
              <div className="pay-name">{info.name}</div>
              <div className="small muted">{t('pay.code')}: <b className="mono">{info.code}</b></div>
            </div>

            {!info.payme && !hasClick ? (
              <div className="badge badge-yellow" style={{ whiteSpace: 'normal', padding: 12 }}>{t('pay.notConfigured')}</div>
            ) : (
              <>
                <Field label={t('common.amount') + " (so'm)"}>
                  <Input type="number" inputMode="numeric" min={1000} step={1000} value={sum} onChange={(e) => setSum(e.target.value)} placeholder="500000" />
                </Field>
                {okSum && <div className="small muted" style={{ marginTop: -6 }}>{money(n)}</div>}
                <div className="grid grid-2">
                  {info.payme && (
                    <a className={'btn pay-btn pay-payme' + (okSum ? '' : ' is-disabled')} href={okSum ? paymeCheckoutUrl(info.payme, info.code!, n, ret) : undefined} aria-disabled={!okSum}>
                      Payme
                    </a>
                  )}
                  {hasClick && (
                    <a className={'btn pay-btn pay-click' + (okSum ? '' : ' is-disabled')} href={okSum ? clickCheckoutUrl(info.click_service!, info.click_merchant!, info.code!, n, ret) : undefined} aria-disabled={!okSum}>
                      Click
                    </a>
                  )}
                </div>
                <p className="small muted row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <ShieldCheck size={18} style={{ flexShrink: 0, color: 'var(--green)' }} />
                  <span>{t('payPage.safe')}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Notice({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="empty" style={{ padding: '28px 8px' }}>
      {icon}
      <p className="mt" style={{ maxWidth: 320 }}>{text}</p>
    </div>
  )
}
