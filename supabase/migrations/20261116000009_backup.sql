-- ════════════════════════════════════════════════════════════════════════════
-- Kunlik zaxira nusxa: Edge Function 'backup' har kecha 02:00 (Toshkent) da barcha
-- jadvallarni parolli ZIP'ga yig'adi, 'backups' omboriga saqlaydi (oxirgi 30 ta)
-- va rahbarning Telegram'iga yuboradi.
-- ════════════════════════════════════════════════════════════════════════════

-- Yopiq ombor: faqat server (service role) ko'radi, hech qanday ochiq siyosat yo'q
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/zip'])
on conflict (id) do nothing;

-- 21:00 UTC = 02:00 Toshkent
select cron.schedule('lola-backup', '0 21 * * *', $$ select private.call_function('backup') $$);
