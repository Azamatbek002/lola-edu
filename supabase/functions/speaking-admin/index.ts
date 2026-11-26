// Gapirish imtihoni — xizmat funksiyasi:
//  • cleanup: baholangandan N kun (sozlama, standart 2) o'tgan o'quvchi ovozlarini yopiq ombordan o'chiradi (pg_cron, har kuni)
//  • import:  tayyor variantni (matn + rasmlar) yuklaydi — rahbar/administrator yoki bir martalik import kaliti bilan
//  • notify:  topshirilgan imtihon ovozlarini rahbarga Telegram bot orqali yuboradi (pg_cron, har 2 daqiqada).
//             Javoblar yuklangach (yoki topshirilganidan 30 daqiqa o'tgach) — sarlavha xabari va har savolga ovozli xabar.
// Ruxsat: cron kaliti, rahbar/administrator JWT yoki private.app_secrets['speaking_import'].
import { adminClient, corsHeaders, cronAuthorized, json } from '../_shared/util.ts'
import { webmToOgg } from '../_shared/webm2ogg.ts'

type Db = ReturnType<typeof adminClient>

interface ImportItem {
  part: '1.1' | '1.2' | '2' | '3'
  position: number
  prompt?: string | null
  bullets?: string[]
  pros?: string[]
  cons?: string[]
  images?: string[] // import paketidagi fayl nomlari
  prep_seconds: number
  answer_seconds: number
}
interface ImportBody {
  action: 'import'
  variant: { title: string; level?: string | null; status?: 'draft' | 'published'; sort?: number; source: string }
  items: ImportItem[]
  files: { name: string; type: string; b64: string }[]
}

async function authorized(req: Request, db: Db): Promise<boolean> {
  if (await cronAuthorized(req)) return true
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const importKey = req.headers.get('x-import-key') ?? ''
  if (importKey) {
    const { data } = await db.rpc('check_app_secret', { p_key: 'speaking_import', p_value: importKey })
    if (data === true) return true
  }
  if (!token) return false
  const { data: u } = await db.auth.getUser(token)
  if (!u?.user) return false
  const { data: p } = await db.from('profiles').select('role, is_active').eq('id', u.user.id).maybeSingle()
  return !!p?.is_active && ['owner', 'admin'].includes(p.role)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function doImport(db: Db, body: ImportBody) {
  const { variant, items, files } = body
  if (!variant?.title || !variant?.source || !Array.isArray(items) || !items.length) return json({ error: 'bad_request' }, 400, corsHeaders)
  // Takroriy importdan himoya: bir xil manba ikkinchi marta yozilmaydi
  const { data: ex } = await db.from('speaking_variants').select('id').eq('source', variant.source).maybeSingle()
  if (ex) return json({ ok: true, skipped: true, id: ex.id }, 200, corsHeaders)

  const { data: v, error: ve } = await db
    .from('speaking_variants')
    .insert({ title: variant.title, level: variant.level ?? null, status: variant.status ?? 'draft', sort: variant.sort ?? 0, source: variant.source })
    .select('id')
    .single()
  if (ve || !v) return json({ error: ve?.message ?? 'insert_failed' }, 500, corsHeaders)

  const pathOf = new Map<string, string>()
  for (const f of files ?? []) {
    const path = `${v.id}/${f.name}`
    const { error } = await db.storage.from('speaking-media').upload(path, b64ToBytes(f.b64), { contentType: f.type, upsert: true })
    if (error) {
      await db.from('speaking_variants').delete().eq('id', v.id)
      return json({ error: 'upload_failed: ' + error.message }, 500, corsHeaders)
    }
    pathOf.set(f.name, path)
  }
  const rows = items.map((it) => ({
    variant_id: v.id,
    part: it.part,
    position: it.position,
    prompt: it.prompt ?? null,
    bullets: it.bullets ?? [],
    pros: it.pros ?? [],
    cons: it.cons ?? [],
    images: (it.images ?? []).map((n) => pathOf.get(n)).filter(Boolean),
    prep_seconds: it.prep_seconds,
    answer_seconds: it.answer_seconds,
  }))
  const { error: ie } = await db.from('speaking_items').insert(rows)
  if (ie) {
    await db.from('speaking_variants').delete().eq('id', v.id)
    return json({ error: ie.message }, 500, corsHeaders)
  }
  return json({ ok: true, id: v.id, items: rows.length, files: pathOf.size }, 200, corsHeaders)
}

async function doCleanup(db: Db) {
  const { data: cfg } = await db.from('settings').select('value').eq('key', 'speaking').maybeSingle()
  const days = Number((cfg?.value as Record<string, unknown> | null)?.retention_days_after_grading ?? 2) || 2
  const before = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data: due } = await db
    .from('speaking_attempts')
    .select('id')
    .eq('status', 'graded')
    .lt('graded_at', before)
    .is('audio_deleted_at', null)
    .limit(200)
  let removed = 0
  for (const a of due ?? []) {
    const { data: files } = await db.storage.from('speaking-answers').list(a.id, { limit: 100 })
    const paths = (files ?? []).map((f) => `${a.id}/${f.name}`)
    if (paths.length) {
      const { error } = await db.storage.from('speaking-answers').remove(paths)
      if (error) continue
      removed += paths.length
    }
    await db.from('speaking_answers').update({ audio_path: null }).eq('attempt_id', a.id)
    await db.from('speaking_attempts').update({ audio_deleted_at: new Date().toISOString() }).eq('id', a.id)
  }
  return json({ ok: true, attempts: due?.length ?? 0, files_removed: removed, retention_days: days }, 200, corsHeaders)
}

const PART: Record<string, string> = { '1.1': "1.1-bo'lim", '1.2': "1.2-bo'lim", '2': "2-bo'lim", '3': "3-bo'lim" }
const tashkent = (iso: string) => new Date(Date.parse(iso) + 5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

async function tg(token: string, method: string, body: FormData | Record<string, unknown>) {
  const init: RequestInit =
    body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, init)
  return r.ok
}

/** Bitta javobni ovozli xabar qilib yuborish (WebM → OGG; M4A/MP3 to'g'ridan-to'g'ri; boshqasi — fayl) */
async function sendAnswer(token: string, chat: string, bytes: Uint8Array, mime: string, caption: string): Promise<boolean> {
  const base = (m: string) => m.split(';')[0].trim()
  let file: File | null = null
  let method = 'sendVoice'
  let field = 'voice'
  try {
    if (/webm/.test(mime)) file = new File([webmToOgg(bytes).ogg as BlobPart], 'javob.ogg', { type: 'audio/ogg' })
    else if (/mp4|m4a|aac/.test(mime)) file = new File([bytes as BlobPart], 'javob.m4a', { type: 'audio/mp4' })
    else if (/mpeg|mp3/.test(mime)) file = new File([bytes as BlobPart], 'javob.mp3', { type: 'audio/mpeg' })
    else if (/ogg/.test(mime)) file = new File([bytes as BlobPart], 'javob.ogg', { type: 'audio/ogg' })
  } catch {
    file = null
  }
  if (!file) {
    method = 'sendDocument'
    field = 'document'
    file = new File([bytes as BlobPart], 'javob.' + (base(mime).split('/')[1] || 'bin'), { type: base(mime) || 'application/octet-stream' })
  }
  const fd = new FormData()
  fd.append('chat_id', chat)
  fd.append('caption', caption)
  fd.append('disable_notification', 'true')
  fd.append(field, file)
  if (await tg(token, method, fd)) return true
  if (method === 'sendDocument') return false
  // Ovozli xabar o'tmasa (masalan, foydalanuvchi ovozli xabarlarni cheklagan) — fayl sifatida
  const fd2 = new FormData()
  fd2.append('chat_id', chat)
  fd2.append('caption', caption)
  fd2.append('disable_notification', 'true')
  fd2.append('document', file)
  return await tg(token, 'sendDocument', fd2)
}

async function doNotify(db: Db) {
  const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!TOKEN) return json({ ok: false, error: 'no_bot_token' }, 200, corsHeaders)
  const { data: owners } = await db.from('profiles').select('telegram_chat_id').eq('role', 'owner').eq('is_active', true).not('telegram_chat_id', 'is', null)
  const chats = [...new Set((owners ?? []).map((o) => String(o.telegram_chat_id)))]
  if (!chats.length) return json({ ok: true, sent: 0, note: 'no_owner_telegram' }, 200, corsHeaders)
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: list } = await db
    .from('speaking_attempts')
    .select('id, variant_id, student_id, submitted_at, progress')
    .in('status', ['submitted', 'graded'])
    .is('owner_notified_at', null)
    .gt('submitted_at', since)
    .order('submitted_at')
    .limit(3)
  let done = 0
  for (const a of list ?? []) {
    const [{ data: items }, { data: answers }, { data: st }, { data: v }, { data: enr }] = await Promise.all([
      db.from('speaking_items').select('id, part, position, prompt, bullets').eq('variant_id', a.variant_id),
      db.from('speaking_answers').select('item_id, audio_path, mime, duration_ms').eq('attempt_id', a.id),
      db.from('students').select('full_name').eq('id', a.student_id).maybeSingle(),
      db.from('speaking_variants').select('title').eq('id', a.variant_id).maybeSingle(),
      db.from('enrollments').select('groups(name, teacher_id)').eq('student_id', a.student_id).eq('status', 'active').limit(1),
    ])
    const order = ['1.1', '1.2', '2', '3']
    const its = (items ?? []).sort((x, y) => order.indexOf(x.part) - order.indexOf(y.part) || x.position - y.position)
    const ans = answers ?? []
    const late = Date.parse(a.submitted_at) < Date.now() - 30 * 60_000
    if (ans.length < its.length && !late) continue // javoblar hali yuklanmoqda

    const g = (enr?.[0] as unknown as { groups?: { name?: string; teacher_id?: string } } | undefined)?.groups
    let teacher = ''
    if (g?.teacher_id) {
      const { data: t } = await db.from('profiles').select('full_name').eq('id', g.teacher_id).maybeSingle()
      teacher = t?.full_name ?? ''
    }
    const blurs = Number((a.progress as { blurs?: number } | null)?.blurs ?? 0)
    const head =
      `🎙 Gapirish imtihoni topshirildi\n` +
      `O'quvchi: ${st?.full_name ?? '—'}\n` +
      (g?.name ? `Guruh: ${g.name}${teacher ? ` (ustoz: ${teacher})` : ''}\n` : '') +
      `Variant: ${v?.title ?? '—'}\n` +
      `Vaqt: ${tashkent(a.submitted_at)}\n` +
      `Javoblar: ${ans.filter((x) => x.audio_path).length}/${its.length}` +
      (blurs > 0 ? `\n⚠️ Imtihon paytida ilovadan ${blurs} marta chiqqan` : '') +
      `\n\nBaholash: ilovada «Gapirish imtihoni» bo'limida.`

    let anySent = false
    for (const chat of chats) {
      if (!(await tg(TOKEN, 'sendMessage', { chat_id: chat, text: head }))) continue
      anySent = true
      for (let i = 0; i < its.length; i++) {
        const it = its[i]
        const an = ans.find((x) => x.item_id === it.id)
        if (!an?.audio_path) continue
        const { data: blob } = await db.storage.from('speaking-answers').download(an.audio_path)
        if (!blob) continue
        const q = it.prompt?.trim() || (it.bullets ?? []).join(' / ')
        const caption = cut(`${i + 1}/${its.length} · ${PART[it.part] ?? it.part}${q ? ' — ' + q : ''}`, 1000)
        await sendAnswer(TOKEN, chat, new Uint8Array(await blob.arrayBuffer()), an.mime ?? blob.type ?? '', caption)
      }
    }
    if (anySent) {
      await db.from('speaking_attempts').update({ owner_notified_at: new Date().toISOString() }).eq('id', a.id)
      done++
    }
  }
  return json({ ok: true, sent: done, pending: (list?.length ?? 0) - done }, 200, corsHeaders)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const db = adminClient()
  if (!(await authorized(req, db))) return json({ error: 'forbidden' }, 403, corsHeaders)
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'cleanup') return await doCleanup(db)
  if (body?.action === 'notify') return await doNotify(db)
  if (body?.action === 'import') return await doImport(db, body as ImportBody)
  return json({ error: 'unknown_action' }, 400, corsHeaders)
})
