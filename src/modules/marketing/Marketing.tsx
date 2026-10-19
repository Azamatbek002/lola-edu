import { useMemo, useState } from 'react'
import { Megaphone, Target, TrendingUp, Users } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { ResourcePage } from '@/crud/ResourcePage'
import { Avatar, Badge, Card, PageHead, Progress, Stat, Tabs } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { addDays, date, money, moneyShort, todayISO } from '@/lib/format'
import { campaignStats } from '@/lib/analytics'
import { sumPayments } from '@/lib/finance'
import { SOURCES } from '../students/Students'

type Tab = 'overview' | 'campaigns' | 'promo' | 'referrals'

export default function MarketingPage() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <>
      <PageHead title={t('nav.marketing')} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: t('mk.overview') },
          { key: 'campaigns', label: t('nav.campaigns') },
          { key: 'promo', label: t('nav.promo') },
          { key: 'referrals', label: t('referral.title') },
        ]}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'promo' && <Promo />}
      {tab === 'referrals' && <Referrals />}
    </>
  )
}

function Overview() {
  const t = useT()
  const campaigns = useRows('campaigns')
  const leads = useRows('leads')
  const payments = useRows('payments')
  const stats = useMemo(() => campaignStats(campaigns, leads), [campaigns, leads])
  const spent = campaigns.reduce((s, c) => s + c.spent, 0)
  const won = leads.filter((l) => l.stage === 'won' && l.campaign_id)
  const revenue = useMemo(() => {
    const ids = new Set(won.map((l) => l.student_id).filter(Boolean))
    return sumPayments(payments.filter((p) => ids.has(p.student_id)))
  }, [won, payments])
  return (
    <>
      <div className="grid grid-stats mb">
        <Stat icon={<Megaphone size={20} />} label={t('mk.totalSpent')} value={moneyShort(spent)} />
        <Stat icon={<Target size={20} />} color="#7c3aed" label={t('mk.cpl')} value={moneyShort(leads.filter((l) => l.campaign_id).length ? spent / leads.filter((l) => l.campaign_id).length : 0)} />
        <Stat icon={<Users size={20} />} color="#2563eb" label={t('mk.cac')} value={moneyShort(won.length ? spent / won.length : 0)} />
        <Stat icon={<TrendingUp size={20} />} color="#12a150" label={t('mk.roi')} value={spent ? Math.round(((revenue - spent) / spent) * 100) + '%' : '—'} sub={<span className="muted">{t('rep.revenue')}: {moneyShort(revenue)}</span>} />
      </div>
      <Card>
        <DataTable
          rows={stats.map((s) => ({ id: s.campaign.id, ...s }))}
          columns={[
            { key: 'name', label: t('common.name'), value: (s) => s.campaign.name, render: (s) => <div><div className="bold">{s.campaign.name}</div><div className="small muted">{s.campaign.channel} · {date(s.campaign.start_date)}</div></div> },
            { key: 'status', label: t('common.status'), render: (s) => <Badge tone={s.campaign.status === 'running' ? 'green' : s.campaign.status === 'planned' ? 'blue' : 'gray'}>{t('mk.status.' + s.campaign.status)}</Badge> },
            { key: 'spent', label: t('mk.spent'), num: true, value: (s) => s.campaign.spent, render: (s) => <div style={{ minWidth: 120 }}>{money(s.campaign.spent)}<Progress value={s.campaign.budget ? (s.campaign.spent / s.campaign.budget) * 100 : 0} /></div> },
            { key: 'leads', label: t('mk.leads'), num: true },
            { key: 'won', label: t('mk.won'), num: true },
            { key: 'cpl', label: t('mk.cpl'), num: true, render: (s) => money(s.cpl) },
            { key: 'cac', label: t('mk.cac'), num: true, render: (s) => (s.cac ? money(s.cac) : '—') },
          ]}
        />
      </Card>
    </>
  )
}

function Campaigns() {
  const t = useT()
  const me = useMe()
  return (
    <ResourcePage
      table="campaigns"
      title=""
      editable={canEdit(me.role, 'marketing')}
      addLabel={t('mk.addCampaign')}
      searchText={(c) => c.name + c.channel}
      columns={[
        { key: 'name', label: t('common.name'), render: (c) => <b>{c.name}</b> },
        { key: 'channel', label: t('mk.channel') },
        { key: 'period', label: t('rep.period'), value: (c) => c.start_date, render: (c) => `${date(c.start_date)} — ${date(c.end_date)}`, hideSm: true },
        { key: 'budget', label: t('mk.budget'), num: true, render: (c) => money(c.budget) },
        { key: 'spent', label: t('mk.spent'), num: true, render: (c) => money(c.spent) },
        { key: 'status', label: t('common.status'), render: (c) => <Badge tone={c.status === 'running' ? 'green' : 'gray'}>{t('mk.status.' + c.status)}</Badge> },
      ]}
      fields={[
        { name: 'name', label: t('common.name'), required: true, full: true },
        { name: 'channel', label: t('mk.channel'), type: 'select', required: true, options: SOURCES.map((s) => ({ value: s, label: s })) },
        { name: 'status', label: t('common.status'), type: 'select', required: true, options: ['planned', 'running', 'finished'].map((s) => ({ value: s, label: t('mk.status.' + s) })) },
        { name: 'start_date', label: t('group.startDate'), type: 'date', required: true },
        { name: 'end_date', label: t('group.endDate'), type: 'date' },
        { name: 'budget', label: t('mk.budget'), type: 'money', required: true },
        { name: 'spent', label: t('mk.spent'), type: 'money' },
        { name: 'notes', label: t('common.note'), type: 'textarea' },
      ]}
      defaults={() => ({ status: 'planned', start_date: todayISO(), end_date: addDays(todayISO(), 30), budget: 0, spent: 0, channel: 'Instagram' })}
    />
  )
}

function Promo() {
  const t = useT()
  const me = useMe()
  return (
    <ResourcePage
      table="promo_codes"
      title=""
      editable={canEdit(me.role, 'marketing')}
      addLabel={t('promo.add')}
      searchText={(c) => c.code}
      beforeSave={(v) => ({ ...v, code: String(v.code).toUpperCase().replace(/\s/g, '') })}
      columns={[
        { key: 'code', label: t('common.code'), render: (c) => <code className="bold">{c.code}</code> },
        { key: 'discount', label: t('student.discount'), value: (c) => c.discount_percent || c.discount_amount, render: (c) => (c.discount_percent ? c.discount_percent + '%' : money(c.discount_amount)) },
        { key: 'used', label: t('promo.used'), num: true, value: (c) => c.used_count, render: (c) => `${c.used_count}${c.max_uses ? ' / ' + c.max_uses : ''}` },
        { key: 'valid_until', label: t('promo.validUntil'), render: (c) => <span className={c.valid_until && c.valid_until < todayISO() ? 'red' : ''}>{date(c.valid_until)}</span> },
        { key: 'is_active', label: t('common.status'), render: (c) => (c.is_active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>) },
      ]}
      fields={[
        { name: 'code', label: t('common.code'), required: true },
        { name: 'valid_until', label: t('promo.validUntil'), type: 'date' },
        { name: 'discount_percent', label: t('student.discountPercent'), type: 'number', max: 100 },
        { name: 'discount_amount', label: t('student.discountAmount'), type: 'money' },
        { name: 'max_uses', label: t('promo.maxUses'), type: 'number' },
        { name: 'is_active', label: t('common.status'), type: 'checkbox', placeholder: t('common.active') },
      ]}
      validate={(v) => (!v.discount_percent && !v.discount_amount ? t('student.discount') + ': ' + t('common.required') : null)}
      defaults={() => ({ is_active: true, used_count: 0, discount_percent: 10 })}
    />
  )
}

function Referrals() {
  const t = useT()
  const students = useRows('students')
  const rows = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of students) if (s.referred_by) m.set(s.referred_by, [...(m.get(s.referred_by) || []), s.full_name])
    return [...m.entries()].map(([id, list]) => ({ id, name: students.find((s) => s.id === id)?.full_name ?? '?', list })).sort((a, b) => b.list.length - a.list.length)
  }, [students])
  return (
    <Card>
      <DataTable
        rows={rows}
        empty={t('student.referredBy') + ' — ' + t('common.empty')}
        columns={[
          { key: 'name', label: t('role.student'), render: (r) => <div className="row"><Avatar name={r.name} /><b>{r.name}</b></div> },
          { key: 'count', label: t('common.count'), num: true, value: (r) => r.list.length, render: (r) => <Badge tone="brand">{r.list.length}</Badge> },
          { key: 'list', label: t('group.students'), render: (r) => <span className="small">{r.list.join(', ')}</span> },
        ]}
      />
    </Card>
  )
}
