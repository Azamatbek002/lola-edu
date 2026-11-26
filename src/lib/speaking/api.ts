// Gapirish imtihoni: server bilan ishlash (Supabase RPC) va demo rejimda shu xatti-harakatni taqlid qilish.
import { useMemo } from 'react'
import { db, supabase } from '../db'
import { useRows } from '../data'
import type { SpeakingAnswer, SpeakingProgress } from '../types'
import { parseSpeakingSettings, type SpeakingSettings } from './grading'
import { idb } from './idb'
import { removeAnswers } from './files'

export class SpeakingError extends Error {
  constructor(readonly code: 'variant_not_available' | 'forbidden' | 'network' | 'other', msg?: string) {
    super(msg || code)
  }
}

function asSpeakingError(e: unknown): SpeakingError {
  const msg = (e as { message?: string })?.message ?? String(e)
  if (/variant_not_available/.test(msg)) return new SpeakingError('variant_not_available', msg)
  if (/forbidden|permission|42501/.test(msg)) return new SpeakingError('forbidden', msg)
  if (/failed to fetch|network|load failed/i.test(msg)) return new SpeakingError('network', msg)
  return new SpeakingError('other', msg)
}

export const speakingApi = {
  /**
   * Imtihonni boshlash: variant tasodifiy tanlanadi, topshirishlar soni cheklanmaydi.
   * Tugallanmagan imtihon bo'lsa — o'sha davom etadi (1 soatdan eskisi yakunlangan deb hisoblanadi).
   */
  async startRandom(studentId: string): Promise<string> {
    if (supabase) {
      const { data, error } = await supabase.rpc('speaking_start_random')
      if (error) throw asSpeakingError(error)
      return data as string
    }
    const attempts = await db.list('speaking_attempts')
    const open = attempts.filter((x) => x.student_id === studentId && x.status === 'in_progress').sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
    if (open) {
      if (Date.now() - new Date(open.started_at).getTime() < 3_600_000) return open.id
      await db.update('speaking_attempts', open.id, { status: 'submitted', submitted_at: new Date().toISOString() })
    }
    const items = await db.list('speaking_items')
    const pool = (await db.list('speaking_variants')).filter((v) => v.status === 'published' && items.some((i) => i.variant_id === v.id))
    if (!pool.length) throw new SpeakingError('variant_not_available')
    const v = pool[Math.floor(Math.random() * pool.length)]
    const row = await db.insert('speaking_attempts', { variant_id: v.id, student_id: studentId, status: 'in_progress', started_at: new Date().toISOString(), progress: {} })
    return row.id
  },

  async progress(attemptId: string, p: SpeakingProgress): Promise<void> {
    if (supabase) {
      const { error } = await supabase.rpc('speaking_progress', { p_attempt: attemptId, p_progress: p })
      if (error) throw asSpeakingError(error)
      return
    }
    const a = (await db.list('speaking_attempts')).find((x) => x.id === attemptId)
    if (a?.status === 'in_progress') await db.update('speaking_attempts', attemptId, { progress: p })
  },

  async submit(attemptId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.rpc('speaking_submit', { p_attempt: attemptId })
      if (error) throw asSpeakingError(error)
      return
    }
    const a = (await db.list('speaking_attempts')).find((x) => x.id === attemptId)
    if (a?.status === 'in_progress') await db.update('speaking_attempts', attemptId, { status: 'submitted', submitted_at: new Date().toISOString() })
  },

  /** Javob yozuvi (ombordagi fayl haqida). Takroriy yuborishda — yangilanadi. */
  async saveAnswer(row: Omit<SpeakingAnswer, 'id' | 'created_at'>): Promise<void> {
    if (supabase) {
      const ins = await supabase.from('speaking_answers').insert(row)
      if (!ins.error) return
      if (ins.error.code !== '23505') throw asSpeakingError(ins.error)
      const up = await supabase.from('speaking_answers').update(row).eq('attempt_id', row.attempt_id).eq('item_id', row.item_id)
      if (up.error) throw asSpeakingError(up.error)
      return
    }
    const ex = (await db.list('speaking_answers')).find((x) => x.attempt_id === row.attempt_id && x.item_id === row.item_id)
    if (ex) await db.update('speaking_answers', ex.id, row)
    else await db.insert('speaking_answers', row)
  },

  /** Urinishni butunlay o'chirish: ovozlari bilan (rahbar/administrator, masalan sinov urinishlari) */
  async resetAttempt(attemptId: string): Promise<void> {
    const answers = (await db.list('speaking_answers')).filter((a) => a.attempt_id === attemptId)
    await removeAnswers(answers.map((a) => a.audio_path).filter((p): p is string => !!p))
    await db.remove('speaking_attempts', attemptId)
    if (!supabase) for (const a of answers) await db.remove('speaking_answers', a.id).catch(() => undefined)
    await idb.deleteState(attemptId).catch(() => undefined)
  },
}

export function useSpeakingSettings(): SpeakingSettings {
  const row = useRows('settings').find((s) => s.key === 'speaking')
  return useMemo(() => parseSpeakingSettings(row?.value), [row])
}
