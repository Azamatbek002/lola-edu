-- ════════════════════════════════════════════════════════════════════════════
-- Avtomatik ishlar (pg_cron + pg_net):
--   * har daqiqada — navbatdagi SMS/Telegram xabarlarni yuborish (faqat navbat bo'sh bo'lmasa)
--   * har kuni 09:00 (Toshkent) — oylik hisob (1-kuni), qarz eslatmalari, tug'ilgan kunlar, sinov darsi eslatmalari
-- Cron maxfiy kaliti bazada saqlanadi (private sxemasi API orqali ko'rinmaydi) — qo'lda kiritish shart emas.
-- ════════════════════════════════════════════════════════════════════════════
create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
insert into private.app_secrets (key, value)
values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

/** Edge Function'lar cron chaqiruvini tekshiradi (faqat service role) */
create or replace function public.check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from private.app_secrets where key = 'cron' and value = p_secret)
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

/** Edge Function'ni cron kaliti bilan chaqirish */
create or replace function private.call_function(p_name text) returns bigint
language sql security definer set search_path = private, public as $$
  select net.http_post(
    url := 'https://vowncclaomnzxbadedkm.supabase.co/functions/v1/' || p_name,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from private.app_secrets where key = 'cron'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$;
revoke all on function private.call_function(text) from public, anon, authenticated;

select cron.schedule('lola-send-messages', '* * * * *',
  $$ select private.call_function('send-messages') where exists (select 1 from public.messages where status = 'queued') $$);

-- 04:00 UTC = 09:00 Toshkent
select cron.schedule('lola-daily-jobs', '0 4 * * *', $$ select private.call_function('daily-jobs') $$);
