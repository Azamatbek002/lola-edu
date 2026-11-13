-- ════════════════════════════════════════════════════════════════════════════
-- Xavfsizlik: Row Level Security (RLS). Har bir rol faqat ruxsat etilgan
-- ma'lumotlarni ko'radi va o'zgartiradi. Ruxsatlar src/lib/permissions.ts bilan mos.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Yordamchi funksiyalar ──────────────────────────────────────────────────
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function public.my_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from profiles where id = auth.uid()
$$;

create or replace function public.my_student() returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from profiles where id = auth.uid() and role in ('student', 'parent') and is_active
$$;

create or replace function public.has_role(variadic roles text[]) returns boolean
language sql stable as $$
  select coalesce(public.my_role() = any(roles), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$
  select public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher')
$$;

/** Filial bo'yicha cheklov: rahbar, admin, marketolog, buxgalter — hammasini ko'radi */
create or replace function public.sees_branch(b uuid) returns boolean
language sql stable as $$
  select public.has_role('owner', 'admin', 'marketer', 'accountant')
      or b is null
      or public.my_branch() is null
      or b = public.my_branch()
$$;

/** O'qituvchi shu guruhga dars beradimi */
create or replace function public.teaches(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = g and teacher_id = auth.uid())
$$;

/** O'quvchi/ota-ona shu guruhda o'qiydimi */
create or replace function public.my_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where group_id = g and student_id = public.my_student() and status <> 'left')
$$;

-- ─── RLS yoqish ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'branches', 'rooms', 'students', 'profiles', 'courses', 'groups', 'enrollments', 'lessons', 'attendance',
    'grades', 'homework', 'homework_submissions', 'certificates', 'materials', 'charges', 'payments',
    'payment_transactions', 'expenses', 'salary_payouts', 'products', 'product_sales', 'campaigns', 'leads',
    'lead_activities', 'promo_codes', 'message_templates', 'messages', 'notifications', 'feedback', 'events',
    'tasks', 'settings', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─── Umumiy ma'lumotnomalar: barcha kirgan foydalanuvchilar o'qiydi ─────────
create policy read_all on branches for select to authenticated using (true);
create policy read_all on rooms for select to authenticated using (true);
create policy read_all on courses for select to authenticated using (true);
create policy read_all on materials for select to authenticated using (true);
create policy read_all on events for select to authenticated using (true);
create policy read_all on settings for select to authenticated using (true);
create policy read_all on message_templates for select to authenticated using (public.is_staff());
-- Ochiq ariza formasi kurs va filiallarni ko'rsatadi
create policy anon_read on courses for select to anon using (is_active);
create policy anon_read on branches for select to anon using (is_active);

create policy write_admin on branches for all to authenticated using (public.has_role('owner', 'admin')) with check (public.has_role('owner', 'admin'));
create policy write_admin on rooms for all to authenticated using (public.has_role('owner', 'admin')) with check (public.has_role('owner', 'admin'));
create policy write_admin on courses for all to authenticated using (public.has_role('owner', 'admin')) with check (public.has_role('owner', 'admin'));
create policy write_admin on settings for all to authenticated using (public.has_role('owner', 'admin')) with check (public.has_role('owner', 'admin'));
create policy write_staff on message_templates for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer')) with check (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer'));
create policy write_edu on materials for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'teacher')) with check (public.has_role('owner', 'admin', 'manager', 'teacher'));
create policy write_events on events for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'marketer')) with check (public.has_role('owner', 'admin', 'manager', 'marketer'));

-- ─── Profillar ──────────────────────────────────────────────────────────────
create policy own_read on profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy own_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
create policy admin_write on profiles for all to authenticated
  using (public.has_role('owner') or (public.has_role('admin') and role <> 'owner'))
  with check (public.has_role('owner') or (public.has_role('admin') and role <> 'owner'));

-- ─── O'quvchilar ────────────────────────────────────────────────────────────
create policy staff_read on students for select to authenticated using (public.is_staff() and public.sees_branch(branch_id));
create policy portal_read on students for select to authenticated using (id = public.my_student());
create policy staff_write on students for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales') and public.sees_branch(branch_id))
  with check (public.has_role('owner', 'admin', 'manager', 'reception', 'sales') and public.sees_branch(branch_id));

-- ─── Guruhlar va yozilishlar ────────────────────────────────────────────────
create policy staff_read on groups for select to authenticated using (public.is_staff());
create policy portal_read on groups for select to authenticated using (public.my_group(id));
create policy mgmt_write on groups for all to authenticated
  using (public.has_role('owner', 'admin', 'manager') and public.sees_branch(branch_id))
  with check (public.has_role('owner', 'admin', 'manager') and public.sees_branch(branch_id));

create policy staff_read on enrollments for select to authenticated using (public.is_staff());
create policy portal_read on enrollments for select to authenticated using (student_id = public.my_student());
create policy staff_write on enrollments for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales'))
  with check (public.has_role('owner', 'admin', 'manager', 'reception', 'sales'));

-- ─── Darslar, davomat, baholar, vazifalar ───────────────────────────────────
create policy staff_read on lessons for select to authenticated using (public.is_staff());
create policy portal_read on lessons for select to authenticated using (public.my_group(group_id));
create policy edu_write on lessons for all to authenticated
  using (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id))
  with check (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id));

create policy staff_read on attendance for select to authenticated using (public.is_staff());
create policy portal_read on attendance for select to authenticated using (student_id = public.my_student());
create policy edu_write on attendance for all to authenticated
  using (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id))
  with check (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id));

create policy staff_read on grades for select to authenticated using (public.is_staff());
create policy portal_read on grades for select to authenticated using (student_id = public.my_student());
create policy edu_write on grades for all to authenticated
  using (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id))
  with check (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id));

create policy staff_read on homework for select to authenticated using (public.is_staff());
create policy portal_read on homework for select to authenticated using (public.my_group(group_id));
create policy edu_write on homework for all to authenticated
  using (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id))
  with check (public.has_role('owner', 'admin', 'manager') or public.teaches(group_id));

create policy staff_read on homework_submissions for select to authenticated using (public.is_staff());
create policy portal_read on homework_submissions for select to authenticated using (student_id = public.my_student());
create policy student_submit on homework_submissions for insert to authenticated
  with check (public.has_role('student') and student_id = public.my_student() and status = 'submitted' and score is null);
create policy teacher_check on homework_submissions for update to authenticated
  using (public.has_role('owner', 'admin', 'manager') or exists (select 1 from homework h where h.id = homework_id and public.teaches(h.group_id)));

create policy staff_read on certificates for select to authenticated using (public.is_staff());
create policy portal_read on certificates for select to authenticated using (student_id = public.my_student());
create policy mgmt_write on certificates for all to authenticated using (public.has_role('owner', 'admin', 'manager')) with check (public.has_role('owner', 'admin', 'manager'));

-- ─── Moliya ─────────────────────────────────────────────────────────────────
-- O'qituvchilar ham balansni ko'radi (guruh sahifasi), lekin o'zgartira olmaydi
create policy staff_read on charges for select to authenticated using (public.is_staff());
create policy portal_read on charges for select to authenticated using (student_id = public.my_student());
create policy fin_write on charges for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'accountant', 'reception', 'sales'))
  with check (public.has_role('owner', 'admin', 'manager', 'accountant', 'reception', 'sales'));

create policy staff_read on payments for select to authenticated using (public.is_staff() and public.sees_branch(branch_id));
create policy portal_read on payments for select to authenticated using (student_id = public.my_student());
create policy fin_insert on payments for insert to authenticated
  with check (public.has_role('owner', 'admin', 'manager', 'reception', 'accountant') and received_by = auth.uid());
-- To'lovni faqat rahbar, admin va buxgalter tahrirlaydi/qaytaradi; o'chirish — faqat rahbar
create policy fin_update on payments for update to authenticated using (public.has_role('owner', 'admin', 'accountant'));
create policy fin_delete on payments for delete to authenticated using (public.has_role('owner'));

create policy fin_read on payment_transactions for select to authenticated using (public.has_role('owner', 'admin', 'accountant'));

create policy fin_read on expenses for select to authenticated using (public.has_role('owner', 'admin', 'manager', 'accountant') and public.sees_branch(branch_id));
create policy fin_write on expenses for all to authenticated using (public.has_role('owner', 'admin', 'accountant')) with check (public.has_role('owner', 'admin', 'accountant'));

create policy sal_read on salary_payouts for select to authenticated using (public.has_role('owner', 'admin', 'accountant') or teacher_id = auth.uid());
create policy sal_write on salary_payouts for all to authenticated using (public.has_role('owner', 'admin', 'accountant')) with check (public.has_role('owner', 'admin', 'accountant'));

create policy staff_read on products for select to authenticated using (public.is_staff());
create policy store_write on products for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'accountant')) with check (public.has_role('owner', 'admin', 'manager', 'reception', 'accountant'));
create policy staff_read on product_sales for select to authenticated using (public.is_staff());
create policy store_write on product_sales for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'accountant')) with check (public.has_role('owner', 'admin', 'manager', 'reception', 'accountant'));

-- ─── CRM va marketing ───────────────────────────────────────────────────────
create policy crm_read on leads for select to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer') and public.sees_branch(branch_id));
create policy crm_write on leads for all to authenticated
  using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales') and public.sees_branch(branch_id))
  with check (public.has_role('owner', 'admin', 'manager', 'reception', 'sales'));

create policy crm_read on lead_activities for select to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer'));
create policy crm_write on lead_activities for insert to authenticated with check (public.has_role('owner', 'admin', 'manager', 'reception', 'sales') and created_by = auth.uid());

create policy mk_read on campaigns for select to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer'));
create policy mk_write on campaigns for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'marketer')) with check (public.has_role('owner', 'admin', 'manager', 'marketer'));
create policy mk_read on promo_codes for select to authenticated using (public.is_staff());
create policy mk_write on promo_codes for all to authenticated using (public.has_role('owner', 'admin', 'manager', 'marketer')) with check (public.has_role('owner', 'admin', 'manager', 'marketer'));

-- ─── Aloqa ──────────────────────────────────────────────────────────────────
create policy msg_read on messages for select to authenticated using (public.has_role('owner', 'admin', 'manager', 'reception', 'sales', 'marketer'));
-- Xabarni navbatga qo'yish: xodimlar (o'qituvchi ham — davomat xabarlari uchun)
create policy msg_insert on messages for insert to authenticated with check (public.is_staff() and status = 'queued');

create policy notif_read on notifications for select to authenticated
  using (user_id = auth.uid() or (user_id is null and (roles is null or public.my_role() = any(roles))));
create policy notif_mark on notifications for update to authenticated
  using (user_id = auth.uid() or (user_id is null and (roles is null or public.my_role() = any(roles))));
create policy notif_insert on notifications for insert to authenticated with check (public.is_staff());

create policy fb_read on feedback for select to authenticated using (public.has_role('owner', 'admin', 'manager') or student_id = public.my_student());
create policy fb_insert on feedback for insert to authenticated with check (student_id = public.my_student() or public.has_role('owner', 'admin', 'manager'));
create policy fb_update on feedback for update to authenticated using (public.has_role('owner', 'admin', 'manager'));

create policy task_read on tasks for select to authenticated using (public.is_staff());
create policy task_write on tasks for all to authenticated
  using (public.is_staff() and (assigned_to = auth.uid() or created_by = auth.uid() or public.has_role('owner', 'admin', 'manager')))
  with check (public.is_staff());

create policy audit_read on audit_log for select to authenticated using (public.has_role('owner', 'admin'));
create policy audit_insert on audit_log for insert to authenticated with check (public.is_staff() and user_id = auth.uid());

-- ─── Ochiq funksiyalar ──────────────────────────────────────────────────────

/** Ochiq ariza formasidan lid qabul qilish (anonim). Bir telefondan soatiga 1 ta. */
create or replace function public.submit_lead(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(payload->>'phone', ''), '[^0-9+]', '', 'g');
  v_name text := left(trim(coalesce(payload->>'full_name', '')), 120);
begin
  if length(v_name) < 2 or length(v_phone) < 12 then
    raise exception 'invalid lead';
  end if;
  if exists (select 1 from leads where phone = v_phone and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into leads (full_name, phone, source, course_id, branch_id, level, stage, notes, utm_source, utm_campaign)
  values (
    v_name, v_phone, left(coalesce(payload->>'source', 'Sayt'), 40),
    (select id from courses where id::text = payload->>'course_id'),
    (select id from branches where id::text = payload->>'branch_id'),
    nullif(payload->>'level', ''), 'new', left(payload->>'notes', 500),
    left(payload->>'utm_source', 60), left(payload->>'utm_campaign', 120)
  );
  insert into notifications (roles, title, body, link)
  values (array['owner', 'admin', 'manager', 'reception', 'sales'], 'Yangi lid: ' || v_name, v_phone, '/leads');
end $$;
revoke all on function public.submit_lead(jsonb) from public;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;

/** Telefon raqami bilan kirish uchun: telefon → email (faqat faol foydalanuvchilar) */
create or replace function public.email_by_phone(p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where phone = p_phone and is_active order by created_at limit 1
$$;
grant execute on function public.email_by_phone(text) to anon, authenticated;

/** Foydalanuvchi o'z profilida faqat til, telefon va Telegram'ni o'zgartira oladi (maosh, rol, filial — yo'q) */
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('owner', 'admin') then
    new.role := old.role;
    new.branch_id := old.branch_id;
    new.is_active := old.is_active;
    new.salary_type := old.salary_type;
    new.salary_fixed := old.salary_fixed;
    new.salary_percent := old.salary_percent;
    new.salary_per_lesson := old.salary_per_lesson;
    new.student_id := old.student_id;
    new.hire_date := old.hire_date;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles for each row execute function public.protect_profile();

/** O'quvchi/ota-ona uchun xodimlar ma'lumotnomasi: faqat ism va rol (maosh ko'rinmaydi) */
create or replace view public.staff_directory as
  select id, full_name, role, branch_id, specialization from profiles
  where is_active and role in ('owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher');
revoke all on public.staff_directory from anon;
grant select on public.staff_directory to authenticated;
