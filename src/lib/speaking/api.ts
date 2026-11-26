// Gapirish imtihoni: server bilan ishlash (Supabase RPC) va demo rejimda shu xatti-harakatni taqlid qilish.
import { useMemo } from 'react'
import { db, supabase } from '../db'
import { useRows } from '../data'
import type { SpeakingAnswer, SpeakingProgress } from '../types'
import { parseSpeakingSettings, type SpeakingSettings } from './grading'
import { idb } from './idb'
import { removeAnswers } from './files'

export class SpeakingError extends Error {
  constructor(readonly code: 'already_taken' | 'variant_not_available' | 'forbidden' | 'network' | 'other', msg?: string) {
    super(msg || code)
  }
}

function asSpeakingError(e: unknown): SpeakingError {
  const msg = (e as { message?: string })?.message ?? String(e)
  if (/already_taken/.test(msg)) return new SpeakingError('already_taken', msg)
  if (/variant_not_available/.test(msg)) return new SpeakingError('variant_not_available', msg)
  if (/forbidden|permission|42501/.test(msg)) return new SpeakingError('forbidden', msg)
  if (/failed to fetch|network|load failed/i.test(msg)) return new SpeakingError('network', msg)
  return new SpeakingError('other', msg)
}

export const speakingApi = {
  /** Imtihonni boshlash (har variant — 1 marta). Tugallanmagan urinish bo'lsa, o'shani qaytaradi. */
  async start(variantId: string, studentId: string): Promise<string> {
    if (supabase) {
      const { data, error } = await supabase.rpc('speaking_start', { p_variant: variantId })
      if (error) throw asSpeakingError(error)
      return data as string
    }
    const v = (await db.list('speaking_variants')).find((x) => x.id === variantId)
    if (!v || v.status !== 'published') throw new SpeakingError('variant_not_available')
    const a = (await db.list('speaking_attempts')).find((x) => x.variant_id === variantId && x.student_id === studentId)
    if (a) {
      if (a.status === 'in_progress') return a.id
      throw new SpeakingError('already_taken')
    }
    const row = await db.insert('speaking_attempts', { variant_id: variantId, student_id: studentId, status: 'in_progress', started_at: new Date().toISOString(), progress: {} })
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

  /** Qayta topshirishga ruxsat: urinish va uning ovozlarini o'chirish (rahbar/administrator) */
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
