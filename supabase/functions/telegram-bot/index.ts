// Telegram bot webhook: o'quvchi/ota-ona/xodimni telefon raqami orqali bog'laydi
// va /balans, /jadval, /davomat buyruqlariga javob beradi.
// Webhook o'rnatish: GET <project>/functions/v1/telegram-bot?setup=1 — funksiya o'zini Telegram'ga ro'yxatdan o'tkazadi.
// Faqat TELEGRAM_BOT_TOKEN secret kerak; webhook maxfiy kaliti tokendan hosil qilinadi.
import { adminClient, json, money, normalizePhone, safeEqual, sha256Hex } from '../_shared/util.ts'

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const SECRET_PROMISE = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  ? Promise.resolve(Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!)
  : sha256Hex(TOKEN + ':lola-edu-webhook').then((h) => h.slice(0, 48))

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await r.json()
}

/** Webhook va buyruqlar menyusini o'rnatadi. Takror chaqirish xavfsiz. */
async function setup() {
  if (!TOKEN) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN secret kiritilmagan' }, 500)
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`
  const webhook = await tg('setWebhook', { url, secret_token: await SECRET_PROMISE, allowed_updates: ['message'], drop_pending_updates: true })
  const commands = await tg('setMyCommands', {
    commands: [
      { command: 'start', description: "Boshlash / raqamni bog'lash" },
      { command: 'balans', description: "To'lovlar: qarz va keyingi to'lov sanasi" },
      { command: 'jadval', description: 'Dars jadvali' },
      { command: 'davomat', description: 'Oxirgi darslar davomati' },
    ],
  })
  const me = await tg('getMe', {})
  return json({ ok: !!webhook.ok, webhook: webhook.description, commands: !!commands.ok, username: me.result?.username ?? null })
}
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
  if (req.method === 'GET' && new URL(req.url).searchParams.get('setup') === '1') return await setup()
  if (!TOKEN || !safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', await SECRET_PROMISE)) return new Response('forbidden', { status: 403 })
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

  if (!students?.length) {
    // Xodim (rahbar, administrator, o'qituvchi) — bildirishnomalar va zaxira nusxalar shu yerga keladi
    const { data: staff } = await db.from('profiles').select('full_name').eq('telegram_chat_id', chat).limit(1).maybeSingle()
    if (staff) {
      await send(chat, `✅ ${staff.full_name}, Telegram ulangan. Bildirishnomalar va zaxira nusxalar shu yerga keladi.`, { reply_markup: { remove_keyboard: true } })
      return new Response('ok')
    }
  }

  if (text === '/start' || !students?.length) {
    await send(chat, "Assalomu alaykum! <b>Lola Edu Türk Dili Markazi</b> botiga xush kelibsiz.\n\nDavom etish uchun telefon raqamingizni yuboring 👇", {
      reply_markup: { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    })
    return new Response('ok')
  }

  const ids = students.map((s) => s.id)
  if (/balans|\/balance/i.test(text)) {
    // Har bir o'quvchi: muddati o'tgan qarz va keyingi to'lov sanasi (public.charge_status)
    const [{ data: bal }, { data: st }, { data: codes }, { data: op }] = await Promise.all([
      db.from('student_balances').select('student_id, full_name, balance').in('student_id', ids),
      db.from('charge_status').select('student_id, group_id, due_date, remaining, state').in('student_id', ids).neq('state', 'paid').order('due_date'),
      db.from('students').select('id, pay_code').in('id', ids),
      db.from('settings').select('value').eq('key', 'online_pay').maybeSingle(),
    ])
    // Onlayn to'lov ulangan bo'lsa — har bir o'quvchi uchun to'lov sahifasi havolasi
    const opv = (op?.value ?? {}) as Record<string, string>
    const payOn = !!(opv.payme_merchant_id || (opv.click_service_id && opv.click_merchant_id))
    const site = (opv.site_url || 'https://lola-edu.vercel.app').replace(/\/+$/, '')
    const codeOf = new Map((codes ?? []).map((c: any) => [c.id, c.pay_code as string]))
    const gids = [...new Set((st ?? []).map((c: any) => c.group_id))]
    const { data: gr } = gids.length ? await db.from('groups').select('id, name').in('id', gids) : { data: [] as { id: string; name: string }[] }
    const gname = new Map((gr ?? []).map((g) => [g.id, g.name]))
    const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`
    const blocks = (bal ?? []).map((b) => {
      const mine = (st ?? []).filter((c: any) => c.student_id === b.student_id)
      const overdue = mine.filter((c: any) => c.state === 'overdue')
      const next = mine.find((c: any) => c.state !== 'overdue')
      const lines = [`👤 <b>${b.full_name}</b>`]
      if (overdue.length) {
        const sum = overdue.reduce((x: number, c: any) => x + Number(c.remaining), 0)
        lines.push(`❗ To'lanmagan: <b>${money(sum)}</b>`)
        for (const c of overdue as any[]) lines.push(`   • ${gname.get(c.group_id) ?? ''}: ${money(Number(c.remaining))} — muddat ${ddmm(c.due_date)}`)
      }
      if (next) lines.push(`📅 Keyingi to'lov: <b>${ddmm((next as any).due_date)}</b> — ${money(Number((next as any).remaining))}${(next as any).state === 'today' ? ' (bugun)' : ''}`)
      if (!overdue.length && !next) lines.push(b.balance > 0 ? `✅ To'langan. Oldindan: ${money(b.balance)}` : "✅ Hammasi to'langan")
      const code = codeOf.get(b.student_id)
      if (payOn && code) {
        const toPay = overdue.length ? overdue.reduce((x: number, c: any) => x + Number(c.remaining), 0) : next ? Number((next as any).remaining) : 0
        lines.push(`💳 <a href="${site}/pay/${code}${toPay > 0 ? '?a=' + Math.round(toPay) : ''}">Payme yoki Click orqali to'lash</a> (raqam: ${code})`)
      }
      return lines.join('\n')
    })
    await send(chat, `💰 <b>To'lovlar</b>\n\n${blocks.join('\n\n')}`, MENU)
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
