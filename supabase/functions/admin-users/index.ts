// Xodim yoki o'quvchi/ota-ona uchun kirish hisobini yaratish (faqat rahbar va admin).
import { adminClient, corsHeaders, json, normalizePhone } from '../_shared/util.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ROLES = ['owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher', 'student', 'parent']
const PROFILE_FIELDS = ['full_name', 'role', 'branch_id', 'hire_date', 'salary_type', 'salary_fixed', 'salary_percent', 'salary_per_lesson', 'specialization', 'student_id', 'notes', 'is_active', 'lang']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const h = corsHeaders
  // Chaqiruvchini tekshirish
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: u } = await caller.auth.getUser()
  if (!u.user) return json({ error: 'unauthorized' }, 401, h)
  const db = adminClient()
  const { data: me } = await db.from('profiles').select('role, is_active').eq('id', u.user.id).single()
  if (!me?.is_active || !['owner', 'admin'].includes(me.role)) return json({ error: 'forbidden' }, 403, h)

  const body = await req.json()
  if (body.action === 'create') {
    if (!ROLES.includes(body.role)) return json({ error: 'bad role' }, 400, h)
    if (body.role === 'owner' && me.role !== 'owner') return json({ error: 'forbidden' }, 403, h)
    const phone = body.phone ? normalizePhone(body.phone) : null
    const email = (body.email || (phone ? `${phone.slice(1)}@phone.lolaedu.uz` : '')).toLowerCase()
    if (!email || !body.password || body.password.length < 6) return json({ error: 'email/password' }, 400, h)
    const { data: created, error } = await db.auth.admin.createUser({ email, password: body.password, email_confirm: true })
    if (error) return json({ error: error.message }, 400, h)
    const profile = Object.fromEntries(PROFILE_FIELDS.filter((k) => body[k] !== undefined && body[k] !== '').map((k) => [k, body[k]]))
    const { error: pe } = await db.from('profiles').insert({ ...profile, id: created.user.id, email, phone })
    if (pe) {
      await db.auth.admin.deleteUser(created.user.id)
      return json({ error: pe.message }, 400, h)
    }
    return json({ id: created.user.id }, 200, h)
  }
  if (body.action === 'reset_password') {
    const { data: target } = await db.from('profiles').select('role').eq('id', body.id).single()
    if (target?.role === 'owner' && me.role !== 'owner') return json({ error: 'forbidden' }, 403, h)
    const { error } = await db.auth.admin.updateUserById(body.id, { password: body.password })
    return error ? json({ error: error.message }, 400, h) : json({ ok: true }, 200, h)
  }
  return json({ error: 'unknown action' }, 400, h)
})
