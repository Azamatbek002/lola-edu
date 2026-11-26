-- ════════════════════════════════════════════════════════════════════════════
-- Gapirish imtihoni (milliy CEFR, turk tili)
--  • variantlar va ularning savollari (1.1, 1.2, 2, 3-bo'limlar)
--  • o'quvchi urinishlari (har variant 1 marta) va ovozli javoblar
--  • yopiq omborlar: speaking-media (savol rasmlari/ovoz/video), speaking-answers (o'quvchi ovozlari)
--  • baholash: guruh ustozi va rahbariyat; baholangach o'quvchi va ota-onaga Telegram xabari
-- Hammasi qo'shimcha (additive): mavjud jadvallarga tegilmaydi.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Variantlar va savollar ───────────────────────────────────────────────────
create table if not exists speaking_variants (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort int not null default 0,
  source text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists speaking_variants_source_uq on speaking_variants(source) where source is not null;

create table if not exists speaking_items (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references speaking_variants(id) on delete cascade,
  part text not null check (part in ('1.1', '1.2', '2', '3')),
  position int not null,
  prompt text,
  bullets text[] not null default '{}',
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  images text[] not null default '{}',
  media_path text,
  media_kind text check (media_kind in ('audio', 'video')),
  prep_seconds int not null default 5 check (prep_seconds between 0 and 600),
  answer_seconds int not null default 30 check (answer_seconds between 5 and 600),
  created_at timestamptz not null default now()
);
create index if not exists speaking_items_variant_idx on speaking_items(variant_id, position);
comment on column speaking_items.prompt is 'Savol matni; 2-bo''limda sarlavha (ixtiyoriy), 3-bo''limda muhokama mavzusi';
comment on column speaking_items.bullets is '2-bo''lim: rasmga oid savollar';
comment on column speaking_items.pros is '3-bo''lim: Lehine (tarafdor) bandlari';
comment on column speaking_items.cons is '3-bo''lim: Aleyhine (qarshi) bandlari';
comment on column speaking_items.images is 'speaking-media omboridagi yo''llar';

-- 2) Urinishlar va javoblar ──────────────────────────────────────────────────
create table if not exists speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references speaking_variants(id) on delete restrict,
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  progress jsonb not null default '{}',
  scores jsonb,
  total numeric(7, 2),
  level text,
  comment text,
  graded_by uuid references profiles(id) on delete set null,
  graded_at timestamptz,
  audio_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, student_id)
);
create index if not exists speaking_attempts_student_idx on speaking_attempts(student_id);
create index if not exists speaking_attempts_status_idx on speaking_attempts(status);
comment on table speaking_attempts is 'Har bir o''quvchi har bir variantni 1 marta topshiradi (unique)';

create table if not exists speaking_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references speaking_attempts(id) on delete cascade,
  item_id uuid not null references speaking_items(id) on delete restrict,
  audio_path text,
  mime text,
  duration_ms int,
  size_bytes int,
  created_at timestamptz not null default now(),
  unique (attempt_id, item_id)
);

-- 3) Yordamchi funksiyalar ───────────────────────────────────────────────────
/** Baholovchi: rahbariyat yoki o'quvchining guruhida dars beradigan ustoz */
create or replace function public.can_grade_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('owner', 'admin', 'manager')
      or (public.has_role('teacher') and exists (
            select 1 from enrollments e join groups g on g.id = e.group_id
            where e.student_id = s and g.teacher_id = auth.uid() and e.status <> 'left'))
$$;

/** Imtihon materiallarini tahrirlash huquqi */
create or replace function public.can_edit_speaking() returns boolean
language sql stable as $$
  select public.has_role('owner', 'admin', 'manager', 'teacher')
$$;

-- 4) RLS ─────────────────────────────────────────────────────────────────────
alter table speaking_variants enable row level security;
alter table speaking_items enable row level security;
alter table speaking_attempts enable row level security;
alter table speaking_answers enable row level security;

drop policy if exists sv_read on speaking_variants;
create policy sv_read on speaking_variants for select to authenticated
  using (public.is_staff() or (status = 'published' and public.my_student() is not null));
drop policy if exists sv_write on speaking_variants;
create policy sv_write on speaking_variants for all to authenticated
  using (public.can_edit_speaking()) with check (public.can_edit_speaking());

-- Savollar o'quvchiga faqat imtihon paytida ochiladi (oldindan ko'rib, tayyorlanib bo'lmaydi)
drop policy if exists si_read on speaking_items;
create policy si_read on speaking_items for select to authenticated
  using (public.is_staff() or exists (
    select 1 from speaking_attempts a
    where a.variant_id = speaking_items.variant_id and a.student_id = public.my_student()
      and public.has_role('student') and a.status = 'in_progress'));
drop policy if exists si_write on speaking_items;
create policy si_write on speaking_items for all to authenticated
  using (public.can_edit_speaking()) with check (public.can_edit_speaking());

-- O'quvchi va ota-ona — faqat o'z (farzandi) urinishlarini; baholovchi — o'z o'quvchilarini
drop policy if exists sa_read on speaking_attempts;
create policy sa_read on speaking_attempts for select to authenticated
  using (student_id = public.my_student() or public.can_grade_student(student_id));
-- Baholash (ball, izoh) — faqat baholovchi. O'quvchi urinishni faqat RPC orqali boshlaydi va yakunlaydi.
drop policy if exists sa_grade on speaking_attempts;
create policy sa_grade on speaking_attempts for update to authenticated
  using (public.can_grade_student(student_id)) with check (public.can_grade_student(student_id));
-- Qayta topshirishga ruxsat berish uchun urinishni o'chirish — rahbar va administrator
drop policy if exists sa_delete on speaking_attempts;
create policy sa_delete on speaking_attempts for delete to authenticated
  using (public.has_role('owner', 'admin'));

drop policy if exists sans_read on speaking_answers;
create policy sans_read on speaking_answers for select to authenticated
  using (exists (select 1 from speaking_attempts a where a.id = attempt_id
                 and ((a.student_id = public.my_student() and public.has_role('student')) or public.can_grade_student(a.student_id))));
-- O'quvchi o'z javobini yuklaydi (baholanmaguncha; internet kech qaytsa ham)
drop policy if exists sans_insert on speaking_answers;
create policy sans_insert on speaking_answers for insert to authenticated
  with check (exists (select 1 from speaking_attempts a where a.id = attempt_id and a.student_id = public.my_student()
                      and public.has_role('student') and a.status <> 'graded'));
drop policy if exists sans_update on speaking_answers;
create policy sans_update on speaking_answers for update to authenticated
  using (exists (select 1 from speaking_attempts a where a.id = attempt_id and a.student_id = public.my_student()
                 and public.has_role('student') and a.status <> 'graded'))
  with check (exists (select 1 from speaking_attempts a where a.id = attempt_id and a.student_id = public.my_student()
                      and public.has_role('student') and a.status <> 'graded'));

-- Baholash maydonlarini o'quvchi o'zgartira olmaydi; baholovchi va vaqt avtomatik yoziladi
create or replace function public.speaking_grade_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'graded' and (old.status is distinct from 'graded' or new.scores is distinct from old.scores
     or new.total is distinct from old.total or new.comment is distinct from old.comment or new.level is distinct from old.level) then
    new.graded_by := coalesce(auth.uid(), new.graded_by);
    new.graded_at := now();
  end if;
  return new;
end $$;
revoke all on function public.speaking_grade_guard() from public, anon, authenticated;
drop trigger if exists speaking_attempts_grade on speaking_attempts;
create trigger speaking_attempts_grade before update on speaking_attempts for each row execute function public.speaking_grade_guard();

-- 5) O'quvchi RPC'lari ───────────────────────────────────────────────────────
/** Imtihonni boshlash: har variant 1 marta. Tugallanmagan urinish bo'lsa — o'shani qaytaradi (davom ettirish). */
create or replace function public.speaking_start(p_variant uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student(); a record; new_id uuid;
begin
  if sid is null or not public.has_role('student') then raise exception 'forbidden'; end if;
  if not exists (select 1 from speaking_variants where id = p_variant and status = 'published') then
    raise exception 'variant_not_available';
  end if;
  select * into a from speaking_attempts where variant_id = p_variant and student_id = sid;
  if found then
    if a.status = 'in_progress' then return a.id; end if;
    raise exception 'already_taken';
  end if;
  insert into speaking_attempts (variant_id, student_id) values (p_variant, sid) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.speaking_start(uuid) from public, anon;
grant execute on function public.speaking_start(uuid) to authenticated;

/** Imtihon jarayonini saqlash (qaysi savol, qaysi bosqich) — sahifa yangilansa davom etish uchun */
create or replace function public.speaking_progress(p_attempt uuid, p_progress jsonb) returns void
language sql security definer set search_path = public as $$
  update speaking_attempts set progress = coalesce(p_progress, '{}')
  where id = p_attempt and student_id = public.my_student() and public.has_role('student') and status = 'in_progress'
$$;
revoke all on function public.speaking_progress(uuid, jsonb) from public, anon;
grant execute on function public.speaking_progress(uuid, jsonb) to authenticated;

/** Imtihonni yakunlash */
create or replace function public.speaking_submit(p_attempt uuid) returns void
language sql security definer set search_path = public as $$
  update speaking_attempts set status = 'submitted', submitted_at = now()
  where id = p_attempt and student_id = public.my_student() and public.has_role('student') and status = 'in_progress'
$$;
revoke all on function public.speaking_submit(uuid) from public, anon;
grant execute on function public.speaking_submit(uuid) to authenticated;

-- 6) Baholanganda Telegram xabari (o'quvchi va ota-onaga, bot ulangan bo'lsa) ──
create or replace function public.speaking_notify_graded() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; vt text; msg text;
begin
  if new.status = 'graded' and old.status is distinct from 'graded' then
    select full_name, telegram_chat_id, parent_telegram_chat_id into s from students where id = new.student_id;
    select title into vt from speaking_variants where id = new.variant_id;
    msg := 'Lola Edu: ' || coalesce(s.full_name, '') || ' — gapirish imtihoni baholandi (' || coalesce(vt, '') || '). Ball: '
           || coalesce(trim(to_char(new.total, 'FM9999990.##')), '—') || coalesce(', daraja: ' || nullif(new.level, ''), '')
           || '. Batafsil ilovada: «Gapirish imtihoni» → «Natijalarim».';
    if s.telegram_chat_id is not null then
      insert into messages (channel, recipient, recipient_name, text) values ('telegram', s.telegram_chat_id, s.full_name, msg);
    end if;
    if s.parent_telegram_chat_id is not null and s.parent_telegram_chat_id is distinct from s.telegram_chat_id then
      insert into messages (channel, recipient, recipient_name, text) values ('telegram', s.parent_telegram_chat_id, s.full_name, msg);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.speaking_notify_graded() from public, anon, authenticated;
drop trigger if exists speaking_attempts_notify on speaking_attempts;
create trigger speaking_attempts_notify after update on speaking_attempts for each row execute function public.speaking_notify_graded();

-- 7) Yopiq omborlar ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speaking-media', 'speaking-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speaking-answers', 'speaking-answers', false, 20971520,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'video/webm', 'video/mp4'])
on conflict (id) do nothing;

-- Savol materiallari: xodimlar har doim; o'quvchi — faqat shu variant bo'yicha boshlangan urinishi bo'lsa (oldindan ko'rib bo'lmaydi)
drop policy if exists speaking_media_read on storage.objects;
create policy speaking_media_read on storage.objects for select to authenticated
  using (bucket_id = 'speaking-media' and (
    public.is_staff() or exists (
      select 1 from public.speaking_attempts a
      where a.variant_id::text = (storage.foldername(name))[1] and a.student_id = public.my_student()
        and public.has_role('student') and a.status = 'in_progress')));
drop policy if exists speaking_media_write on storage.objects;
create policy speaking_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'speaking-media' and public.can_edit_speaking());
drop policy if exists speaking_media_update on storage.objects;
create policy speaking_media_update on storage.objects for update to authenticated
  using (bucket_id = 'speaking-media' and public.can_edit_speaking()) with check (bucket_id = 'speaking-media' and public.can_edit_speaking());
drop policy if exists speaking_media_delete on storage.objects;
create policy speaking_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'speaking-media' and public.can_edit_speaking());

-- O'quvchi ovozlari: yo'l = <urinish_id>/<savol_id>.<ext>. Yozish — faqat egasi (baholanmaguncha); eshitish — faqat baholovchi
drop policy if exists speaking_answers_insert on storage.objects;
create policy speaking_answers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'speaking-answers' and exists (
    select 1 from public.speaking_attempts a where a.id::text = (storage.foldername(name))[1]
      and a.student_id = public.my_student() and public.has_role('student') and a.status <> 'graded'));
drop policy if exists speaking_answers_update on storage.objects;
create policy speaking_answers_update on storage.objects for update to authenticated
  using (bucket_id = 'speaking-answers' and exists (
    select 1 from public.speaking_attempts a where a.id::text = (storage.foldername(name))[1]
      and a.student_id = public.my_student() and public.has_role('student') and a.status <> 'graded'))
  with check (bucket_id = 'speaking-answers');
drop policy if exists speaking_answers_read on storage.objects;
create policy speaking_answers_read on storage.objects for select to authenticated
  using (bucket_id = 'speaking-answers' and exists (
    select 1 from public.speaking_attempts a where a.id::text = (storage.foldername(name))[1] and public.can_grade_student(a.student_id)));
drop policy if exists speaking_answers_delete on storage.objects;
create policy speaking_answers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'speaking-answers' and public.has_role('owner', 'admin'));

-- 8) Sozlamalar: bo'lim yo'riqnomalari (PDF'dan), mezonlar (rahbar kiritadi), ovozlarni saqlash muddati ──
insert into settings (key, value) values ('speaking', jsonb_build_object(
  'criteria', '[]'::jsonb,
  'levels', '[]'::jsonb,
  'retention_days_after_grading', 5,
  'intros', jsonb_build_object(
    '1.1', 'Birinci bölüm iki kısımdan oluşmaktadır. Önce size kendiniz ve ilgi alanlarınız hakkında üç kısa soru sorulacaktır. Ardından iki resim gösterilecek ve onlara ilişkin daha üç soru sorulacaktır. İşaret sesi olarak zil sesini duyduktan sonra konuşmaya başlayabilirsiniz.',
    '1.2', 'Bu bölümde iki resim gösterilecek ve onlara ilişkin üç soru sorulacaktır. İşaret sesi olarak zil sesini duyduktan sonra konuşmaya başlayabilirsiniz.',
    '2', 'Bu bölümde size bir resim gösterilecek ve üç soru sorulacaktır. Konuşmaya başlamadan önce hazırlanmanız için bir dakikanız olacaktır. Verilen üç soruyu cevaplamanız için iki dakikanız var. İşaret sesi olarak zil sesini duyduktan sonra konuşmaya başlayabilirsiniz.',
    '3', 'Bu bölümde belirli bir konu hakkında iki dakikalık bir konuşma yapmanız gerekmektedir. Ekranda konu ve bu konunun lehinde ve aleyhinde listelenmiş maddeler tablo şeklinde gösterilecektir. Her bir listeden iki madde seçerek konunun her iki tarafını da temsil eden dengeli bir argüman oluşturmalısınız. Argümanınızı hazırlamak için bir dakikanız olacaktır. Ardından iki dakikalık konuşmanızı gerçekleştireceksiniz. İşaret sesi olarak zil sesini duyduktan sonra konuşmaya başlayabilirsiniz.')))
on conflict (key) do nothing;

-- 9) Bir martalik import kaliti (faqat server; import tugagach o'chiriladi) ──
create or replace function public.check_app_secret(p_key text, p_value text) returns boolean
language sql stable security definer set search_path = private, public as $$
  select p_value is not null and length(p_value) >= 32
     and exists (select 1 from private.app_secrets where key = p_key and value = p_value)
$$;
revoke all on function public.check_app_secret(text, text) from public, anon, authenticated;
grant execute on function public.check_app_secret(text, text) to service_role;

-- 10) Baholangandan 5 kun o'tgan ovozlarni o'chirish — har kuni (speaking-admin funksiyasi)
select cron.schedule('lola-speaking-cleanup', '30 22 * * *', $$ select private.call_function('speaking-admin', '{"action":"cleanup"}'::jsonb) $$);
