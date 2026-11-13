import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useBranchFilter } from '@/lib/auth'
import { useRows } from '@/lib/data'
import { useMessenger, TEMPLATE_VARS, type Recipient } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Button, Card, Field, PageHead, Select, Tabs, Textarea } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { dateTime, money, monthISO, monthLabel } from '@/lib/format'
import { useBalances, useLookups } from '../shared'
import type { TemplateTrigger } from '@/lib/types'

type Audience = 'allActive' | 'group' | 'debtors' | 'parents' | 'leads' | 'teachers'
const TRIGGERS: TemplateTrigger[] = ['manual', 'debt_reminder', 'absence', 'birthday', 'lesson_reminder', 'payment_received', 'welcome', 'trial_reminder']

export default function MessagesPage() {
  const t = useT()
  const [tab, setTab] = useState<'compose' | 'templates' | 'history'>('compose')
  return (
    <>
      <PageHead title={t('nav.messages')} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'compose', label: t('msg.compose') }, { key: 'templates', label: t('msg.templates') }, { key: 'history', label: t('msg.history') }]} />
      {tab === 'compose' && <Compose />}
      {tab === 'templates' && <Templates />}
      {tab === 'history' && <History />}
    </>
  )
}

function Compose() {
  const t = useT()
  const toast = useToast()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const balances = useBalances()
  const students = byBranch(useRows('students'))
  const enrollments = useRows('enrollments')
  const groups = byBranch(useRows('groups')).filter((g) => g.status === 'active' || g.status === 'forming')
  const leads = byBranch(useRows('leads'))
  const profiles = useRows('profiles')
  const templates = useRows('message_templates')
  const { send } = useMessenger()
  const [aud, setAud] = useState<Audience>('allActive')
  const [group, setGroup] = useState('')
  const [channel, setChannel] = useState<'' | 'sms' | 'telegram'>('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const recipients: Recipient[] = useMemo(() => {
    const st = (s: (typeof students)[number]): Recipient => ({ phone: s.phone, telegram_chat_id: s.telegram_chat_id, name: s.full_name, vars: { amount: money(-(balances.get(s.id) || 0)), month: monthLabel(monthISO()) } })
    switch (aud) {
      case 'allActive':
        return students.filter((s) => s.status === 'active').map(st)
      case 'group': {
        const ids = new Set(enrollments.filter((e) => e.group_id === group && e.status === 'active').map((e) => e.student_id))
        const g = L.groups.get(group)
        return students.filter((s) => ids.has(s.id)).map((s) => ({ ...st(s), vars: { ...st(s).vars, group: g?.name } }))
      }
      case 'debtors':
        return students.filter((s) => s.status !== 'left' && (balances.get(s.id) || 0) < 0).map((s) => ({ ...st(s), phone: s.parent_phone || s.phone }))
      case 'parents':
        return students.filter((s) => s.status === 'active' && s.parent_phone).map((s) => ({ phone: s.parent_phone, telegram_chat_id: s.parent_telegram_chat_id, name: s.parent_name, vars: { student: s.full_name } }))
      case 'leads':
        return leads.filter((l) => !['won', 'lost'].includes(l.stage)).map((l) => ({ phone: l.phone, name: l.full_name }))
      case 'teachers':
        return profiles.filter((p) => p.role === 'teacher' && p.is_active).map((p) => ({ phone: p.phone, telegram_chat_id: p.telegram_chat_id, name: p.full_name }))
    }
  }, [aud, group, students, enrollments, leads, profiles, balances, L.groups])

  const submit = async () => {
    if (!text.trim() || !recipients.length) return toast.error(t('msg.noRecipients'))
    setBusy(true)
    const n = await send(text, recipients, channel || undefined)
    setBusy(false)
    toast.success(`${n} ${t('msg.sent')}`)
    setText('')
  }

  return (
    <div className="grid grid-3">
      <Card className="span-2" pad>
        <div className="form-grid">
          <Field label={t('msg.recipients')}>
            <Select value={aud} onChange={(e) => setAud(e.target.value as Audience)} options={(['allActive', 'group', 'debtors', 'parents', 'leads', 'teachers'] as Audience[]).map((a) => ({ value: a, label: t('msg.to.' + a) }))} />
          </Field>
          {aud === 'group' ? (
            <Field label={t('msg.to.group')}>
              <Select value={group} options={groups.map((g) => ({ value: g.id, label: g.name }))} placeholder={t('common.select')} onChange={(e) => setGroup(e.target.value)} />
            </Field>
          ) : (
            <Field label={t('msg.channel')}>
              <Select value={channel} onChange={(e) => setChannel(e.target.value as any)} options={[{ value: 'sms', label: 'SMS' }, { value: 'telegram', label: 'Telegram' }]} placeholder="Auto (Telegram → SMS)" />
            </Field>
          )}
          <Field label={t('msg.template')} full>
            <Select value="" options={templates.map((x) => ({ value: x.id, label: x.name }))} placeholder="—" onChange={(e) => setText(templates.find((x) => x.id === e.target.value)?.text ?? text)} />
          </Field>
          <Field label={t('msg.text')} full>
            <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="full row between">
            <span className="small muted">{text.length} · {Math.max(1, Math.ceil(text.length / 160))} SMS · {t('msg.vars')}: {TEMPLATE_VARS.join(' ')}</span>
            <Button variant="primary" icon={<Send size={15} />} disabled={busy || !text.trim()} onClick={submit}>
              {t('common.send')} ({recipients.length})
            </Button>
          </div>
        </div>
      </Card>
      <Card title={`${t('msg.recipients')}: ${recipients.length}`}>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {recipients.slice(0, 100).map((r, i) => (
            <div key={i} className="list-item">
              <div className="grow ellipsis small bold">{r.name}</div>
              <span className="small muted">{r.telegram_chat_id ? 'TG' : r.phone}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Templates() {
  const t = useT()
  return (
    <ResourcePage
      table="message_templates"
      title=""
      editable
      addLabel={t('common.add')}
      searchText={(x) => x.name + x.text}
      columns={[
        { key: 'name', label: t('common.name'), render: (x) => <b>{x.name}</b> },
        { key: 'trigger', label: t('msg.trigger'), render: (x) => <Badge tone={x.trigger === 'manual' ? 'gray' : 'blue'}>{t('msg.trigger.' + x.trigger)}</Badge> },
        { key: 'text', label: t('msg.text'), render: (x) => <span className="small">{x.text}</span> },
        { key: 'is_active', label: t('common.status'), render: (x) => (x.is_active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>) },
      ]}
      fields={[
        { name: 'name', label: t('common.name'), required: true },
        { name: 'trigger', label: t('msg.trigger'), type: 'select', required: true, options: TRIGGERS.map((x) => ({ value: x, label: t('msg.trigger.' + x) })) },
        { name: 'text', label: t('msg.text'), type: 'textarea', required: true, hint: TEMPLATE_VARS.join(' ') },
        { name: 'is_active', label: t('common.status'), type: 'checkbox', placeholder: t('common.active') },
      ]}
      defaults={() => ({ trigger: 'manual', is_active: true })}
    />
  )
}

function History() {
  const t = useT()
  const L = useLookups()
  const rows = useRows('messages')
  return (
    <Card>
      <DataTable
        rows={rows}
        initialSort={{ key: 'created_at', dir: -1 }}
        columns={[
          { key: 'created_at', label: t('common.date'), render: (m) => <span className="nowrap small">{dateTime(m.created_at)}</span> },
          { key: 'channel', label: t('msg.channel'), render: (m) => <Badge tone={m.channel === 'telegram' ? 'blue' : 'gray'}>{m.channel.toUpperCase()}</Badge> },
          { key: 'recipient_name', label: t('msg.recipients'), render: (m) => <div><div className="bold small">{m.recipient_name}</div><div className="small muted">{m.recipient}</div></div> },
          { key: 'text', label: t('msg.text'), render: (m) => <span className="small">{m.text}</span> },
          { key: 'status', label: t('common.status'), render: (m) => <Badge tone={m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'yellow'}>{t('msg.status.' + m.status)}</Badge> },
          { key: 'by', label: t('audit.user'), hideSm: true, render: (m) => <span className="small">{L.profiles.get(m.created_by || '')?.full_name ?? 'Auto'}</span> },
        ]}
      />
    </Card>
  )
}
