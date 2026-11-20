// Onlayn to'lov: sozlamalar kartasi (rahbar/administrator) va o'quvchi to'lov raqami qatori
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, Field, Input } from '@/components/ui'
import { Copy, CreditCard, Link2 } from '@/components/icons'
import { CLICK_ENDPOINT, PAYME_ENDPOINT, payPageUrl, readOnlinePay, useOnlinePay, type OnlinePayConfig } from '@/lib/onlinepay'
import type { Student } from '@/lib/types'

function useCopy() {
  const t = useT()
  const toast = useToast()
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('common.copied'))
    } catch {
      window.prompt(t('common.copy'), text)
    }
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = useCopy()
  return (
    <div className="list-item" style={{ padding: '8px 0', alignItems: 'flex-start' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="small muted">{label}</div>
        <div className="small bold" style={{ wordBreak: 'break-all' }}>{value}</div>
      </div>
      <Button size="sm" variant="ghost" icon={<Copy size={15} />} onClick={() => copy(value)} aria-label="copy" />
    </div>
  )
}

/** Sozlamalar → Onlayn to'lov: kassa ID'lari va Payme/Click kabinetiga kiritiladigan manzillar */
export function OnlinePayCard() {
  const t = useT()
  const toast = useToast()
  const settings = useRows('settings')
  const m = useMutate('settings')
  const row = settings.find((s) => s.key === 'online_pay')
  const [v, setV] = useState<OnlinePayConfig | null>(null)
  const val: OnlinePayConfig = v ?? ((row?.value as OnlinePayConfig) || {})
  const set = (patch: Partial<OnlinePayConfig>) => setV({ ...val, ...patch })
  const op = readOnlinePay(val)
  const [fiscal, setFiscal] = useState(!!val.mxik)

  const save = async () => {
    const clean: OnlinePayConfig = {
      ...val,
      payme_merchant_id: (val.payme_merchant_id ?? '').trim(),
      click_service_id: String(val.click_service_id ?? '').trim(),
      click_merchant_id: String(val.click_merchant_id ?? '').trim(),
      site_url: (val.site_url ?? '').trim().replace(/\/+$/, ''),
      mxik: (val.mxik ?? '').trim(),
      package_code: (val.package_code ?? '').trim(),
      vat_percent: Number(val.vat_percent) || 0,
    }
    if (row) await m.update(row.id, { value: clean as any })
    else await m.create({ key: 'online_pay', value: clean as any })
    setV(null)
    toast.success(t('common.saved'))
  }

  return (
    <Card
      title={<h3 className="row"><CreditCard size={18} /> {t('op.title')}</h3>}
      actions={<Button size="sm" variant="primary" onClick={save} disabled={!v}>{t('common.save')}</Button>}
      pad
    >
      <div className="row-wrap mb">
        <Badge tone={op.payme ? 'green' : 'gray'}>Payme: {op.payme ? t('set.connected') : t('set.notConnected')}</Badge>
        <Badge tone={op.clickService && op.clickMerchant ? 'green' : 'gray'}>Click: {op.clickService && op.clickMerchant ? t('set.connected') : t('set.notConnected')}</Badge>
      </div>
      <div className="form-grid">
        <Field label={t('op.paymeId')} full hint={t('op.paymeIdHint')}>
          <Input value={val.payme_merchant_id ?? ''} onChange={(e) => set({ payme_merchant_id: e.target.value })} placeholder="65a1b2c3d4e5f6a7b8c9d0e1" />
        </Field>
        <Field label="Click service_id">
          <Input inputMode="numeric" value={val.click_service_id ?? ''} onChange={(e) => set({ click_service_id: e.target.value })} placeholder="12345" />
        </Field>
        <Field label="Click merchant_id">
          <Input inputMode="numeric" value={val.click_merchant_id ?? ''} onChange={(e) => set({ click_merchant_id: e.target.value })} placeholder="12345" />
        </Field>
        <Field label={t('op.site')} full hint={t('op.siteHint')}>
          <Input value={val.site_url ?? ''} onChange={(e) => set({ site_url: e.target.value })} placeholder="https://lola-edu.vercel.app" />
        </Field>
      </div>

      <div className="divider" />
      <h4 className="mb">{t('op.forCabinet')}</h4>
      <CopyRow label={t('op.paymeEndpoint')} value={PAYME_ENDPOINT} />
      <CopyRow label={t('op.clickEndpoint')} value={CLICK_ENDPOINT} />
      <CopyRow label={t('op.account')} value="student_id" />
      <p className="small muted mt">{t('op.secretsHint')}</p>

      <div className="divider" />
      {!fiscal ? (
        <Button size="sm" variant="ghost" onClick={() => setFiscal(true)}>{t('op.fiscalShow')}</Button>
      ) : (
        <>
          <h4 className="mb">{t('op.fiscal')}</h4>
          <div className="form-grid">
            <Field label={t('op.mxik')} hint="tasnif.soliq.uz">
              <Input inputMode="numeric" value={val.mxik ?? ''} onChange={(e) => set({ mxik: e.target.value })} placeholder="17 xonali kod" />
            </Field>
            <Field label={t('op.package')}>
              <Input inputMode="numeric" value={val.package_code ?? ''} onChange={(e) => set({ package_code: e.target.value })} />
            </Field>
            <Field label={t('op.vat')}>
              <Input type="number" min={0} max={100} value={val.vat_percent ?? 0} onChange={(e) => set({ vat_percent: Number(e.target.value) })} />
            </Field>
          </div>
          <p className="small muted mt">{t('op.fiscalHint')}</p>
        </>
      )}
    </Card>
  )
}

/** O'quvchi profilida: to'lov raqami va onlayn to'lov havolasini nusxalash */
export function PayCodeLine({ student, amount }: { student: Student; amount: number }) {
  const t = useT()
  const op = useOnlinePay()
  const copy = useCopy()
  if (!student.pay_code) return null
  return (
    <div className="row-wrap small mt" style={{ marginTop: 6, gap: 10 }}>
      <span>
        {t('pay.code')}: <b className="pay-code">{student.pay_code}</b>
      </span>
      {op.enabled && (
        <Button size="sm" variant="ghost" icon={<Link2 size={14} />} onClick={() => copy(payPageUrl(op.site, student.pay_code!, amount))}>
          {t('op.copyLink')}
        </Button>
      )}
    </div>
  )
}
