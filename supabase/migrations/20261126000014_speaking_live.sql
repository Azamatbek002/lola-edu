-- Gapirish imtihoni — ishga tushirish (egasining qarorlari, 2026-11-26):
--  • o'quvchi kuniga 1 marta imtihon topshiradi (Toshkent vaqti bo'yicha);
--  • topshirilgan imtihon ovozlari rahbarga Telegram bot orqali yuboriladi (speaking-admin → notify, har 2 daqiqada);
--  • baholangach o'quvchi (va ota-ona) Telegram'da mezonlar bo'yicha ball, daraja va ustoz izohini oladi.
-- Qo'shimcha o'zgarishlar: yangi ustun, funksiyalar yangilanadi, cron qo'shiladi. Ma'lumot o'chirilmaydi.

alter table speaking_attempts add column if not exists owner_notified_at timestamptz;
comment on column speaking_attempts.owner_notified_at is 'Ovozlar rahbarga Telegram orqali yuborilgan vaqt';

-- 1) Kuniga bitta imtihon
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
  if exists (select 1 from speaking_attempts
             where student_id = sid and status <> 'in_progress'
               and (started_at at time zone 'Asia/Tashkent')::date = (now() at time zone 'Asia/Tashkent')::date) then
    raise exception 'daily_limit';
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

-- 2) Baholanganda batafsil Telegram xabari (o'quvchi va ota-ona, bot ulangan bo'lsa)
create or replace function public.speaking_notify_graded() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; vt text; msg text; c jsonb; lines text := ''; maxsum numeric := 0; chats text[]; ch text;
begin
  if new.status = 'graded' and old.status is distinct from 'graded' then
   begin -- xabar tayyorlashdagi har qanday xato baholashni to'xtatmasin
    select full_name, telegram_chat_id, parent_telegram_chat_id into s from students where id = new.student_id;
    select title into vt from speaking_variants where id = new.variant_id;
    for c in select * from jsonb_array_elements(coalesce((select value->'criteria' from settings where key = 'speaking'), '[]'::jsonb)) loop
      maxsum := maxsum + coalesce((c->>'max')::numeric, 0);
      if coalesce(new.scores, '{}'::jsonb) ? (c->>'id') and (new.scores->>(c->>'id')) ~ '^[0-9]+(\.[0-9]+)?$' then
        lines := lines || E'\n• ' || (c->>'name') || ': '
              || rtrim(to_char((new.scores->>(c->>'id'))::numeric, 'FM9999990.99'), '.') || '/' || (c->>'max');
      end if;
    end loop;
    msg := '🎙 Lola Edu — gapirish imtihoni natijasi' || E'\n' || coalesce(s.full_name, '') || ' · ' || coalesce(vt, '')
        || E'\n\nBall: ' || coalesce(rtrim(to_char(new.total, 'FM9999990.99'), '.'), '—')
        || case when maxsum > 0 then ' / ' || rtrim(to_char(maxsum, 'FM9999990.99'), '.') else '' end
        || coalesce(' · Daraja: ' || nullif(new.level, ''), '')
        || lines
        || coalesce(E'\n\nUstoz izohi: ' || nullif(trim(new.comment), ''), '')
        || E'\n\nBatafsil: ilovada «Gapirish imtihoni» → «Natijalarim».';
    -- O'quvchi va ota-ona: telefon orqali (students) yoki ilova profilidagi tugma orqali (profiles) ulangan Telegram
    select array_agg(distinct x) into chats from (
      select s.telegram_chat_id as x
      union all select s.parent_telegram_chat_id
      union all select p.telegram_chat_id from profiles p
        where p.student_id = new.student_id and p.is_active and p.role in ('student', 'parent')
    ) q where x is not null and x <> '';
    foreach ch in array coalesce(chats, '{}'::text[]) loop
      insert into messages (channel, recipient, recipient_name, text) values ('telegram', ch, s.full_name, msg);
    end loop;
   exception when others then
    raise warning 'speaking_notify_graded: %', sqlerrm;
   end;
  end if;
  return new;
end $$;
revoke all on function public.speaking_notify_graded() from public, anon, authenticated;

-- 3) Rahbarga ovozlarni yuborish navbati (javoblar yuklangach yoki 30 daqiqa o'tgach)
select cron.schedule('lola-speaking-notify', '*/2 * * * *', $$ select private.call_function('speaking-admin', '{"action":"notify"}'::jsonb) $$);
