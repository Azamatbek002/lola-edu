// Ustoz/rahbariyat: o'quvchi javoblarini eshitish, mezonlar bo'yicha ball, daraja va izoh qo'yish.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowsClockwise, AlertTriangle as Warning } from '@/components/icons'
import { Badge, Button, Card, Empty, Field, Input, PageHead, Select, Textarea, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth'
import { useMutate, useRows } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { dateTime, fillTemplate } from '@/lib/format'
import { canEdit } from '@/lib/permissions'
import { useToast } from '@/components/Toast'
import { useQueryClient } from '@tanstack/react-query'
import type { SpeakingAnswer, SpeakingItem } from '@/lib/types'
import { speakingApi, useSpeakingSettings } from '@/lib/speaking/api'
import { levelFor, maxTotal, scoresComplete, totalOf } from '@/lib/speaking/grading'
import { answerUrl, signedMediaUrls } from '@/lib/speaking/files'
import { sortItems } from '@/lib/speaking/timeline'
import { ATTEMPT_TONE, attemptStatus } from './Speaking'
import { partTitle, Question } from './Exam'

export default function GradePage() {
  const { id = '' } = useParams()
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const settings = useSpeakingSettings()
  const attempt = useRows('speaking_attempts').find((a) => a.id === id)
  const allItems = useRows('speaking_items')
  const answers = useRows('speaking_answers').filter((a) => a.attempt_id === id)
  const student = useRows('students').find((s) => s.id === attempt?.student_id)
  const variant = useRows('speaking_variants').find((v) => v.id === attempt?.variant_id)
  const items = useMemo(() => sortItems(allItems.filter((i) => i.variant_id === attempt?.variant_id)), [allItems, attempt?.variant_id])
  const m = useMutate('speaking_attempts')
  const [urls, setUrls] = useState<Record<string, string>>({})

  const [scores, setScores] = useState<Record<string, string>>({})
  const [manualTotal, setManualTotal] = useState('')
  const [level, setLevel] = useState('')
  const [comment, setComment] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  // Mavjud bahoni formaga yuklash
  useEffect(() => {
    if (!attempt || dirty) return
    setScores(Object.fromEntries(Object.entries(attempt.scores ?? {}).map(([k, v]) => [k, String(v)])))
    setManualTotal(attempt.total != null ? String(attempt.total) : '')
    setLevel(attempt.level ?? '')
    setComment(attempt.comment ?? '')
  }, [attempt, dirty])

  const imgKey = items.map((i) => i.images.join(',')).join('|')
  useEffect(() => {
    let off = false
    signedMediaUrls(items.flatMap((i) => i.images ?? []))
      .then((u) => !off && setUrls(u))
      .catch(() => undefined)
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgKey])

  if (!attempt)
    return (
      <Card>
        <Empty text={t('sp.notFound')} />
      </Card>
    )

  const crit = settings.criteria
  const total = crit.length ? totalOf(crit, scores) : manualTotal === '' ? null : Number(manualTotal)
  const suggested = levelFor(total, settings.levels)
  const max = maxTotal(crit)
  const canGrade = canEdit(me.role, 'speaking') && attempt.status !== 'in_progress'
  const complete = crit.length ? scoresComplete(crit, scores) : total != null && Number.isFinite(total)
  const missing = items.filter((i) => !answers.some((a) => a.item_id === i.id)).length
  const blurs = attempt.progress?.blurs ?? 0

  const save = async () => {
    if (!complete) {
      toast.error(t('sp.fillScores'))
      return
    }
    setBusy(true)
    try {
      await m.update(attempt.id, {
        scores: crit.length ? Object.fromEntries(crit.map((c) => [c.id, Math.min(c.max, Math.max(0, Number(scores[c.id])))])) : {},
        total,
        level: (level || suggested || '').trim() || null,
        comment: comment.trim() || null,
        status: 'graded',
        graded_by: me.id,
        graded_at: new Date().toISOString(),
      })
      setDirty(false)
      toast.success(t('sp.gradedOk'))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!(await confirm(t('sp.resetConfirm')))) return
    await speakingApi.resetAttempt(attempt.id)
    await qc.invalidateQueries({ queryKey: ['speaking_attempts'] })
    await qc.invalidateQueries({ queryKey: ['speaking_answers'] })
    toast.success(t('common.deleted'))
    nav('/speaking')
  }

  return (
    <>
      <PageHead
        title={student?.full_name ?? '—'}
        subtitle={`${variant?.title ?? ''} · ${dateTime(attempt.submitted_at ?? attempt.started_at)}`}
        actions={
          <>
            <Badge tone={ATTEMPT_TONE[attempt.status]}>{attemptStatus(t, attempt.status)}</Badge>
            <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => nav('/speaking')}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      {attempt.status === 'in_progress' && <div className="sp-alert mb">{t('sp.notFinishedYet')}</div>}
      {blurs > 0 && (
        <div className="sp-alert warn mb">
          <Warning size={17} /> {fillTemplate(t('sp.blurs'), { n: blurs })}
        </div>
      )}
      {missing > 0 && attempt.status !== 'in_progress' && !attempt.audio_deleted_at && <div className="sp-alert mb">{fillTemplate(t('sp.missingAnswers'), { n: missing })}</div>}
      {attempt.audio_deleted_at && <div className="sp-alert mb">{fillTemplate(t('sp.audioDeleted'), { d: dateTime(attempt.audio_deleted_at) })}</div>}

      <div className="sp-grade">
        <div className="sp-answers">
          {items.map((it, i) => (
            <AnswerCard key={it.id} item={it} n={i + 1} answer={answers.find((a) => a.item_id === it.id)} urls={urls} />
          ))}
        </div>
        <Card title={t('sp.grading')} pad className="sp-form">
          {!crit.length && <p className="small muted mb">{t('sp.noCriteriaShort')}</p>}
          <div className="col" style={{ gap: 12 }}>
            {crit.map((c) => (
              <Field key={c.id} label={`${c.name} (0–${c.max})`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={c.max}
                  step={0.5}
                  value={scores[c.id] ?? ''}
                  disabled={!canGrade}
                  onChange={(e) => {
                    setDirty(true)
                    setScores({ ...scores, [c.id]: e.target.value })
                  }}
                />
              </Field>
            ))}
            {crit.length ? (
              <div className="sp-res-total">
                <span>{t('common.total')}</span>
                <b>
                  {total ?? 0}
                  <small> / {max}</small>
                </b>
              </div>
            ) : (
              <Field label={t('sp.score')}>
                <Input type="number" inputMode="decimal" min={0} step={0.5} value={manualTotal} disabled={!canGrade} onChange={(e) => (setDirty(true), setManualTotal(e.target.value))} />
              </Field>
            )}
            <Field label={t('sp.level')} hint={suggested ? fillTemplate(t('sp.levelSuggested'), { l: suggested }) : undefined}>
              {settings.levels.length ? (
                <Select
                  value={level || suggested || ''}
                  disabled={!canGrade}
                  onChange={(e) => (setDirty(true), setLevel(e.target.value))}
                  placeholder="—"
                  options={settings.levels.map((l) => ({ value: l.name, label: `${l.name} (≥ ${l.min})` }))}
                />
              ) : (
                <Input value={level} disabled={!canGrade} placeholder="B1, B2, C1…" onChange={(e) => (setDirty(true), setLevel(e.target.value))} />
              )}
            </Field>
            <Field label={t('sp.comment')}>
              <Textarea rows={4} value={comment} disabled={!canGrade} onChange={(e) => (setDirty(true), setComment(e.target.value))} />
            </Field>
            {canGrade && (
              <Button variant="primary" block disabled={busy || (!dirty && attempt.status === 'graded')} onClick={save}>
                {attempt.status === 'graded' ? t('sp.updateGrade') : t('sp.grade')}
              </Button>
            )}
            {attempt.graded_at && <p className="small muted">{fillTemplate(t('sp.gradedAt'), { d: dateTime(attempt.graded_at) })}</p>}
            {(me.role === 'owner' || me.role === 'admin') && (
              <Button variant="ghost" size="sm" icon={<ArrowsClockwise size={15} />} onClick={reset}>
                {t('sp.allowRetake')}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

function AnswerCard({ item, n, answer, urls }: { item: SpeakingItem; n: number; answer?: SpeakingAnswer; urls: Record<string, string> }) {
  const t = useT()
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!answer?.audio_path) return
    let off = false
    answerUrl(answer.audio_path)
      .then((u) => !off && (u ? setSrc(u) : setErr(true)))
      .catch(() => !off && setErr(true))
    return () => {
      off = true
    }
  }, [answer?.audio_path])
  return (
    <div className="card sp-acard">
      <div className="sp-acard-head">
        <span className="sp-num">{n}</span>
        <b>{partTitle(item.part)}</b>
        <span className="small muted">
          {item.prep_seconds}s + {item.answer_seconds}s
        </span>
      </div>
      <div className="sp-acard-q">
        <Question item={item} urls={urls} />
      </div>
      <div className="sp-acard-audio">
        {!answer ? (
          <span className="small muted">{t('sp.noAnswer')}</span>
        ) : !answer.audio_path ? (
          <span className="small muted">{t('sp.audioRemoved')}</span>
        ) : src ? (
          <>
            <audio src={src} controls preload="metadata" />
            {answer.duration_ms ? <span className="small muted">{Math.round(answer.duration_ms / 1000)} s</span> : null}
          </>
        ) : err ? (
          <span className="small red">{t('sp.audioFailed')}</span>
        ) : (
          <span className="small muted">{t('common.loading')}</span>
        )}
      </div>
    </div>
  )
}
