// "Gapirish imtihoni" bo'limi: o'quvchi — variantlar va natijalar; ota-ona — farzandining natijalari;
// ustoz va rahbariyat — topshirilgan imtihonlar (baholash) va variantlar.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CloudArrowUp, Copy, Eye, Microphone, Pencil, Play, Plus, Trash2, WifiSlash } from '@/components/icons'
import { Badge, Button, Card, Empty, Field, Modal, PageHead, SearchInput, Select, Tabs, useConfirm, type Tone } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { useMe } from '@/lib/auth'
import { useMutate, useRows } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { dateTime, fillTemplate } from '@/lib/format'
import { canEdit, canView } from '@/lib/permissions'
import { useToast } from '@/components/Toast'
import type { SpeakingAttempt, SpeakingVariant } from '@/lib/types'
import { useSpeakingSettings } from '@/lib/speaking/api'
import { maxTotal } from '@/lib/speaking/grading'
import { useUploadStatus } from '@/lib/speaking/uploader'
import { signedMediaUrls } from '@/lib/speaking/files'
import { sortItems } from '@/lib/speaking/timeline'
import { partTitle, Question } from './Exam'
import { copyVariant, createVariantFromTemplate } from './variantOps'

export const ATTEMPT_TONE: Record<SpeakingAttempt['status'], Tone> = { in_progress: 'yellow', submitted: 'blue', graded: 'green' }
export const attemptStatus = (t: (k: string) => string, s: SpeakingAttempt['status']) =>
  s === 'in_progress' ? t('sp.st.inProgress') : s === 'submitted' ? t('sp.st.submitted') : t('sp.st.graded')

const byTitle = (a: SpeakingVariant, b: SpeakingVariant) => a.sort - b.sort || a.title.localeCompare(b.title, undefined, { numeric: true })

export default function SpeakingPage() {
  const me = useMe()
  if (me.role === 'student') return <StudentHome />
  if (me.role === 'parent') return <ParentHome />
  return <StaffHome />
}

function UploadBanner() {
  const t = useT()
  const u = useUploadStatus()
  if (!u.left) return null
  return (
    <div className={'sp-alert mb ' + (u.online ? '' : 'warn')}>
      {u.online ? <CloudArrowUp size={18} /> : <WifiSlash size={18} />} {fillTemplate(u.online ? t('sp.uploadingN') : t('sp.offlineSaved'), { n: u.left })}
    </div>
  )
}

// ─── O'quvchi ───────────────────────────────────────────────────────────────
function StudentHome() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const [tab, setTab] = useState<'variants' | 'results'>('variants')
  const variants = useRows('speaking_variants').filter((v) => v.status === 'published').sort(byTitle)
  const attempts = useRows('speaking_attempts').filter((a) => a.student_id === me.student_id)
  const open = attempts.find((a) => a.status === 'in_progress')
  const done = attempts.filter((a) => a.status !== 'in_progress')
  const last = [...done].filter((a) => a.status === 'graded').sort((a, b) => (b.graded_at ?? '').localeCompare(a.graded_at ?? ''))[0]
  return (
    <>
      <PageHead title={t('nav.speaking')} subtitle={t('sp.subtitle')} />
      <UploadBanner />
      <div className="card sp-hero mb">
        <div className="sp-hero-icon">
          <Microphone size={26} />
        </div>
        <div className="grow">
          <h3>{t('sp.takeExam')}</h3>
          <p className="small muted">{t('sp.takeExamHint')}</p>
          {last && (
            <p className="small mt-xs">
              {t('sp.lastResult')}: <b>{last.total ?? '—'}</b>
              {last.level ? ` · ${last.level}` : ''}
            </p>
          )}
        </div>
        {open ? (
          <Button variant="primary" icon={<Play size={15} />} onClick={() => nav(`/exam/${open.id}`)}>
            {t('sp.resume')}
          </Button>
        ) : (
          <Button variant="primary" disabled={!variants.length} onClick={() => nav('/speaking/start')}>
            {t('sp.start')}
          </Button>
        )}
      </div>
      <Tabs
        tabs={[
          { key: 'variants', label: `${t('sp.prepVariants')} (${variants.length})` },
          { key: 'results', label: `${t('sp.myResults')}${done.length ? ` (${done.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'variants' ? <VariantGrid variants={variants} /> : <ResultsList attempts={attempts} />}
    </>
  )
}

/** Tayyorlanish uchun: e'lon qilingan barcha variantlar (savollarini ochib ko'rish mumkin) */
function VariantGrid({ variants }: { variants: SpeakingVariant[] }) {
  const t = useT()
  const nav = useNavigate()
  if (!variants.length)
    return (
      <Card>
        <Empty text={t('sp.noVariants')} />
      </Card>
    )
  return (
    <>
      <p className="small muted mb">{t('sp.prepHint')}</p>
      <div className="sp-grid">
        {variants.map((v) => (
          <button key={v.id} className="card sp-vcard" onClick={() => nav(`/speaking/view/${v.id}`)}>
            <div className="sp-vicon">
              <Eye size={20} />
            </div>
            <div className="grow">
              <b>{v.title}</b>
              <div className="small muted">
                {v.level ? `${v.level} · ` : ''}
                {t('sp.parts3')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

/** O'quvchi va ota-ona: variant savollarini ko'rish (tayyorlanish uchun) */
export function VariantView() {
  const { id = '' } = useParams()
  const t = useT()
  const nav = useNavigate()
  const variant = useRows('speaking_variants').find((v) => v.id === id)
  const allItems = useRows('speaking_items')
  const items = useMemo(() => sortItems(allItems.filter((i) => i.variant_id === id)), [allItems, id])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = items.map((i) => i.images.join(',')).join('|')
  useEffect(() => {
    let off = false
    signedMediaUrls(items.flatMap((i) => i.images ?? []))
      .then((u) => !off && setUrls(u))
      .catch(() => undefined)
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <>
      <PageHead
        title={variant?.title ?? t('nav.speaking')}
        subtitle={t('sp.viewHint')}
        actions={
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => nav('/speaking')}>
            {t('common.back')}
          </Button>
        }
      />
      {!items.length ? (
        <Card>
          <Empty text={t('sp.noQuestions')} />
        </Card>
      ) : (
        <div className="sp-preview">
          {items.map((it, i) => (
            <div key={it.id} className="ex-card">
              <div className="ex-card-head">
                <b>
                  {partTitle(it.part)}
                  {it.part === '1.1' || it.part === '1.2' ? ` · ${i + 1}. soru` : ''}
                </b>
                <span className="small muted">
                  {fillTemplate(t('sp.timeShort'), { p: it.prep_seconds, a: it.answer_seconds })}
                </span>
              </div>
              <Question item={it} urls={urls} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Ota-ona ────────────────────────────────────────────────────────────────
function ParentHome() {
  const t = useT()
  const me = useMe()
  const attempts = useRows('speaking_attempts').filter((a) => a.student_id === me.student_id)
  return (
    <>
      <PageHead title={t('nav.speaking')} subtitle={t('sp.parentSubtitle')} />
      <ResultsList attempts={attempts} />
    </>
  )
}

/** O'quvchi va ota-ona uchun: natijalar (ball, daraja, izoh). Ovoz yozuvlari ko'rsatilmaydi. */
function ResultsList({ attempts }: { attempts: SpeakingAttempt[] }) {
  const t = useT()
  const variants = useRows('speaking_variants')
  const settings = useSpeakingSettings()
  const [open, setOpen] = useState<SpeakingAttempt | null>(null)
  const list = [...attempts].sort((a, b) => (b.submitted_at ?? b.started_at).localeCompare(a.submitted_at ?? a.started_at))
  const title = (id: string) => variants.find((v) => v.id === id)?.title ?? '—'
  if (!list.length)
    return (
      <Card>
        <Empty text={t('sp.noResults')} />
      </Card>
    )
  const max = maxTotal(settings.criteria)
  return (
    <>
      <div className="card">
        {list.map((a) => (
          <button key={a.id} className="list-item sp-result" onClick={() => a.status === 'graded' && setOpen(a)} disabled={a.status !== 'graded'}>
            <div className="grow">
              <b>{title(a.variant_id)}</b>
              <div className="small muted">{dateTime(a.submitted_at ?? a.started_at)}</div>
            </div>
            {a.status === 'graded' ? (
              <div className="right">
                <div className="sp-total">
                  {a.total ?? '—'}
                  {max ? <small>/{max}</small> : null}
                </div>
                {a.level && <Badge tone="green">{a.level}</Badge>}
              </div>
            ) : (
              <Badge tone={ATTEMPT_TONE[a.status]}>{attemptStatus(t, a.status)}</Badge>
            )}
          </button>
        ))}
      </div>
      {open && (
        <Modal title={title(open.variant_id)} onClose={() => setOpen(null)}>
          <div className="sp-res">
            <div className="sp-res-total">
              <span>{t('common.total')}</span>
              <b>
                {open.total ?? '—'}
                {max ? <small> / {max}</small> : null}
              </b>
              {open.level && <Badge tone="green">{open.level}</Badge>}
            </div>
            {!!settings.criteria.length && (
              <table className="table sp-crit">
                <tbody>
                  {settings.criteria.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="right">
                        <b>{open.scores?.[c.id] ?? '—'}</b> <span className="muted">/ {c.max}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {open.comment && (
              <div className="sp-comment">
                <span className="small muted">{t('sp.comment')}</span>
                <p>{open.comment}</p>
              </div>
            )}
            <p className="small muted">{fillTemplate(t('sp.gradedAt'), { d: dateTime(open.graded_at) })}</p>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Ustoz va rahbariyat ────────────────────────────────────────────────────
function StaffHome() {
  const t = useT()
  const me = useMe()
  const [tab, setTab] = useState<'results' | 'variants'>('results')
  const settings = useSpeakingSettings()
  return (
    <>
      <PageHead title={t('nav.speaking')} subtitle={t('sp.staffSubtitle')} />
      {!settings.criteria.length && (
        <div className="sp-alert mb">
          {t('sp.noCriteria')} {canView(me.role, 'settings') && <Link className="link" to="/settings#speaking">{t('nav.settings')}</Link>}
        </div>
      )}
      <Tabs
        tabs={[
          { key: 'results', label: t('sp.attempts') },
          { key: 'variants', label: t('sp.variants') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'results' ? <AttemptsTab /> : <VariantsTab />}
    </>
  )
}

function AttemptsTab() {
  const t = useT()
  const nav = useNavigate()
  const attempts = useRows('speaking_attempts')
  const students = useRows('students')
  const variants = useRows('speaking_variants')
  const settings = useSpeakingSettings()
  const [status, setStatus] = useState<'' | SpeakingAttempt['status']>('submitted')
  const [q, setQ] = useState('')
  const sName = useMemo(() => new Map(students.map((s) => [s.id, s.full_name])), [students])
  const vTitle = useMemo(() => new Map(variants.map((v) => [v.id, v.title])), [variants])
  const counts = { in_progress: 0, submitted: 0, graded: 0 }
  attempts.forEach((a) => counts[a.status]++)
  const rows = attempts
    .filter((a) => !status || a.status === status)
    .filter((a) => !q || (sName.get(a.student_id) ?? '').toLowerCase().includes(q.toLowerCase()) || (vTitle.get(a.variant_id) ?? '').toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row-wrap mb">
        <div className="grow">
          <SearchInput value={q} onChange={setQ} />
        </div>
        <Select
          className="select sp-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: 'submitted', label: `${t('sp.st.submitted')} (${counts.submitted})` },
            { value: 'graded', label: `${t('sp.st.graded')} (${counts.graded})` },
            { value: 'in_progress', label: `${t('sp.st.inProgress')} (${counts.in_progress})` },
            { value: '', label: `${t('common.all')} (${attempts.length})` },
          ]}
        />
      </div>
      <div className="card">
        <DataTable
          rows={rows}
          onRowClick={(a) => nav(`/speaking/attempt/${a.id}`)}
          initialSort={{ key: 'date', dir: -1 }}
          empty={t('sp.noAttempts')}
          columns={[
            { key: 'student', label: t('sp.student'), value: (a) => sName.get(a.student_id) ?? '', render: (a) => <b>{sName.get(a.student_id) ?? '—'}</b> },
            { key: 'variant', label: t('sp.variant'), value: (a) => vTitle.get(a.variant_id) ?? '', render: (a) => vTitle.get(a.variant_id) ?? '—' },
            { key: 'date', label: t('common.date', 'Sana'), value: (a) => a.submitted_at ?? a.started_at, render: (a) => dateTime(a.submitted_at ?? a.started_at), hideSm: true },
            { key: 'status', label: t('common.status'), value: (a) => a.status, render: (a) => <Badge tone={ATTEMPT_TONE[a.status]}>{attemptStatus(t, a.status)}</Badge> },
            { key: 'total', label: t('sp.score'), num: true, value: (a) => a.total ?? null, render: (a) => (a.total != null ? <b>{a.total}{a.level ? ` · ${a.level}` : ''}</b> : '—') },
          ]}
        />
      </div>
      <p className="small muted mt">{fillTemplate(t('sp.retentionNote'), { n: settings.retention_days_after_grading })}</p>
    </>
  )
}

function VariantsTab() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const variants = [...useRows('speaking_variants')].sort(byTitle)
  const items = useRows('speaking_items')
  const attempts = useRows('speaking_attempts')
  const m = useMutate('speaking_variants')
  const editable = canEdit(me.role, 'speaking')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'' | SpeakingVariant['status']>('')
  const [newOpen, setNewOpen] = useState(false)
  const qCount = (id: string) => items.filter((i) => i.variant_id === id).length
  const aCount = (id: string) => attempts.filter((a) => a.variant_id === id).length

  const create = async (title: string) => {
    setBusy(true)
    try {
      const id = await createVariantFromTemplate(title, me.id, variants.length + 1)
      nav(`/speaking/variant/${id}`)
    } catch (e) {
      toast.error((e as Error).message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }
  const duplicate = async (v: SpeakingVariant) => {
    setBusy(true)
    try {
      const id = await copyVariant(v, `${v.title} (${t('sp.copySuffix')})`, me.id, variants.length + 1)
      toast.success(t('common.saved'))
      nav(`/speaking/variant/${id}`)
    } catch (e) {
      toast.error((e as Error).message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (v: SpeakingVariant) => {
    if (!(await confirm(t('common.confirmDelete')))) return
    await m.remove(v.id)
  }
  const tone: Record<SpeakingVariant['status'], Tone> = { draft: 'gray', published: 'green', archived: 'yellow' }
  const rows = variants.filter((v) => !filter || v.status === filter)
  return (
    <>
      <div className="row-wrap mb">
        <Select
          className="select sp-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          options={[
            { value: '', label: t('common.all') },
            { value: 'published', label: t('sp.vs.published') },
            { value: 'draft', label: t('sp.vs.draft') },
            { value: 'archived', label: t('sp.vs.archived') },
          ]}
        />
        <div className="grow" />
        {editable && (
          <Button variant="primary" icon={<Plus size={16} />} disabled={busy} onClick={() => setNewOpen(true)}>
            {t('sp.newVariant')}
          </Button>
        )}
      </div>
      <div className="card">
        <DataTable
          rows={rows}
          pageSize={50}
          onRowClick={(v) => nav(`/speaking/variant/${v.id}`)}
          empty={t('sp.noVariants')}
          columns={[
            { key: 'title', label: t('common.name'), value: (v) => v.sort, render: (v) => <b>{v.title}</b> },
            { key: 'status', label: t('common.status'), value: (v) => v.status, render: (v) => <Badge tone={tone[v.status]}>{t('sp.vs.' + v.status)}</Badge> },
            { key: 'q', label: t('sp.questions'), num: true, value: (v) => qCount(v.id), hideSm: true },
            { key: 'a', label: t('sp.attempts'), num: true, value: (v) => aCount(v.id) },
            {
              key: 'act',
              label: '',
              render: (v) =>
                editable ? (
                  <div className="row" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil size={15} />} aria-label={t('common.edit')} onClick={() => nav(`/speaking/variant/${v.id}`)} />
                    <Button size="sm" variant="ghost" icon={<Copy size={15} />} aria-label={t('sp.duplicate')} title={t('sp.duplicate')} disabled={busy} onClick={() => duplicate(v)} />
                    {!aCount(v.id) && <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} aria-label={t('common.delete')} onClick={() => remove(v)} />}
                  </div>
                ) : null,
            },
          ]}
        />
      </div>
      {newOpen && <NewVariant defaultTitle={`Variant ${variants.length + 1}`} busy={busy} onClose={() => setNewOpen(false)} onCreate={create} />}
    </>
  )
}

function NewVariant({ defaultTitle, busy, onClose, onCreate }: { defaultTitle: string; busy: boolean; onClose: () => void; onCreate: (title: string) => void }) {
  const t = useT()
  const [title, setTitle] = useState(defaultTitle)
  return (
    <Modal
      title={t('sp.newVariant')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy || !title.trim()} onClick={() => onCreate(title.trim())}>
            {t('common.add')}
          </Button>
        </>
      }
    >
      <Field label={t('common.name')}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <p className="small muted mt">{t('sp.templateHint')}</p>
    </Modal>
  )
}
