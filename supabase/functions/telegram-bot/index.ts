// Telegram bot webhook: o'quvchi/ota-ona/xodimni telefon raqami orqali bog'laydi
// va /balans, /jadval, /davomat buyruqlariga javob beradi.
// Webhook o'rnatish: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<project>/functions/v1/telegram-bot&secret_token=<TELEGRAM_WEBHOOK_SECRET>
import { adminClient, money, normalizePhone, safeEqual } from '../_shared/util.ts'

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const DAYS = ['', 'Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']

async function send(chat_id: number | string, text: string, extra: Record<string, unknown> = {}) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', ...extra }),
  })
}

const MENU = { reply_markup: { keyboard: [[{ text: '💰 Balans' }, { text: '📅 Jadval' }], [{ text: '✅ Davomat' }]], resize_keyboard: true } }

Deno.serve(async (req) => {
  if (!SECRET || !safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', SECRET)) return new Response('forbidden', { status: 403 })
  const update = await req.json().catch(() => null)
  const msg = update?.message
  if (!msg) return new Response('ok')
  const chat = String(msg.chat.id)
  const text: string = msg.text ?? ''
  const db = adminClient()

  // 1) Ilovadagi profil sahifasidan: /start <profile_id>
  const m = text.match(/^\/start\s+([0-9a-f-]{36})$/i)
  if (m) {
    const { data } = await db.from('profiles').update({ telegram_chat_id: chat }).eq('id', m[1]).select('full_name').maybeSingle()
    await send(chat, data ? `✅ ${data.full_name}, Telegram ulandi! Endi bildirishnomalar shu yerga keladi.` : '❌ Profil topilmadi', MENU)
    return new Response('ok')
  }

  // 2) Kontakt yuborildi — telefon bo'yicha bog'lash
  if (msg.contact) {
    if (msg.contact.user_id && msg.contact.user_id !== msg.from.id) {
      await send(chat, "Iltimos, o'zingizning raqamingizni yuboring.")
      return new Response('ok')
    }
    const phone = normalizePhone(msg.contact.phone_number)
    const linked: string[] = []
    const a = await db.from('students').update({ telegram_chat_id: chat }).eq('phone', phone).select('full_name')
    a.data?.forEach((s) => linked.push(`👤 ${s.full_name}`))
    const b = await db.from('students').update({ parent_telegram_chat_id: chat }).eq('parent_phone', phone).select('full_name')
    b.data?.forEach((s) => linked.push(`👨‍👩‍👧 ${s.full_name} (farzandingiz)`))
    const c = await db.from('profiles').update({ telegram_chat_id: chat }).eq('phone', phone).select('full_name')
    c.data?.forEach((p) => linked.push(`🏫 ${p.full_name}`))
    await send(chat, linked.length ? `✅ Bog'landi:\n${linked.join('\n')}` : "❌ Bu raqam Lola Edu bazasida topilmadi. Administratorga murojaat qiling.", MENU)
    return new Response('ok')
  }

  // Shu chat'ga bog'langan o'quvchilar
  const { data: students } = await db
    .from('students')
    .select('id, full_name')
    .or(`telegram_chat_id.eq.${chat},parent_telegram_chat_id.eq.${chat}`)

  if (text === '/start' || !students?.length) {
    await send(chat, "Assalomu alaykum! <b>Lola Edu Türk Dili Markazi</b> botiga xush kelibsiz.\n\nDavom etish uchun telefon raqamingizni yuboring 👇", {
      reply_markup: { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    })
    return new Response('ok')
  }

  const ids = students.map((s) => s.id)
  if (/balans|\/balance/i.test(text)) {
    const { data } = await db.from('student_balances').select('full_name, balance').in('student_id', ids)
    const lines = (data ?? []).map((b) => `${b.full_name}: <b>${b.balance < 0 ? '−' + money(-b.balance) + ' (qarz)' : money(b.balance)}</b>`)
    await send(chat, `💰 Balans\n${lines.join('\n')}`, MENU)
  } else if (/jadval|\/schedule/i.test(text)) {
    const { data } = await db.from('enrollments').select('student_id, groups(name, days, start_time, end_time, rooms(name))').in('student_id', ids).eq('status', 'active')
    const lines = (data ?? []).map((e: any) => `📚 <b>${e.groups.name}</b>\n${e.groups.days.map((d: number) => DAYS[d]).join(', ')} · ${e.groups.start_time}–${e.groups.end_time}${e.groups.rooms ? ' · ' + e.groups.rooms.name : ''}`)
    await send(chat, lines.join('\n\n') || "Faol guruh yo'q", MENU)
  } else if (/davomat|\/attendance/i.test(text)) {
    const { data } = await db.from('attendance').select('date, status, student_id').in('student_id', ids).order('date', { ascending: false }).limit(10)
    const icon: Record<string, string> = { present: '✅', absent: '❌', late: '⏰', excused: '📝' }
    await send(chat, `Oxirgi darslar:\n${(data ?? []).map((a) => `${icon[a.status]} ${a.date}`).join('\n')}`, MENU)
  } else {
    await send(chat, 'Quyidagi tugmalardan foydalaning 👇', MENU)
  }
  return new Response('ok')
})
