// Edge Function'lar uchun umumiy yordamchilar (Deno)
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Service role mijoz — RLS'ni chetlab o'tadi, faqat server tomonida ishlatiladi */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } })
}

export function normalizePhone(p: string): string {
  let d = (p || '').replace(/\D/g, '')
  if (d.length === 9) d = '998' + d
  return d ? '+' + d : ''
}

export function money(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"
}

/** Vaqtni doimiy vaqtda solishtirish (timing attack'dan himoya) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** Toshkent vaqti bo'yicha bugungi sana (YYYY-MM-DD) */
export function todayTashkent(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
}

/**
 * pg_cron chaqiruvlarini tekshirish. Maxfiy kalit bazadagi private.app_secrets jadvalida turadi
 * (cron ishi uni o'zi o'qib yuboradi), shuning uchun alohida qo'lda kiritiladigan secret kerak emas.
 * CRON_SECRET muhit o'zgaruvchisi ham qo'llab-quvvatlanadi.
 */
export async function cronAuthorized(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const envSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (envSecret && safeEqual(token, envSecret)) return true
  const { data } = await adminClient().rpc('check_cron_secret', { p_secret: token })
  return data === true
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
