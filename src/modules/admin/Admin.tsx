import { useState } from 'react'
import { useT, useI18n, LANGS } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { useMutate, useRows } from '@/lib/data'
import { db, resetDemoData, supabase } from '@/lib/db'
import { useToast } from '@/components/Toast'
import { ResourcePage } from '@/crud/ResourcePage'
import { Avatar, Badge, Button, Card, Checkbox, Field, Input, PageHead, useConfirm } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { dateTime, phone } from '@/lib/format'
import { useGroupStats, useLookups, useOptions } from '../shared'
import type { Lang } from '@/lib/types'

export function BranchesPage() {
  const t = useT()
  const opts = useOptions()
  const L = useLookups()
  const gs = useGroupStats()
  const groups = useRows('groups')
  const students = useRows('students')
  return (
    <>
      <ResourcePage
        table="branches"
        title={t('nav.branches')}
        editable
        addLabel={t('branch.add')}
        columns={[
          { key: 'name', label: t('common.name'), render: (b) => <b>{b.name}</b> },
          { key: 'address', label: t('branch.address') },
          { key: 'phone', label: t('common.phone'), render: (b) => phone(b.phone), hideSm: true },
          { key: 'students', label: t('dash.activeStudents'), num: true, value: (b) => students.filter((s) => s.branch_id === b.id && s.status === 'active').length, render: (b) => students.filter((s) => s.branch_id === b.id && s.status === 'active').length },
          { key: 'groups', label: t('dash.activeGroups'), num: true, value: (b) => groups.filter((g) => g.branch_id === b.id && g.status === 'active').length, render: (b) => groups.filter((g) => g.branch_id === b.id && g.status === 'active').length },
          { key: 'is_active', label: t('common.status'), render: (b) => (b.is_active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>) },
        ]}
        fields={[
          { name: 'name', label: t('common.name'), required: true, full: true },
          { name: 'address', label: t('branch.address'), full: true },
          { name: 'phone', label: t('common.phone'), type: 'phone' },
          { name: 'is_active', label: t('common.status'), type: 'checkbox', placeholder: t('common.active') },
        ]}
        defaults={() => ({ is_active: true })}
      />
      <div className="mt" />
      <ResourcePage
        table="rooms"
        title={t('branch.rooms')}
        editable
        addLabel={t('room.add')}
        columns={[
          { key: 'name', label: t('common.name'), render: (r) => <b>{r.name}</b> },
          { key: 'branch', label: t('common.branch'), value: (r) => L.branches.get(r.branch_id)?.name, render: (r) => L.branches.get(r.branch_id)?.name },
          { key: 'capacity', label: t('common.capacity'), num: true },
          { key: 'load', label: t('nav.groups'), render: (r) => groups.filter((g) => g.room_id === r.id && g.status === 'active').map((g) => `${g.name} (${gs.count(g.id)})`).join(', ') || '—' },
        ]}
        fields={[
          { name: 'name', label: t('common.name'), required: true },
          { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches, required: true },
          { name: 'capacity', label: t('common.capacity'), type: 'number', required: true },
        ]}
        defaults={() => ({ capacity: 12, branch_id: opts.branches[0]?.value })}
      />
    </>
  )
}

export function SettingsPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const settings = useRows('settings')
  const m = useMutate('settings')
  const row = settings.find((s) => s.key === 'center')
  const [v, setV] = useState<any>(null)
  const val = v ?? (row?.value as any) ?? { name: 'Lola Edu Türk Dili Markazi', payment_due_day: 10, absence_alert: true, debt_alert: true }
  const set = (patch: any) => setV({ ...val, ...patch })
  const save = async () => {
    if (row) await m.update(row.id, { value: val })
    else await m.create({ key: 'center', value: val })
    toast.success(t('common.saved'))
  }
  const env = import.meta.env
  const integrations = [
    { name: 'Supabase', ok: db.mode === 'supabase' },
    { name: 'Payme', ok: !!env.VITE_PAYME_MERCHANT_ID },
    { name: 'Click', ok: !!env.VITE_CLICK_SERVICE_ID },
    { name: 'Telegram bot', ok: !!env.VITE_TELEGRAM_BOT_USERNAME },
    { name: 'Eskiz SMS', ok: db.mode === 'supabase' },
  ]
  return (
    <>
      <PageHead title={t('nav.settings')} actions={<Button variant="primary" onClick={save}>{t('common.save')}</Button>} />
      <div className="grid grid-2">
        <Card title={t('set.center')} pad>
          <div className="form-grid">
            <Field label={t('set.centerName')} full><Input value={val.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t('common.phone')}><Input value={val.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label={t('set.dueDay')}><Input type="number" min={1} max={28} value={val.payment_due_day ?? 10} onChange={(e) => set({ payment_due_day: Number(e.target.value) })} /></Field>
            <Field label="Telegram"><Input value={val.telegram ?? ''} onChange={(e) => set({ telegram: e.target.value })} /></Field>
            <Field label="Instagram"><Input value={val.instagram ?? ''} onChange={(e) => set({ instagram: e.target.value })} /></Field>
          </div>
        </Card>
        <Card title={t('set.automation')} pad>
          <div className="col" style={{ gap: 12 }}>
            <Checkbox label={t('set.absenceAlert')} checked={!!val.absence_alert} onChange={(x) => set({ absence_alert: x })} />
            <Checkbox label={t('set.debtAlert')} checked={!!val.debt_alert} onChange={(x) => set({ debt_alert: x })} />
          </div>
        </Card>
        <Card title={t('set.integrations')}>
          {integrations.map((i) => (
            <div key={i.name} className="list-item">
              <div className="grow bold">{i.name}</div>
              <Badge tone={i.ok ? 'green' : 'gray'}>{i.ok ? t('set.connected') : t('set.notConnected')}</Badge>
            </div>
          ))}
          <div className="card-body small muted">{t('set.integrationHint')}</div>
        </Card>
        {db.mode === 'demo' && (
          <Card title={t('set.data')} pad>
            <Button variant="danger" onClick={async () => (await confirm(t('set.resetDemo'))) && resetDemoData()}>{t('set.resetDemo')}</Button>
          </Card>
        )}
      </div>
    </>
  )
}

export function AuditPage() {
  const t = useT()
  const rows = useRows('audit_log')
  return (
    <>
      <PageHead title={t('nav.audit')} />
      <Card>
        <DataTable
          rows={rows}
          pageSize={50}
          initialSort={{ key: 'created_at', dir: -1 }}
          columns={[
            { key: 'created_at', label: t('common.date'), render: (a) => <span className="small nowrap">{dateTime(a.created_at)}</span> },
            { key: 'user_name', label: t('audit.user'), render: (a) => <div className="row"><Avatar name={a.user_name} /><b className="small">{a.user_name}</b></div> },
            { key: 'action', label: t('common.actions'), render: (a) => <Badge tone={a.action === 'delete' ? 'red' : a.action === 'create' ? 'green' : 'blue'}>{t('audit.' + a.action)}</Badge> },
            { key: 'entity', label: t('audit.entity') },
            { key: 'summary', label: t('common.name') },
          ]}
        />
      </Card>
    </>
  )
}

export function ProfilePage() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const { lang, setLang } = useI18n()
  const m = useMutate('profiles')
  const [pw, setPw] = useState('')
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined
  return (
    <>
      <PageHead title={t('nav.profile')} />
      <div className="grid grid-2">
        <Card pad>
          <div className="row">
            <Avatar name={me.full_name} size="lg" />
            <div>
              <h2>{me.full_name}</h2>
              <Badge tone="brand">{t('role.' + me.role)}</Badge>
              <div className="small muted mt">{me.email} · {phone(me.phone)}</div>
            </div>
          </div>
          <div className="divider" />
          <Field label={t('common.language')}>
            <div className="row-wrap">
              {LANGS.map((l) => (
                <Button key={l.code} variant={lang === l.code ? 'primary' : 'secondary'} onClick={() => { setLang(l.code as Lang); m.update(me.id, { lang: l.code as Lang }) }}>
                  {l.flag} {l.label}
                </Button>
              ))}
            </div>
          </Field>
        </Card>
        <Card pad>
          {supabase && (
            <>
              <Field label={t('login.password')}>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} />
              </Field>
              <Button
                className="mt"
                variant="primary"
                disabled={pw.length < 6}
                onClick={async () => {
                  const { error } = await supabase!.auth.updateUser({ password: pw })
                  if (error) toast.error(error.message)
                  else {
                    toast.success(t('common.saved'))
                    setPw('')
                  }
                }}
              >
                {t('common.save')}
              </Button>
              <div className="divider" />
            </>
          )}
          <div className="bold mb">Telegram</div>
          {me.telegram_chat_id ? (
            <Badge tone="green">✓ {t('set.connected')}</Badge>
          ) : bot ? (
            <a className="btn btn-secondary" href={`https://t.me/${bot}?start=${me.id}`} target="_blank" rel="noreferrer">✈️ @{bot}</a>
          ) : (
            <Badge>{t('set.notConnected')}</Badge>
          )}
        </Card>
      </div>
    </>
  )
}
