-- Gapirish imtihoni: egasining qarorlari (2026-11-26)
--  • O'quvchi barcha variantlarning savollarini ko'rib tayyorlanadi; imtihonda variant tasodifiy tushadi,
--    topshirishlar soni cheklanmaydi (bir variant qayta tushishi ham mumkin).
--  • Baholash: 4 mezon × 25 ball = 100 ball. Ovozlar baholangandan 2 kun keyin o'chiriladi.
-- Ma'lumot o'chirilmaydi: faqat cheklov olib tashlanadi, ruxsatlar kengaytiriladi, yangi funksiya qo'shiladi.

-- 1) Bir variantni qayta topshirish mumkin; bir vaqtda faqat bitta tugallanmagan imtihon
alter table speaking_attempts drop constraint if exists speaking_attempts_variant_id_student_id_key;
comment on table speaking_attempts is 'Gapirish imtihoni urinishlari: variant tasodifiy tanlanadi, soni cheklanmaydi';
create unique index if not exists speaking_attempts_one_open on speaking_attempts(student_id) where status = 'in_progress';
create index if not exists speaking_attempts_student_idx on speaking_attempts(student_id, started_at desc);

-- 2) Savollar va rasmlar: o'quvchi (va ota-ona) e'lon qilingan barcha variantlarni ko'radi
drop policy if exists si_read on speaking_items;
create policy si_read on speaking_items for select to authenticated
  using (public.is_staff()
    or (public.my_student() is not null and exists (
          select 1 from speaking_variants v where v.id = speaking_items.variant_id and v.status = 'published'))
    or exists (
          select 1 from speaking_attempts a
          where a.variant_id = speaking_items.variant_id and a.student_id = public.my_student()
            and public.has_role('student') and a.status = 'in_progress'));

drop policy if exists speaking_media_read on storage.objects;
create policy speaking_media_read on storage.objects for select to authenticated
  using (bucket_id = 'speaking-media' and (
    public.is_staff()
    or (public.my_student() is not null and exists (
          select 1 from public.speaking_variants v
          where v.id::text = (storage.foldername(name))[1] and v.status = 'published'))
    or exists (
          select 1 from public.speaking_attempts a
          where a.variant_id::text = (storage.foldername(name))[1] and a.student_id = public.my_student()
            and public.has_role('student') and a.status = 'in_progress')));

-- 3) Imtihonni boshlash: variant tasodifiy tanlanadi. Tugallanmagan imtihon bo'lsa — o'sha davom etadi;
--    u 1 soatdan eski bo'lsa (imtihon ~12 daqiqa), yakunlangan deb hisoblanadi va yangisi boshlanadi.
create or replace function public.speaking_start_random() returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student(); a record; v uuid; new_id uuid;
begin
  if sid is null or not public.has_role('student') then raise exception 'forbidden'; end if;
  select * into a from speaking_attempts where student_id = sid and status = 'in_progress' order by started_at desc limit 1;
  if found then
    if a.started_at > now() - interval '1 hour' then return a.id; end if;
    update speaking_attempts set status = 'submitted', submitted_at = now() where id = a.id;
  end if;
  select id into v from speaking_variants
  where status = 'published' and exists (select 1 from speaking_items i where i.variant_id = speaking_variants.id)
  order by random() limit 1;
  if v is null then raise exception 'variant_not_available'; end if;
  insert into speaking_attempts (variant_id, student_id) values (v, sid) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.speaking_start_random() from public, anon;
grant execute on function public.speaking_start_random() to authenticated;

-- O'quvchi variantni o'zi tanlab boshlay olmaydi (faqat tasodifiy)
revoke execute on function public.speaking_start(uuid) from authenticated;

-- 4) Mezonlar (rahbar hali kiritmagan bo'lsa) va ovozlarni saqlash muddati
update settings set value = value
  || jsonb_build_object('criteria', jsonb_build_array(
       jsonb_build_object('id', 'fluency', 'name', 'Ravonlik', 'max', 25),
       jsonb_build_object('id', 'coherence', 'name', 'Izchillik va bog''lanish', 'max', 25),
       jsonb_build_object('id', 'vocabulary', 'name', 'Lug''at boyligi', 'max', 25),
       jsonb_build_object('id', 'grammar', 'name', 'Grammatika (xilma-xillik va aniqlik)', 'max', 25)))
  || jsonb_build_object('levels', jsonb_build_array(
       jsonb_build_object('name', 'B1', 'min', 51),
       jsonb_build_object('name', 'B2', 'min', 68),
       jsonb_build_object('name', 'C1', 'min', 87)))
where key = 'speaking' and coalesce(jsonb_array_length(value->'criteria'), 0) = 0;

update settings set value = jsonb_set(value, '{retention_days_after_grading}', '2'::jsonb)
where key = 'speaking' and coalesce((value->>'retention_days_after_grading')::int, 5) = 5;
