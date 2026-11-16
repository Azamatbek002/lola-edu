// Kunlik zaxira: barcha jadvallar → parolli ZIP → Storage ('backups', oxirgi 30 ta) + rahbarning Telegram'i.
// Chaqiruvchi: pg_cron (har kecha 02:00 Toshkent) yoki ilovadagi "Hozir zaxira olish" (rahbar/administrator).
// Arxiv paroli: BACKUP_ZIP_PASSWORD secret (rahbarda ham saqlanadi — baza yo'qolsa ham arxivni ochish uchun).
import { adminClient, corsHeaders, cronAuthorized, json } from '../_shared/util.ts'
import { buildBackupZip, TABLES, type BackupMeta } from './archive.ts'

const KEEP = 30
const BUCKET = 'backups'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const db = adminClient()

  // Ruxsat: cron kaliti yoki rahbar/administrator
  let createdBy = 'avtomatik (har kecha)'
  if (!(await cronAuthorized(req))) {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } }
    if (!u?.user) return json({ error: 'forbidden' }, 403, corsHeaders)
    const { data: p } = await db.from('profiles').select('role, full_name').eq('id', u.user.id).maybeSingle()
    if (!p || !['owner', 'admin'].includes(p.role)) return json({ error: 'forbidden' }, 403, corsHeaders)
    createdBy = p.full_name
  }

  const password = Deno.env.get('BACKUP_ZIP_PASSWORD')
  if (!password) return json({ error: 'BACKUP_ZIP_PASSWORD secret kiritilmagan' }, 500, corsHeaders)

  // 1) Ma'lumotlarni yig'ish
  const tables: Record<string, Record<string, unknown>[]> = {}
  const meta: BackupMeta = { created_at: '', created_by: createdBy, counts: {}, errors: {} }
  for (const t of TABLES) {
    const rows: Record<string, unknown>[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select('*').range(from, from + 999)
      if (error) {
        meta.errors[t] = error.message
        break
      }
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    tables[t] = rows
    meta.counts[t] = rows.length
  }
  const tk = new Date(Date.now() + 5 * 3600_000).toISOString() // Toshkent vaqti
  meta.created_at = `${tk.slice(8, 10)}.${tk.slice(5, 7)}.${tk.slice(0, 4)} ${tk.slice(11, 16)} (Toshkent)`
  const name = `lola-edu-zaxira-${tk.slice(0, 10)}_${tk.slice(11, 16).replace(':', '-')}.zip`
  const zip = await buildBackupZip(tables, password, meta)

  // 2) Serverda saqlash (oxirgi 30 tasi qoladi)
  const up = await db.storage.from(BUCKET).upload(name, zip, { contentType: 'application/zip', upsert: true })
  const { data: files } = await db.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
  const old = (files ?? []).filter((f) => f.name.endsWith('.zip')).slice(KEEP).map((f) => f.name)
  if (old.length) await db.storage.from(BUCKET).remove(old)

  // 3) Rahbarning Telegram'iga yuborish
  const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  const { data: owners } = await db.from('profiles').select('telegram_chat_id').eq('role', 'owner').eq('is_active', true).not('telegram_chat_id', 'is', null)
  const c = meta.counts
  const caption =
    `Lola Edu — zaxira nusxa\n${meta.created_at}\n` +
    `O'quvchilar: ${c.students ?? 0} · Guruhlar: ${c.groups ?? 0} · To'lovlar: ${c.payments ?? 0} · Davomat: ${c.attendance ?? 0}\n` +
    `Arxiv paroli sizda saqlangan. Bu faylni hech kimga yubormang.`
  let sent = 0
  for (const o of owners ?? []) {
    if (!TOKEN) break
    const fd = new FormData()
    fd.append('chat_id', String(o.telegram_chat_id))
    fd.append('caption', caption)
    fd.append('document', new File([zip], name, { type: 'application/zip' }))
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, { method: 'POST', body: fd })
    if (r.ok) sent++
  }

  return json(
    {
      ok: !up.error,
      file: name,
      size: zip.size,
      stored: !up.error,
      storage_error: up.error?.message ?? null,
      telegram_sent: sent,
      telegram_owners: owners?.length ?? 0,
      counts: c,
      errors: meta.errors,
    },
    up.error ? 500 : 200,
    corsHeaders,
  )
})
