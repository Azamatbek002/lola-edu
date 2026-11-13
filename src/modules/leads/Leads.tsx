import { useMemo, useState } from 'react'
import { Copy, KanbanSquare, List, Phone, Plus, UserCheck, PieChart } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, Field, Input, Modal, PageHead, SearchInput, Select, Stat, Tabs, Textarea, Avatar } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { EntityForm, type FieldDef } from '@/crud/EntityForm'
import { date, dateTime, downloadCSV, phone, todayISO } from '@/lib/format'
import { conversionRate, leadFunnel, leadsBySource } from '@/lib/analytics'
import { LEAD_STAGES, LEVELS, type Lead, type LeadStage } from '@/lib/types'
import { STAGE_COLOR, useLookups, useOptions } from '../shared'
import { SOURCES } from '../students/Students'
import { EnrollModal } from '../students/StudentProfile'

type View = 'kanban' | 'list' | 'stats'

export function leadFields(t: ReturnType<typeof useT>, opts: ReturnType<typeof useOptions>, campaigns: { value: string; label: string }[]): FieldDef<Lead>[] {
  return [
    { name: 'full_name', label: t('common.fullName'), required: true },
    { name: 'phone', label: t('common.phone'), type: 'phone', required: true },
    { name: 'source', label: t('common.source'), type: 'select', required: true, options: SOURCES.map((s) => ({ value: s, label: s })) },
    { name: 'campaign_id', label: t('lead.campaign'), type: 'select', options: campaigns },
    { name: 'course_id', label: t('lead.course'), type: 'select', options: opts.courses },
    { name: 'level', label: t('common.level'), type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
    { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches },
    { name: 'assigned_to', label: t('common.assignee'), type: 'select', options: opts.staff },
    { name: 'stage', label: t('common.status'), type: 'select', required: true, options: LEAD_STAGES.map((s) => ({ value: s, label: t('lead.stage.' + s) })) },
    { name: 'next_contact_at', label: t('lead.nextContact'), type: 'date' },
    { name: 'trial_date', label: t('lead.trialDate'), type: 'date', show: (v) => v.stage === 'trial_scheduled' || v.stage === 'trial_attended' },
    { name: 'trial_group_id', label: t('lead.trialGroup'), type: 'select', options: opts.groups, show: (v) => v.stage === 'trial_scheduled' || v.stage === 'trial_attended' },
    { name: 'lost_reason', label: t('lead.lostReason'), show: (v) => v.stage === 'lost', full: true },
    { name: 'notes', label: t('common.note'), type: 'textarea' },
  ]
}

export default function LeadsPage() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const byBranch = useBranchFilter()
  const opts = useOptions()
  const L = useLookups()
  const all = byBranch(useRows('leads'))
  const campaigns = useRows('campaigns')
  const m = useMutate('leads')
  const am = useMutate('lead_activities')
  const [view, setView] = useState<View>(() => (window.innerWidth < 700 ? 'list' : 'kanban'))
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const [mine, setMine] = useState(me.role === 'sales')
  const [editing, setEditing] = useState<Partial<Lead> | null>(null)
  const [open, setOpen] = useState<Lead | null>(null)
  const [dragOver, setDragOver] = useState<LeadStage | null>(null)
  const editable = canEdit(me.role, 'leads')
  const today = todayISO()

  const leads = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter(
      (l) =>
        (!s || (l.full_name + l.phone + (l.notes ?? '')).toLowerCase().includes(s)) &&
        (!source || l.source === source) &&
        (!mine || l.assigned_to === me.id),
    )
  }, [all, q, source, mine, me.id])

  const campaignOpts = campaigns.map((c) => ({ value: c.id, label: c.name }))

  const moveTo = async (l: Lead, stage: LeadStage) => {
    if (l.stage === stage) return
    if (stage === 'lost') {
      setEditing({ ...l, stage })
      return
    }
    await m.update(l.id, { stage })
    await am.create({ lead_id: l.id, type: 'stage', text: `${t('lead.stage.' + l.stage)} → ${t('lead.stage.' + stage)}`, created_by: me.id })
    if (stage === 'won' && !l.student_id) setOpen({ ...l, stage })
  }

  const publicUrl = `${location.origin}/apply`

  return (
    <>
      <PageHead
        title={t('nav.leads')}
        subtitle={`${all.length} · ${t('dash.conversion')}: ${conversionRate(all)}%`}
        actions={
          <>
            <Button icon={<Copy size={15} />} className="hide-sm" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success(publicUrl) }} title={t('lead.publicFormHint')}>
              {t('lead.publicForm')}
            </Button>
            <Button className="hide-sm" onClick={() => downloadCSV('leads.csv', [[t('common.fullName'), t('common.phone'), t('common.source'), t('common.status'), t('common.createdAt')], ...leads.map((l) => [l.full_name, l.phone, l.source, t('lead.stage.' + l.stage), l.created_at?.slice(0, 10)])])}>
              {t('common.export')}
            </Button>
            {editable && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ stage: 'new', source: 'Instagram', assigned_to: me.id, branch_id: me.branch_id ?? opts.branches[0]?.value })}>{t('lead.add')}</Button>}
          </>
        }
      />
      <div className="toolbar">
        <Tabs value={view} onChange={setView} tabs={[{ key: 'kanban', label: <><KanbanSquare size={14} /> {t('lead.kanban')}</> }, { key: 'list', label: <><List size={14} /> {t('lead.list')}</> }, { key: 'stats', label: <><PieChart size={14} /> {t('lead.funnel')}</> }]} />
        <SearchInput value={q} onChange={setQ} />
        <Select style={{ width: 150 }} value={source} onChange={(e) => setSource(e.target.value)} options={SOURCES.map((s) => ({ value: s, label: s }))} placeholder={t('common.source') + ': ' + t('common.all')} />
        <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('dash.myTasks').split(' ')[0]}</label>
      </div>

      {view === 'kanban' && (
        <div className="kanban">
          {LEAD_STAGES.map((stage) => {
            const list = leads.filter((l) => l.stage === stage).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            return (
              <div
                key={stage}
                className={'kanban-col' + (dragOver === stage ? ' over' : '')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  setDragOver(null)
                  const id = e.dataTransfer.getData('text/plain')
                  const l = all.find((x) => x.id === id)
                  if (l && editable) moveTo(l, stage)
                }}
              >
                <div className="kanban-col-head">
                  <span className="dot" style={{ background: STAGE_COLOR[stage] }} />
                  {t('lead.stage.' + stage)}
                  <Badge>{list.length}</Badge>
                </div>
                <div className="kanban-col-body">
                  {list.map((l) => (
                    <div key={l.id} className="kanban-card" draggable={editable} onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)} onClick={() => setOpen(l)}>
                      <div className="bold">{l.full_name}</div>
                      <div className="small muted">{phone(l.phone)}</div>
                      <div className="row-wrap" style={{ marginTop: 6, gap: 4 }}>
                        <Badge>{l.source}</Badge>
                        {l.course_id && <Badge tone="purple">{L.courses.get(l.course_id)?.name.split(' ')[0]} {L.courses.get(l.course_id)?.level}</Badge>}
                        {l.next_contact_at && !['won', 'lost'].includes(l.stage) && <Badge tone={l.next_contact_at < today ? 'red' : l.next_contact_at === today ? 'yellow' : 'gray'}>☎ {date(l.next_contact_at)}</Badge>}
                        {l.trial_date && stage === 'trial_scheduled' && <Badge tone="blue">🎓 {date(l.trial_date)}</Badge>}
                      </div>
                      {l.assigned_to && <div className="small muted" style={{ marginTop: 4 }}>👤 {L.profiles.get(l.assigned_to)?.full_name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'list' && (
        <Card>
          <DataTable
            rows={leads}
            onRowClick={setOpen}
            initialSort={{ key: 'created_at', dir: -1 }}
            columns={[
              { key: 'full_name', label: t('common.fullName'), render: (l) => <div><div className="bold">{l.full_name}</div><div className="small muted">{phone(l.phone)}</div></div> },
              { key: 'stage', label: t('common.status'), render: (l) => <Badge><span className="dot" style={{ background: STAGE_COLOR[l.stage] }} /> {t('lead.stage.' + l.stage)}</Badge> },
              { key: 'source', label: t('common.source'), hideSm: true },
              { key: 'course', label: t('lead.course'), hideSm: true, value: (l) => L.courses.get(l.course_id || '')?.name, render: (l) => L.courses.get(l.course_id || '')?.name ?? '—' },
              { key: 'assigned', label: t('common.assignee'), hideSm: true, value: (l) => L.profiles.get(l.assigned_to || '')?.full_name, render: (l) => L.profiles.get(l.assigned_to || '')?.full_name ?? '—' },
              { key: 'next_contact_at', label: t('lead.nextContact'), render: (l) => <span className={l.next_contact_at && l.next_contact_at < today && !['won', 'lost'].includes(l.stage) ? 'red bold' : ''}>{date(l.next_contact_at)}</span> },
              { key: 'created_at', label: t('common.createdAt'), render: (l) => date(l.created_at) },
            ]}
          />
        </Card>
      )}

      {view === 'stats' && <LeadStats leads={leads} />}

      {editing && (
        <EntityForm
          title={editing.id ? t('common.edit') : t('lead.add')}
          fields={leadFields(t, opts, campaignOpts)}
          initial={editing as Lead}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const { id, created_at, ...patch } = v
            if (id) {
              const prev = all.find((x) => x.id === id)
              await m.update(id, patch)
              if (prev && prev.stage !== patch.stage) await am.create({ lead_id: id, type: 'stage', text: `${t('lead.stage.' + prev.stage)} → ${t('lead.stage.' + patch.stage)}${patch.lost_reason ? ': ' + patch.lost_reason : ''}`, created_by: me.id })
            } else {
              const dup = all.find((x) => x.phone === patch.phone)
              if (dup) toast.error(`${dup.full_name} — ${phone(dup.phone)}`)
              await m.create(patch)
            }
            toast.success(t('common.saved'))
            setEditing(null)
          }}
        />
      )}
      {open && <LeadDrawer lead={all.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} onEdit={(l) => { setOpen(null); setEditing(l) }} />}
    </>
  )
}

function LeadStats({ leads }: { leads: Lead[] }) {
  const t = useT()
  const funnel = leadFunnel(leads)
  const sources = leadsBySource(leads)
  const lost = leads.filter((l) => l.stage === 'lost')
  const reasons = [...lost.reduce((m, l) => m.set(l.lost_reason || '—', (m.get(l.lost_reason || '—') || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  return (
    <div className="grid grid-2">
      <Card title={t('lead.funnel')}>
        <div className="card-body">
          {funnel.map((f) => (
            <div key={f.stage} style={{ marginBottom: 10 }}>
              <div className="row between small"><span>{t('lead.stage.' + f.stage)}</span><b>{f.reached} <span className="muted">({funnel[0].reached ? Math.round((f.reached / funnel[0].reached) * 100) : 0}%)</span></b></div>
              <div className="progress" style={{ height: 22, borderRadius: 6 }}>
                <div style={{ width: (funnel[0].reached ? (f.reached / funnel[0].reached) * 100 : 0) + '%', background: STAGE_COLOR[f.stage], borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('lead.bySource')}>
        <div className="card-body chart-box">
          <ResponsiveContainer>
            <BarChart data={sources} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="source" width={90} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }} />
              <Bar dataKey="leads" name={t('mk.leads')} fill="#94a3b8" radius={[0, 6, 6, 0]} />
              <Bar dataKey="won" name={t('mk.won')} radius={[0, 6, 6, 0]}>
                {sources.map((s) => <Cell key={s.source} fill="#c0272d" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable rows={sources.map((s) => ({ id: s.source, ...s }))} columns={[{ key: 'source', label: t('common.source') }, { key: 'leads', label: t('mk.leads'), num: true }, { key: 'won', label: t('mk.won'), num: true }, { key: 'conversion', label: t('dash.conversion'), num: true, render: (s) => s.conversion + '%' }]} />
      </Card>
      <Card title={t('lead.lostReason')}>
        {reasons.map(([r, n]) => (
          <div key={r} className="list-item"><div className="grow">{r}</div><Badge tone="red">{n}</Badge></div>
        ))}
      </Card>
      <div className="grid grid-2">
        <Stat icon={<UserCheck size={20} />} color="#12a150" label={t('lead.stage.won')} value={leads.filter((l) => l.stage === 'won').length} />
        <Stat icon={<Phone size={20} />} color="#2563eb" label={t('lead.overdue')} value={leads.filter((l) => l.next_contact_at && l.next_contact_at < todayISO() && !['won', 'lost'].includes(l.stage)).length} />
      </div>
    </div>
  )
}

function LeadDrawer({ lead, onClose, onEdit }: { lead: Lead; onClose: () => void; onEdit: (l: Lead) => void }) {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const L = useLookups()
  const acts = useRows('lead_activities').filter((a) => a.lead_id === lead.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const am = useMutate('lead_activities')
  const lm = useMutate('leads')
  const sm = useMutate('students')
  const [type, setType] = useState<'call' | 'note' | 'sms' | 'meeting'>('call')
  const [text, setText] = useState('')
  const [next, setNext] = useState('')
  const [enrollFor, setEnrollFor] = useState<string | null>(null)
  const editable = canEdit(me.role, 'leads')

  const add = async () => {
    if (!text.trim()) return
    await am.create({ lead_id: lead.id, type, text, created_by: me.id })
    const patch: Partial<Lead> = {}
    if (next) patch.next_contact_at = next
    if (lead.stage === 'new' && type === 'call') patch.stage = 'contacted'
    if (Object.keys(patch).length) await lm.update(lead.id, patch)
    setText('')
    setNext('')
  }

  const convert = async () => {
    const st = await sm.create({ full_name: lead.full_name, phone: lead.phone, branch_id: lead.branch_id || L.branches.values().next().value?.id, status: 'active', source: lead.source, lead_id: lead.id, level: lead.level ?? null })
    await lm.update(lead.id, { stage: 'won', student_id: st.id })
    await am.create({ lead_id: lead.id, type: 'stage', text: t('lead.converted'), created_by: me.id })
    toast.success(t('lead.converted'))
    setEnrollFor(st.id)
  }

  if (enrollFor) return <EnrollModal studentId={enrollFor} groupId={lead.trial_group_id || undefined} onClose={onClose} />

  return (
    <Modal title={lead.full_name} onClose={onClose} wide>
      <div className="grid grid-2">
        <div>
          <div className="row-wrap mb">
            <Badge><span className="dot" style={{ background: STAGE_COLOR[lead.stage] }} /> {t('lead.stage.' + lead.stage)}</Badge>
            <Badge>{lead.source}</Badge>
            {lead.level && <Badge tone="purple">{lead.level}</Badge>}
          </div>
          <div className="col small" style={{ gap: 6 }}>
            <div><Phone size={13} /> <a className="link" href={'tel:' + lead.phone}>{phone(lead.phone)}</a></div>
            <div>{t('lead.course')}: <b>{L.courses.get(lead.course_id || '')?.name ?? '—'}</b></div>
            <div>{t('common.branch')}: {L.branches.get(lead.branch_id || '')?.name ?? '—'}</div>
            <div>{t('common.assignee')}: {L.profiles.get(lead.assigned_to || '')?.full_name ?? '—'}</div>
            <div>{t('lead.nextContact')}: {date(lead.next_contact_at)}</div>
            {lead.trial_date && <div>{t('lead.trialDate')}: {date(lead.trial_date)} · {L.groups.get(lead.trial_group_id || '')?.name}</div>}
            {lead.lost_reason && <div className="red">{t('lead.lostReason')}: {lead.lost_reason}</div>}
            {lead.utm_campaign && <div className="muted">UTM: {lead.utm_source} / {lead.utm_campaign}</div>}
            <div className="muted">{t('common.createdAt')}: {dateTime(lead.created_at)}</div>
            {lead.notes && <p>{lead.notes}</p>}
          </div>
          {editable && (
            <div className="row-wrap mt">
              <Button onClick={() => onEdit(lead)}>{t('common.edit')}</Button>
              {!lead.student_id && <Button variant="success" icon={<UserCheck size={15} />} onClick={convert}>{t('lead.convert')}</Button>}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb">{t('lead.activities')}</h3>
          {editable && (
            <div className="card card-pad mb" style={{ padding: 12 }}>
              <Tabs value={type} onChange={setType} tabs={(['call', 'note', 'sms', 'meeting'] as const).map((k) => ({ key: k, label: t('lead.act.' + k) }))} />
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('common.comment')} />
              <div className="row mt" style={{ marginTop: 8 }}>
                <Field label={t('lead.nextContact')}><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
                <Button variant="primary" onClick={add} disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}>{t('common.add')}</Button>
              </div>
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {acts.map((a) => (
              <div key={a.id} className="row" style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <Avatar name={L.profiles.get(a.created_by || '')?.full_name} />
                <div className="grow">
                  <div className="small"><b>{t('lead.act.' + a.type)}</b> · <span className="muted">{dateTime(a.created_at)}</span></div>
                  <div className="small">{a.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

