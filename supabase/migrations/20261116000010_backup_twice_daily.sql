-- ════════════════════════════════════════════════════════════════════════════
-- Zaxira kuniga 2 marta: 02:00 va 14:00 (Toshkent).
-- Har bir yangilanishdan oldin ham zaxira olinadi:
--   select private.call_function('backup', '{"reason":"yangilanish"}'::jsonb);
-- ════════════════════════════════════════════════════════════════════════════

/** Edge Function'ni cron kaliti va so'rov tanasi bilan chaqirish (zaxira uchun 2 daqiqa kutadi) */
create or replace function private.call_function(p_name text, p_body jsonb) returns bigint
language sql security definer set search_path = private, public as $$
  select net.http_post(
    url := 'https://vowncclaomnzxbadedkm.supabase.co/functions/v1/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from private.app_secrets where key = 'cron'), 'Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  )
$$;
revoke all on function private.call_function(text, jsonb) from public, anon, authenticated;

-- 21:00 va 09:00 UTC = 02:00 va 14:00 Toshkent (nomi bir xil — mavjud jadval yangilanadi)
select cron.schedule('lola-backup', '0 9,21 * * *', $$ select private.call_function('backup', '{"reason":"kunlik"}'::jsonb) $$);
