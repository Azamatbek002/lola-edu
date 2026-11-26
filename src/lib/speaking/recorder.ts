// Mikrofon, ovoz yozish (faqat audio), ovoz darajasi va zil.
// Yozuv har soniyada bo'lak-bo'lak telefon xotirasiga (IndexedDB) yoziladi — sahifa yangilansa ham yo'qolmaydi.
import { idb } from './idb'

/** Brauzer qo'llaydigan ovoz formati (Chrome/Android — webm/opus, iPhone/Safari — mp4) */
export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac']
  return list.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
}

export const recordingSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

// ─── Umumiy holat: bitta mikrofon va bitta AudioContext (iPhone'da foydalanuvchi bosganda yaratiladi) ──
let stream: MediaStream | null = null
let ctx: AudioContext | null = null

export async function openMic(): Promise<MediaStream> {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live')) return stream
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
  return stream
}
export const micLive = () => !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live')
export function closeMic() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

/** Foydalanuvchi bosgan paytda chaqiriladi (aks holda iPhone ovoz chiqarmaydi) */
export function audioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  return ctx
}
export const audioReady = () => !!ctx && ctx.state === 'running'

/** Ovoz darajasi o'lchagichi (to'lqin chizish uchun) */
export function meter(s: MediaStream) {
  const ac = audioContext()
  const src = ac.createMediaStreamSource(s)
  const an = ac.createAnalyser()
  an.fftSize = 1024
  an.smoothingTimeConstant = 0.6
  src.connect(an)
  const buf = new Uint8Array(an.fftSize)
  return {
    /** 0..1 */
    level(): number {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      return Math.min(1, Math.sqrt(sum / buf.length) * 3.2)
    },
    wave(): Uint8Array {
      an.getByteTimeDomainData(buf)
      return buf
    },
    close() {
      try {
        src.disconnect()
      } catch {
        /* ignore */
      }
    },
  }
}
export type Meter = ReturnType<typeof meter>

/** Zil: javob berish boshlanishi belgisi (fayl kerak emas, brauzerda sintez qilinadi) */
export function bell() {
  try {
    const ac = audioContext()
    const t0 = ac.currentTime + 0.02
    const out = ac.createGain()
    out.gain.value = 0.55
    out.connect(ac.destination)
    for (const [f, d, at] of [[880, 1.4, 0], [1318.5, 1.1, 0], [1760, 0.6, 0]] as const) {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + at)
      g.gain.exponentialRampToValueAtTime(f === 880 ? 0.9 : 0.35, t0 + at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d)
      o.connect(g).connect(out)
      o.start(t0 + at)
      o.stop(t0 + at + d + 0.05)
    }
  } catch {
    /* ovoz chiqmasa ham imtihon davom etadi */
  }
}

// ─── Yozish ─────────────────────────────────────────────────────────────────
export interface RecordingResult {
  mime: string
  durationMs: number
  chunks: number
}

/** Bitta savolga javob yozish: bo'laklar har soniyada xotiraga tushadi */
export class AnswerRecorder {
  private rec: MediaRecorder
  private seq = 0
  private writes: Promise<unknown> = Promise.resolve()
  private started = Date.now()
  private stopped: Promise<void>
  readonly mime: string

  constructor(s: MediaStream, readonly attemptId: string, readonly itemId: string) {
    const want = pickMime()
    this.rec = want ? new MediaRecorder(s, { mimeType: want, audioBitsPerSecond: 48_000 }) : new MediaRecorder(s)
    this.mime = this.rec.mimeType || want || 'audio/webm'
    this.rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return
      const rec = { attemptId, itemId, seq: this.seq++, blob: e.data, mime: this.mime, at: Date.now() }
      // Ketma-ket yozamiz: tartib buzilmasin
      this.writes = this.writes.then(() => idb.putChunk(rec)).catch(() => undefined)
    }
    this.stopped = new Promise((resolve) => {
      this.rec.onstop = () => resolve()
      this.rec.onerror = () => resolve()
    })
    this.rec.start(1000)
    this.started = Date.now()
  }

  get active() {
    return this.rec.state === 'recording'
  }

  async stop(): Promise<RecordingResult> {
    const durationMs = Date.now() - this.started
    if (this.rec.state !== 'inactive') {
      try {
        this.rec.stop()
      } catch {
        /* ignore */
      }
      // Ba'zi brauzerlarda onstop kelmay qolishi mumkin — 3 soniyadan keyin baribir davom etamiz
      await Promise.race([this.stopped, new Promise((r) => setTimeout(r, 3000))])
    }
    await this.writes
    return { mime: this.mime, durationMs, chunks: this.seq }
  }
}
