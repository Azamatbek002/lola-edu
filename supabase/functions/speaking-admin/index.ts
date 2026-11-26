// Gapirish imtihoni — xizmat funksiyasi:
//  • cleanup: baholangandan N kun (sozlama, standart 2) o'tgan o'quvchi ovozlarini yopiq ombordan o'chiradi (pg_cron, har kuni)
//  • import:  tayyor variantni (matn + rasmlar) yuklaydi — rahbar/administrator yoki bir martalik import kaliti bilan
// Ruxsat: cron kaliti, rahbar/administrator JWT yoki private.app_secrets['speaking_import'].
import { adminClient, corsHeaders, cronAuthorized, json } from '../_shared/util.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const db = adminClient()
  if (!(await authorized(req, db))) return json({ error: 'forbidden' }, 403, corsHeaders)
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'cleanup') return await doCleanup(db)
  if (body?.action === 'import') return await doImport(db, body as ImportBody)
  return json({ error: 'unknown_action' }, 400, corsHeaders)
})
