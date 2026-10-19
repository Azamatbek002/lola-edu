// Navbatdagi xabarlarni yuborish: Telegram Bot API yoki Eskiz.uz SMS.
// pg_cron har daqiqada chaqiradi (docs/DEPLOY.md). Faqat service role kaliti bilan.
import { adminClient, json, safeEqual } from '../_shared/util.ts'

const TG = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const ESKIZ_EMAIL = Deno.env.get('ESKIZ_EMAIL') ?? ''
const ESKIZ_PASSWORD = Deno.env.get('ESKIZ_PASSWORD') ?? ''
const ESKIZ_FROM = Deno.env.get('ESKIZ_FROM') ?? '4546'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

let eskizToken: string | null = null
async function eskizLogin() {
  const fd = new FormData()
  fd.set('email', ESKIZ_EMAIL)
  fd.set('password', ESKIZ_PASSWORD)
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: fd })
  const j = await r.json()
  eskizToken = j?.data?.token ?? null
  return eskizToken
}

async function sendSms(phone: string, text: string): Promise<void> {
  if (!ESKIZ_EMAIL) throw new Error('Eskiz sozlanmagan')
  const token = eskizToken ?? (await eskizLogin())
  const fd = new FormData()
  fd.set('mobile_phone', phone.replace(/\D/g, ''))
  fd.set('message', text)
  fd.set('from', ESKIZ_FROM)
  let r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  if (r.status === 401) {
    await eskizLogin()
    r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', headers: { Authorization: `Bearer ${eskizToken}` }, body: fd })
  }
  if (!r.ok) throw new Error(`Eskiz ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

async function sendTelegram(chat: string, text: string): Promise<void> {
  if (!TG) throw new Error('Telegram bot sozlanmagan')
  const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
  })
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

export async function processQueue(limit = 100) {
  const db = adminClient()
  const { data: queue } = await db.from('messages').select('*').eq('status', 'queued').lt('attempts', 3).order('created_at').limit(limit)
  let sent = 0
  let failed = 0
  for (const m of queue ?? []) {
    try {
      if (m.channel === 'telegram') await sendTelegram(m.recipient, m.text)
      else await sendSms(m.recipient, m.text)
      await db.from('messages').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: m.attempts + 1, error: null }).eq('id', m.id)
      sent++
    } catch (e) {
      const attempts = m.attempts + 1
      await db.from('messages').update({ status: attempts >= 3 ? 'failed' : 'queued', attempts, error: String(e).slice(0, 500) }).eq('id', m.id)
      failed++
    }
  }
  return { sent, failed }
}

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization') ?? ''
  if (!CRON_SECRET || !safeEqual(auth, `Bearer ${CRON_SECRET}`)) return json({ error: 'forbidden' }, 403)
  return json(await processQueue())
})
