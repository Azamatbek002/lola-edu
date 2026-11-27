// Gapirish imtihoni oynasi: menyusiz, to'liq ekran. Tartib: bo'lim yo'riqnomasi → (savol ovozi/videosi) →
// tayyorlanish sanog'i → zil → javob (avtomatik ovoz yozish) → keyingi savol. Qayta yozish va qayta ko'rish yo'q.
// Soat to'xtamaydi: sahifa yangilansa, imtihon vaqt bo'yicha qayerda bo'lishi kerak bo'lsa, o'sha joydan davom etadi.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowsClockwise, CheckCircle2 as CheckCircle, CloudArrowUp, CornersOut, Microphone, SpeakerHigh, WifiSlash, X } from '@/components/icons'
import { Button } from '@/components/ui'
import { useMe } from '@/lib/auth'
import { useRows, useTable } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { fillTemplate } from '@/lib/format'
import { markActive } from '@/lib/applock'
import type { SpeakingItem, SpeakingPart } from '@/lib/types'
import { buildSteps, fmtClock, partStage, remaining, resume, sortItems, type Step } from '@/lib/speaking/timeline'
import { speakingApi, useSpeakingSettings } from '@/lib/speaking/api'
import { preloadMedia } from '@/lib/speaking/files'
import { assemble, idb } from '@/lib/speaking/idb'
import { AnswerRecorder, audioContext, bell, closeMic, meter, micLive, openMic, audioReady, type Meter } from '@/lib/speaking/recorder'
import { enqueueUpload, useUploadStatus } from '@/lib/speaking/uploader'

type Phase = 'loading' | 'gate' | 'running' | 'finished' | 'error'
interface Cur {
  step: number
  startedAt: number
}

/** Imtihondagi sarlavhalar turkcha (milliy imtihon ko'rinishida) */
export const partTitle = (p: SpeakingPart) => (p === '1.1' ? '1. Bölüm' : p === '1.2' ? '1.2. Bölüm' : p === '2' ? '2. Bölüm' : '3. Bölüm')

export function requestFull() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  try {
    if (!document.fullscreenElement) (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())?.catch?.(() => undefined)
  } catch {
    /* iPhone'da qo'llanmaydi — menyusiz oyna baribir butun ekranni egallaydi */
  }
}
function exitFull() {
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  } catch {
    /* ignore */
  }
}

/** Sinov rejimidagi javob (faqat shu qurilmada, serverga yuborilmaydi) */
interface PracticeAnswer {
  itemId: string
  url: string
  seconds: number
}

/**
 * practice = ustoz/rahbariyat uchun sinov rejimi: imtihon to'liq o'tadi (taymer, zil, ovoz yozish),
 * lekin urinish yaratilmaydi, hech narsa serverga yuborilmaydi; oxirida yozilgan javoblarni eshitish mumkin.
 */
export default function ExamPage({ practice = false }: { practice?: boolean }) {
  const params = useParams()
  const practiceKey = useMemo(() => 'practice-' + Date.now().toString(36), [])
  const attemptId = practice ? practiceKey : params.attemptId ?? ''
  const me = useMe()
  const t = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const qc = useQueryClient()
  const settings = useSpeakingSettings()

  const attemptsQ = useTable('speaking_attempts')
  const itemsQ = useTable('speaking_items')
  const variants = useRows('speaking_variants')
  const attempt = practice ? undefined : attemptsQ.data?.find((a) => a.id === attemptId)
  const [practiceVariant, setPracticeVariant] = useState('')
  const variant = variants.find((v) => v.id === (practice ? practiceVariant : attempt?.variant_id))
  const practiceRecs = useRef<{ itemId: string; durationMs: number }[]>([])
  const [playback, setPlayback] = useState<PracticeAnswer[] | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [exam, setExam] = useState<{ items: SpeakingItem[]; steps: Step[]; urls: Record<string, string> } | null>(null)
  const [cur, setCur] = useState<Cur>({ step: 0, startedAt: 0 })
  const [now, setNow] = useState(Date.now())
  const [micError, setMicError] = useState(false)
  const [fsOff, setFsOff] = useState(false)
  const [resumed, setResumed] = useState(false)
  const [fontScale, setFontScale] = useState(() => {
    try {
      return Number(localStorage.getItem('lola:exam-font')) || 1
    } catch {
      return 1
    }
  })
  const [volume, setVolume] = useState(1)
  const upload = useUploadStatus(attemptId)

  const recRef = useRef<{ rec: AnswerRecorder; itemId: string } | null>(null)
  const stops = useRef<Promise<unknown>[]>([])
  const meterRef = useRef<Meter | null>(null)
  const blurs = useRef(0)
  const wake = useRef<{ release: () => Promise<void> } | null>(null)
  const curRef = useRef(cur)
  curRef.current = cur
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Savollar faqat imtihon boshlangandan keyin ochiladi — eski (bo'sh) ro'yxatni yangilaymiz
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['speaking_items'] })
    qc.invalidateQueries({ queryKey: ['speaking_attempts'] })
  }, [qc])

  // 1) Ma'lumot va materiallarni oldindan yuklash (keyin internet uzilsa ham savollar ko'rinadi)
  useEffect(() => {
    if (exam || phase !== 'loading' || !practice) return
    if (itemsQ.isError) {
      setError(t('sp.loadFailed'))
      setPhase('error')
      return
    }
    if (!itemsQ.isSuccess || itemsQ.isFetching || !variants.length) return
    const all = itemsQ.data ?? []
    const want = params.variantId ?? 'random'
    const pool = variants.filter((v) => (want === 'random' ? v.status === 'published' : v.id === want) && all.some((i) => i.variant_id === v.id))
    const v = pool[Math.floor(Math.random() * pool.length)]
    if (!v) {
      setError(t('sp.noQuestions'))
      setPhase('error')
      return
    }
    const items = sortItems(all.filter((i) => i.variant_id === v.id))
    let off = false
    preloadMedia(items.flatMap((i) => [...(i.images ?? []), i.media_path ?? '']))
      .catch(() => ({}) as Record<string, string>)
      .then((urls) => {
        if (off) return
        setPracticeVariant(v.id)
        setExam({ items, steps: buildSteps(items, settings.intro_seconds), urls })
        setPhase('gate')
      })
    return () => {
      off = true
    }
  }, [practice, exam, phase, itemsQ.isSuccess, itemsQ.isError, itemsQ.isFetching, itemsQ.data, variants, params.variantId, settings.intro_seconds, t])

  useEffect(() => {
    if (exam || phase !== 'loading' || practice) return
    if (attemptsQ.isError || itemsQ.isError) {
      setError(t('sp.loadFailed'))
      setPhase('error')
      return
    }
    if (!attemptsQ.isSuccess || !itemsQ.isSuccess || itemsQ.isFetching || attemptsQ.isFetching) return
    if (!attempt || attempt.student_id !== me.student_id) {
      setError(t('sp.notFound'))
      setPhase('error')
      return
    }
    if (attempt.status !== 'in_progress') {
      setError(t('sp.alreadyFinished'))
      setPhase('error')
      return
    }
    const items = sortItems((itemsQ.data ?? []).filter((i) => i.variant_id === attempt.variant_id))
    if (!items.length) {
      setError(t('sp.noQuestions'))
      setPhase('error')
      return
    }
    let off = false
    const paths = items.flatMap((i) => [...(i.images ?? []), i.media_path ?? ''])
    preloadMedia(paths)
      .catch(() => ({}) as Record<string, string>)
      .then((urls) => {
        if (off) return
        setExam({ items, steps: buildSteps(items, settings.intro_seconds), urls })
        setPhase('gate')
      })
    return () => {
      off = true
    }
  }, [practice, exam, phase, attemptsQ.isSuccess, attemptsQ.isError, attemptsQ.isFetching, itemsQ.isSuccess, itemsQ.isError, itemsQ.isFetching, itemsQ.data, attempt, me.student_id, settings.intro_seconds, t])

  const steps = exam?.steps ?? []
  const step: Step | undefined = steps[cur.step]
  const item = step?.itemId ? exam?.items.find((i) => i.id === step.itemId) : undefined

  const persist = useCallback(
    (c: Cur, extra?: { finished?: boolean }) => {
      if (practice) return
      void idb.putState({ attemptId, userId: me.id, step: c.step, startedAt: c.startedAt, blurs: blurs.current, ...extra }).catch(() => undefined)
      void speakingApi.progress(attemptId, { step: c.step, startedAt: c.startedAt, blurs: blurs.current }).catch(() => undefined)
    },
    [attemptId, me.id, practice],
  )

  const stopRecorder = useCallback(() => {
    const r = recRef.current
    recRef.current = null
    if (!r) return
    stops.current.push(
      r.rec
        .stop()
        .then((res) =>
          practice
            ? void practiceRecs.current.push({ itemId: r.itemId, durationMs: res.durationMs })
            : enqueueUpload({ attemptId, itemId: r.itemId, userId: me.id, mime: res.mime, durationMs: res.durationMs }),
        )
        .catch(() => undefined),
    )
  }, [attemptId, me.id, practice])

  const finish = useCallback(async () => {
    stopRecorder()
    setPhase('finished')
    const last = { step: steps.length, startedAt: Date.now() }
    setCur(last)
    persist(last, { finished: true })
    exitFull()
    wake.current?.release().catch(() => undefined)
    await Promise.all(stops.current)
    meterRef.current?.close()
    closeMic()
    if (practice) {
      // Sinov: yozuvlarni shu qurilmada yig'ib eshittiramiz, xotiradan o'chiramiz
      const list: PracticeAnswer[] = []
      for (const r of practiceRecs.current) {
        const a = await assemble(attemptId, r.itemId).catch(() => null)
        if (a) list.push({ itemId: r.itemId, url: URL.createObjectURL(a.blob), seconds: Math.round(r.durationMs / 1000) })
        await idb.deleteChunks(attemptId, r.itemId).catch(() => undefined)
      }
      setPlayback(list)
      return
    }
    try {
      await speakingApi.submit(attemptId)
      await idb.deleteState(attemptId)
    } catch {
      /* internet yo'q — yuklash navbati keyinroq yakunlaydi */
    }
    qc.invalidateQueries({ queryKey: ['speaking_attempts'] })
  }, [attemptId, persist, qc, steps.length, stopRecorder, practice])

  const go = useCallback(
    (next: Cur) => {
      if (next.step >= steps.length) {
        void finish()
        return
      }
      setCur(next)
      persist(next)
    },
    [finish, persist, steps.length],
  )

  /** Keyingi qadamga o'tish (vaqt tugadi, video tugadi yoki "Boshlash" bosildi) */
  const advance = useCallback(
    (startedAt = Date.now()) => {
      const c = curRef.current
      if (steps[c.step]?.kind === 'answer') stopRecorder()
      go({ step: c.step + 1, startedAt })
    },
    [go, steps, stopRecorder],
  )

  // 2) Boshlash / davom ettirish (foydalanuvchi bosganda: mikrofon, ovoz, to'liq ekran)
  const begin = useCallback(async () => {
    if (!exam) return
    audioContext()
    requestFull()
    try {
      const s = await openMic()
      meterRef.current?.close()
      meterRef.current = meter(s)
      setMicError(false)
    } catch {
      setMicError(true)
    }
    // Ekran o'chib qolmasin (kutmaymiz: ba'zi brauzerlarda javob kechikadi)
    try {
      ;(navigator as Navigator & { wakeLock?: { request: (k: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request('screen')
        .then((w) => (wake.current = w))
        .catch(() => undefined)
    } catch {
      /* ignore */
    }
    if (practice) {
      setPhase('running')
      go({ step: 0, startedAt: Date.now() })
      return
    }
    const local = await idb.state(attemptId).catch(() => undefined)
    const server = attempt?.progress?.startedAt ? { step: attempt.progress.step ?? 0, startedAt: attempt.progress.startedAt } : null
    const saved = local && (!server || local.step >= server.step) ? local : server
    blurs.current = Math.max(local?.blurs ?? 0, attempt?.progress?.blurs ?? 0)
    const r = resume(exam.steps, saved, Date.now())
    if (r.interruptedItemId) {
      // Yozish uzilib qolgan javob: yozilgan qismi yuboriladi
      const parts = await idb.chunks(attemptId, r.interruptedItemId).catch(() => [])
      if (parts.length) void enqueueUpload({ attemptId, itemId: r.interruptedItemId, userId: me.id, mime: parts[0].mime, durationMs: parts.length * 1000 })
    }
    setResumed(!!saved && r.step > 0)
    setPhase('running')
    go({ step: r.step, startedAt: r.startedAt })
  }, [exam, attempt, attemptId, me.id, go, practice])

  useEffect(() => {
    if (!resumed) return
    const id = window.setTimeout(() => setResumed(false), 8000)
    return () => window.clearTimeout(id)
  }, [resumed])

  // Boshlash sahifasidan kelgan bo'lsa (mikrofon va ovoz tayyor) — darhol boshlanadi
  const autoStarted = useRef(false)
  useEffect(() => {
    if (phase !== 'gate' || autoStarted.current) return
    if ((loc.state as { fresh?: boolean } | null)?.fresh && micLive() && audioReady()) {
      autoStarted.current = true
      void begin()
    }
  }, [phase, loc.state, begin])

  // 3) Soat
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    const act = window.setInterval(() => markActive(), 10_000)
    return () => {
      window.clearInterval(id)
      window.clearInterval(act)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' || !step || step.kind === 'media') return
    const end = cur.startedAt + step.seconds * 1000
    if (now < end) return
    if (now - end > 1500) {
      // Telefon uxlab qolgan yoki ilova fonda bo'lgan: soat bo'yicha to'g'ri joyga o'tamiz
      if (step.kind === 'answer') stopRecorder()
      const r = resume(steps, cur, now, false)
      go({ step: r.step, startedAt: r.startedAt })
    } else advance(end)
  }, [now, phase, step, cur, steps, advance, go, stopRecorder])

  // 4) Javob qadami: zil va avtomatik yozish
  useEffect(() => {
    if (phase !== 'running' || step?.kind !== 'answer' || !step.itemId) return
    bell()
    let cancelled = false
    ;(async () => {
      try {
        const s = await openMic()
        if (cancelled) return
        if (!meterRef.current) meterRef.current = meter(s)
        recRef.current = { rec: new AnswerRecorder(s, attemptId, step.itemId!), itemId: step.itemId! }
        setMicError(false)
      } catch {
        setMicError(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // Faqat qadam almashganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur.step])

  // 5) Chiqishdan himoya: orqaga tugmasi, sahifani yopish, ilovadan chiqish (hisoblanadi)
  useEffect(() => {
    if (phase !== 'running' || practice) return
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    history.pushState({ exam: 1 }, '', location.href)
    const pop = () => history.pushState({ exam: 1 }, '', location.href)
    const vis = () => {
      if (document.visibilityState === 'hidden') {
        blurs.current += 1
        persist(curRef.current)
      }
    }
    const fs = () => setFsOff(!document.fullscreenElement && !!document.documentElement.requestFullscreen)
    window.addEventListener('beforeunload', before)
    window.addEventListener('popstate', pop)
    document.addEventListener('visibilitychange', vis)
    document.addEventListener('fullscreenchange', fs)
    return () => {
      window.removeEventListener('beforeunload', before)
      window.removeEventListener('popstate', pop)
      document.removeEventListener('visibilitychange', vis)
      document.removeEventListener('fullscreenchange', fs)
    }
  }, [phase, persist, practice])

  // Sahifadan butunlay chiqib ketilsa — yozuvni to'xtatamiz (yozilgani saqlanadi)
  useEffect(
    () => () => {
      recRef.current?.rec.stop().catch(() => undefined)
      wake.current?.release().catch(() => undefined)
    },
    [],
  )
  // Sinov rejimidan chiqilganda: qurilmadagi vaqtinchalik yozuvlar o'chiriladi
  const examRef = useRef(exam)
  examRef.current = exam
  const playbackRef = useRef(playback)
  playbackRef.current = playback
  useEffect(
    () => () => {
      if (!practice) return
      playbackRef.current?.forEach((p) => URL.revokeObjectURL(p.url))
      for (const it of examRef.current?.items ?? []) void idb.deleteChunks(attemptId, it.id).catch(() => undefined)
      exitFull()
      closeMic()
    },
    [practice, attemptId],
  )

  const leavePractice = () => nav('/speaking', { replace: true })

  const setFont = (d: number) =>
    setFontScale((f) => {
      const v = Math.min(1.6, Math.max(0.85, Math.round((f + d) * 100) / 100))
      try {
        localStorage.setItem('lola:exam-font', String(v))
      } catch {
        /* ignore */
      }
      return v
    })

  // ─── Ko'rinish ───────────────────────────────────────────────────────────
  if (phase === 'loading')
    return (
      <ExamFrame>
        <div className="ex-center">
          <span className="ex-spinner" />
          <p className="muted">{t('sp.preparing')}</p>
        </div>
      </ExamFrame>
    )

  if (phase === 'error')
    return (
      <ExamFrame>
        <div className="ex-center">
          <p>{error}</p>
          <Button variant="primary" onClick={() => nav('/speaking', { replace: true })}>
            {t('common.back')}
          </Button>
        </div>
      </ExamFrame>
    )

  if (phase === 'gate') {
    const hasSaved = !!attempt?.progress?.startedAt
    return (
      <ExamFrame>
        <div className="ex-center ex-gate">
          <div className="ex-gate-icon">
            <Microphone size={34} />
          </div>
          <h1>{variant?.title ?? t('nav.speaking')}</h1>
          {practice && <span className="ex-practice">{t('sp.practiceMode')}</span>}
          <p className="muted">{practice ? t('sp.practiceHint') : hasSaved ? t('sp.resumeHint') : t('sp.gateHint')}</p>
          <Button variant="primary" className="ex-big" onClick={() => void begin()}>
            {hasSaved ? t('sp.resume') : t('sp.startExam')}
          </Button>
          {practice && (
            <Button variant="ghost" onClick={leavePractice}>
              {t('common.back')}
            </Button>
          )}
        </div>
      </ExamFrame>
    )
  }

  if (phase === 'finished' && practice)
    return (
      <ExamFrame>
        <div className="ex-center ex-done ex-review">
          <div className="ex-done-icon">
            <CheckCircle size={40} weight="fill" />
          </div>
          <h1>{t('sp.practiceDone')}</h1>
          <p className="muted">{t('sp.practiceDoneHint')}</p>
          {!playback ? (
            <span className="ex-spinner" />
          ) : (
            <div className="ex-playback">
              {(exam?.items ?? []).map((it, i) => {
                const pb = playback.find((x) => x.itemId === it.id)
                return (
                  <div key={it.id} className="ex-pb">
                    <div className="ex-pb-q">
                      <b>{i + 1}.</b> {partTitle(it.part)} — {it.prompt?.trim() || it.bullets.join(' / ') || '—'}
                    </div>
                    {pb ? <audio src={pb.url} controls preload="metadata" /> : <span className="small muted">{t('sp.noAnswer')}</span>}
                  </div>
                )
              })}
            </div>
          )}
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button icon={<ArrowsClockwise size={16} />} onClick={() => location.replace('/exam/practice/random')}>
              {t('sp.practiceAgain')}
            </Button>
            <Button variant="primary" onClick={leavePractice}>
              {t('sp.toHome')}
            </Button>
          </div>
        </div>
      </ExamFrame>
    )

  if (phase === 'finished')
    return (
      <ExamFrame>
        <div className="ex-center ex-done">
          <div className="ex-done-icon">
            <CheckCircle size={40} weight="fill" />
          </div>
          <h1>{t('sp.finished')}</h1>
          {upload.left > 0 ? (
            <p className={upload.online ? 'muted' : 'ex-warn'}>
              {upload.online ? <CloudArrowUp size={18} /> : <WifiSlash size={18} />}{' '}
              {fillTemplate(upload.online ? t('sp.uploadingN') : t('sp.offlineSaved'), { n: upload.left })}
            </p>
          ) : (
            <p className="muted">{t('sp.allUploaded')}</p>
          )}
          <Button variant="primary" onClick={() => nav('/speaking', { replace: true })}>
            {t('sp.toHome')}
          </Button>
        </div>
      </ExamFrame>
    )

  // running
  if (!step || !exam) return null
  const left = remaining(step, cur.startedAt, now)
  const stage = partStage(step.part)
  const intro = step.kind === 'intro'
  return (
    <ExamFrame>
      <header className="ex-top">
        <div className="ex-steps" aria-label={`${stage}/3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={'ex-dot' + (n < stage ? ' done' : n === stage ? ' on' : '')}>
              {n}
            </span>
          ))}
        </div>
        <div className="ex-status">
          {practice && (
            <>
              <span className="ex-chip practice">{t('sp.practiceMode')}</span>
              <button className="ex-chip btnlike" onClick={leavePractice} aria-label={t('common.close')}>
                <X size={15} />
              </button>
            </>
          )}
          {!practice && !upload.online && (
            <span className="ex-chip warn" title={t('sp.offlineSaved')}>
              <WifiSlash size={15} /> {t('sp.offline')}
            </span>
          )}
          {!practice && upload.left > 0 && upload.online && (
            <span className="ex-chip">
              <CloudArrowUp size={15} /> {upload.left}
            </span>
          )}
          {fsOff && (
            <button className="ex-chip btnlike" onClick={requestFull}>
              <CornersOut size={15} /> {t('sp.fullscreen')}
            </button>
          )}
        </div>
      </header>

      {resumed && <div className="ex-note">{t('sp.resumedNote')}</div>}
      {micError && <div className="ex-note warn">{t('sp.micLost')}</div>}

      <main className="ex-main" style={{ ['--ex-font' as string]: fontScale }}>
        <section className="ex-card" key={intro ? 'intro-' + step.part : item?.id}>
          <div className="ex-card-head">
            <b>
              {partTitle(step.part)}
              {!intro && (step.part === '1.1' || step.part === '1.2') && step.number ? ` · ${step.number}. soru` : ''}
            </b>
            <div className="ex-tools">
              {item?.media_path && (
                <label className="ex-vol" title={t('sp.volume')}>
                  <SpeakerHigh size={16} />
                  <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                </label>
              )}
              <button className="ex-font" onClick={() => setFont(-0.1)} aria-label="A-">
                A−
              </button>
              <button className="ex-font" onClick={() => setFont(0.1)} aria-label="A+">
                A+
              </button>
            </div>
          </div>
          {intro ? (
            <p className="ex-intro">{settings.intros[step.part] || t('sp.introFallback')}</p>
          ) : item ? (
            <Question item={item} urls={exam.urls} />
          ) : null}
          {step.kind === 'media' && item?.media_path && (
            <MediaOnce key={item.id} src={exam.urls[item.media_path]} kind={item.media_kind ?? 'audio'} volume={volume} onDone={() => advance()} />
          )}
        </section>

        <aside className="ex-side">
          {intro && (
            <div className="ex-panel">
              <Countdown left={left} total={step.seconds} />
              <Button variant="primary" className="ex-big" onClick={() => advance()}>
                {t('sp.begin')}
              </Button>
            </div>
          )}
          {step.kind === 'media' && (
            <div className="ex-panel">
              <div className="ex-listen">
                <SpeakerHigh size={30} />
              </div>
              <p className="muted center">{t('sp.listen')}</p>
            </div>
          )}
          {step.kind === 'prep' && (
            <div className="ex-panel">
              <Countdown left={left} total={step.seconds} />
              <p className="muted center">{t('sp.prepare')}</p>
            </div>
          )}
          {step.kind === 'answer' && (
            <div className="ex-panel rec">
              <div className="ex-rec">
                <span className="ex-rec-dot" /> {t('sp.recording')}
              </div>
              <div className="ex-timer">
                <span>{fmtClock(left)}</span>
                <div className="ex-track">
                  <div style={{ width: `${Math.max(0, Math.min(100, (left / step.seconds) * 100))}%` }} />
                </div>
              </div>
              <Wave meterRef={meterRef} />
            </div>
          )}
        </aside>
      </main>
    </ExamFrame>
  )
}

function ExamFrame({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('exam-mode')
    return () => document.documentElement.classList.remove('exam-mode')
  }, [])
  return <div className="exam">{children}</div>
}

/** Savol: matn, rasmlar, 2-bo'limda savollar ro'yxati, 3-bo'limda "Lehine / Aleyhine" jadvali */
export function Question({ item, urls }: { item: SpeakingItem; urls: Record<string, string> }) {
  const imgs = (item.images ?? []).map((p) => urls[p]).filter(Boolean)
  return (
    <div className={'ex-q part-' + item.part.replace('.', '-')}>
      {item.part === '3' ? (
        <>
          {item.prompt && <p className="ex-q-title">{item.prompt}</p>}
          <table className="ex-table">
            <thead>
              <tr>
                <th>Lehine</th>
                <th>Aleyhine</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(item.pros.length, item.cons.length) }).map((_, i) => (
                <tr key={i}>
                  <td>{item.pros[i] ?? ''}</td>
                  <td>{item.cons[i] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          {item.prompt && <p className="ex-q-title">• {item.prompt}</p>}
          {!!item.bullets?.length && (
            <ul className="ex-bullets">
              {item.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {!!imgs.length && (
        <div className={'ex-imgs n' + imgs.length}>
          {imgs.map((src, i) => (
            <img key={i} src={src} alt="" draggable={false} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Savol ovozi/videosi — faqat bir marta, boshqaruv tugmalarisiz */
function MediaOnce({ src, kind, volume, onDone }: { src?: string; kind: 'audio' | 'video'; volume: number; onDone: () => void }) {
  const t = useT()
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)
  const played = useRef(false)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!src) {
      const id = window.setTimeout(() => done.current(), 800)
      return () => window.clearTimeout(id)
    }
    const el = ref.current
    if (!el || played.current) return
    played.current = true
    el.play().catch(() => setBlocked(true))
  }, [src])
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
  if (!src) return null
  const common = {
    ref,
    src,
    playsInline: true,
    controls: false,
    onEnded: () => done.current(),
    onError: () => done.current(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
  return (
    <div className="ex-media">
      {kind === 'video' ? <video {...common} /> : <audio {...common} />}
      {blocked && (
        <Button
          variant="primary"
          icon={<SpeakerHigh size={16} />}
          onClick={() => {
            setBlocked(false)
            ref.current?.play().catch(() => done.current())
          }}
        >
          {t('sp.playQuestion')}
        </Button>
      )}
    </div>
  )
}

/** Katta sanoq (doira) */
function Countdown({ left, total }: { left: number; total: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  return (
    <div className="ex-count" aria-live="polite">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="track" />
        <circle cx="60" cy="60" r={r} className="arc" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span key={left}>{left > 59 ? fmtClock(left) : left}</span>
    </div>
  )
}

/** Jonli ovoz to'lqini */
function Wave({ meterRef }: { meterRef: React.MutableRefObject<Meter | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const bars = useMemo(() => new Array(48).fill(0) as number[], [])
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      if (ts - last < 50) return
      last = ts
      const cv = ref.current
      const m = meterRef.current
      if (!cv) return
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (cv.width !== w * dpr) {
        cv.width = w * dpr
        cv.height = h * dpr
      }
      const g = cv.getContext('2d')
      if (!g) return
      bars.shift()
      bars.push(m ? m.level() : 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const color = getComputedStyle(cv).color
      g.fillStyle = color
      const bw = w / bars.length
      bars.forEach((v, i) => {
        const bh = Math.max(2, v * h * 0.95)
        g.globalAlpha = 0.35 + 0.65 * (i / bars.length)
        g.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh)
      })
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [bars, meterRef])
  return <canvas ref={ref} className="ex-wave" aria-hidden />
}
