-- ════════════════════════════════════════════════════════════════════════════
-- Xavfsizlikni kuchaytirish (Supabase Security Advisor tavsiyalari bo'yicha)
-- ════════════════════════════════════════════════════════════════════════════

-- Funksiyalar uchun qat'iy search_path
alter function public.has_role(variadic text[]) set search_path = public;
alter function public.is_staff() set search_path = public;
alter function public.sees_branch(uuid) set search_path = public;
alter function public.lesson_days(int[], text, date, date) set search_path = public;
alter function public.fill_template(text, jsonb) set search_path = public;

-- RLS yordamchilari faqat tizimga kirganlar uchun (anonim RPC orqali chaqira olmaydi)
do $$
declare f text;
begin
  foreach f in array array['my_role()', 'my_branch()', 'my_student()', 'teaches(uuid)', 'my_group(uuid)', 'has_role(variadic text[])', 'is_staff()', 'sees_branch(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Oylik hisob: anonim chaqira olmaydi, kirgan foydalanuvchi uchun funksiya ichida rol tekshiriladi
revoke all on function public.generate_monthly_charges(text) from public, anon;
grant execute on function public.generate_monthly_charges(text) to authenticated;

-- Faqat server (Edge Functions, service role) chaqiradi — aks holda begona odam SMS yubora oladi
revoke all on function public.queue_trigger(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.run_daily_jobs() from public, anon, authenticated;

-- Trigger funksiyalarini RPC orqali chaqirib bo'lmaydi
revoke all on function public.on_payment_insert() from public, anon, authenticated;
revoke all on function public.on_lead_won() from public, anon, authenticated;
revoke all on function public.protect_profile() from public, anon, authenticated;

revoke all on public.student_balances from anon;

-- Ataylab ochiq qoldirilganlar:
--  * submit_lead — /apply ochiq ariza formasi (telefon bo'yicha soatiga 1 ta cheklov bilan)
--  * email_by_phone — telefon raqami bilan kirish uchun
--  * staff_directory (security definer view) — portal o'qituvchi ismini ko'radi, maosh ustunlari yo'q
