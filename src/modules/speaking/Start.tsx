// Imtihon oldidan: qoidalar va mikrofonni tekshirish. Tekshiruv o'tmaguncha imtihon boshlanmaydi.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Microphone, Play } from '@/components/icons'
import { Button, Card, Modal, PageHead, useConfirm } from '@/components/ui'
import { useMe } from '@/lib/auth'
import { useRows } from '@/lib/data'
import { useT } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { speakingApi, SpeakingError, takenToday } from '@/lib/speaking/api'
import { audioContext, meter, openMic, pickMime, recordingSupported } from '@/lib/speaking/recorder'
import { requestFull } from './Exam'

const RULES = ['sp.rule1', 'sp.rule2', 'sp.rule3', 'sp.rule4', 'sp.rule5']
const INFO = ['sp.info0', 'sp.info1', 'sp.info2', 'sp.info3', 'sp.info4', 'sp.info5']
/** Mikrofon tekshiruvida o'qiladigan matn (turkcha) */
const CHECK_TEXT = 'Merhaba! Ben Türkçe öğreniyorum. Bugün konuşma sınavına katılıyorum ve sorulara açık, anlaşılır bir şekilde cevap vereceğim.'

export default function SpeakingStart() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const mine = useRows('speaking_attempts').filter((a) => a.student_id === me.student_id)
  const open = mine.find((a) => a.status === 'in_progress')
  const today = takenToday(mine)
  const [check, setCheck] = useState(false)
  const [micOk, setMicOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (!(await confirm(t('sp.confirmStart')))) return
    // Foydalanuvchi bosgan paytda: ovoz va to'liq ekran (iPhone talabi)
    audioContext()
    requestFull()
    setBusy(true)
    try {
      const id = await speakingApi.startRandom(me.student_id ?? '')
      await qc.invalidateQueries({ queryKey: ['speaking_attempts'] })
      await qc.invalidateQueries({ queryKey: ['speaking_items'] })
      nav(`/exam/${id}`, { replace: true, state: { fresh: true } })
    } catch (e) {
      const code = e instanceof SpeakingError ? e.code : 'other'
      toast.error(code === 'daily_limit' ? t('sp.dailyDone') : code === 'variant_not_available' ? t('sp.notAvailable') : code === 'network' ? t('sp.noInternet') : t('common.error'))
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title={t('sp.takeExam')}
        subtitle={t('sp.subtitle')}
        actions={
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => nav('/speaking')}>
            {t('common.back')}
          </Button>
        }
      />
      {!recordingSupported() && <div className="sp-alert warn mb">{t('sp.notSupported')}</div>}
      <Card pad className="sp-rules">
        <h3>{t('sp.rulesTitle')}</h3>
        <ul className="sp-forbid">
          {RULES.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <p className="sp-strong">{t('sp.rulesWarn')}</p>
        <ul className="sp-info">
          {INFO.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <div className="sp-actions">
          {open ? (
            <Button variant="primary" block icon={<Play size={16} />} onClick={() => nav(`/exam/${open.id}`)}>
              {t('sp.resume')}
            </Button>
          ) : today ? (
            <div className="sp-alert">{t('sp.dailyDone')}</div>
          ) : (
            <>
              <Button variant={micOk ? 'success' : 'secondary'} block icon={micOk ? <CheckCircle2 size={17} /> : <Microphone size={17} />} onClick={() => setCheck(true)} disabled={!recordingSupported()}>
                {micOk ? t('sp.micOk') : t('sp.checkMic')}
              </Button>
              <Button variant="primary" block icon={<Play size={16} />} disabled={!micOk || busy} onClick={start}>
                {t('sp.startExam')}
              </Button>
              {!micOk && <p className="small muted center">{t('sp.checkFirst')}</p>}
            </>
          )}
        </div>
      </Card>
      {check && (
        <MicCheck
          onClose={() => setCheck(false)}
          onOk={() => {
            setMicOk(true)
            setCheck(false)
          }}
        />
      )}
    </>
  )
}

/** Mikrofonni tekshirish: matnni o'qib yozish, so'ng eshitib ko'rish (yozuv hech qayerga yuborilmaydi) */
function MicCheck({ onClose, onOk }: { onClose: () => void; onOk: () => void }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'rec' | 'play' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [level, setLevel] = useState(0)
  const [url, setUrl] = useState('')
  const [left, setLeft] = useState(8)
  const peak = useRef(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const cleanup = useRef<() => void>(() => undefined)

  useEffect(() => () => cleanup.current(), [])
  // Yopilish animatsiyasi tugaguncha havola yashaydi
  useEffect(() => () => void (url && window.setTimeout(() => URL.revokeObjectURL(url), 1500)), [url])

  const record = async () => {
    setErr('')
    audioContext()
    let s: MediaStream
    try {
      s = await openMic()
    } catch (e) {
      const name = (e as { name?: string })?.name
      setErr(name === 'NotAllowedError' || name === 'SecurityError' ? t('sp.micDenied') : name === 'NotFoundError' ? t('sp.micMissing') : t('sp.micFailed'))
      setState('error')
      return
    }
    const m = meter(s)
    const mime = pickMime()
    const rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s)
    const parts: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
    rec.onstop = () => {
      m.close()
      const b = new Blob(parts, { type: rec.mimeType || mime })
      setUrl(URL.createObjectURL(b))
      setState('play')
    }
    recRef.current = rec
    peak.current = 0
    rec.start()
    setState('rec')
    const t0 = Date.now()
    const id = window.setInterval(() => {
      const l = m.level()
      peak.current = Math.max(peak.current, l)
      setLevel(l)
      const sec = 8 - Math.floor((Date.now() - t0) / 1000)
      setLeft(sec)
      if (sec <= 0) stop()
    }, 80)
    const stop = () => {
      window.clearInterval(id)
      if (rec.state !== 'inactive') rec.stop()
    }
    cleanup.current = stop
  }

  return (
    <Modal title={t('sp.readText')} onClose={onClose}>
      <p className="sp-checktext">{CHECK_TEXT}</p>
      {state === 'idle' && (
        <Button variant="primary" block icon={<Microphone size={17} />} onClick={record}>
          {t('sp.recordCheck')}
        </Button>
      )}
      {state === 'rec' && (
        <div className="sp-meter">
          <div className="row between small">
            <span className="ex-rec">
              <span className="ex-rec-dot" /> {t('sp.recording')}
            </span>
            <b>{left}</b>
          </div>
          <div className="sp-level">
            <div style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <Button block onClick={() => cleanup.current()}>
            {t('sp.stop')}
          </Button>
        </div>
      )}
      {state === 'play' && (
        <div className="sp-meter">
          {peak.current < 0.06 && <div className="sp-alert warn">{t('sp.tooQuiet')}</div>}
          <audio src={url} controls autoPlay className="sp-audio" />
          <p className="small muted">{t('sp.heardYourself')}</p>
          <div className="grid grid-2">
            <Button onClick={() => setState('idle')}>{t('sp.again')}</Button>
            <Button variant="success" icon={<CheckCircle2 size={17} />} onClick={onOk}>
              {t('sp.heard')}
            </Button>
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="sp-meter">
          <div className="sp-alert warn">{err}</div>
          <Button block onClick={record}>
            {t('sp.again')}
          </Button>
        </div>
      )}
    </Modal>
  )
}
