-- ════════════════════════════════════════════════════════════════════════════
-- Oylik summani tahrirlash: o'quvchining shaxsiy oylik narxi va summani o'zgartirish huquqi.
-- Narx tartibi: o'quvchining shaxsiy narxi → guruh narxi → kurs narxi; so'ng chegirma.
-- (src/lib/finance.ts: chargeForMonth bilan bir xil)
-- ════════════════════════════════════════════════════════════════════════════

alter table enrollments add column if not exists monthly_price numeric(14, 2) check (monthly_price >= 0);
comment on column enrollments.monthly_price is 'O''quvchining shaxsiy oylik narxi. Bo''sh — guruh yoki kurs narxi';

create or replace function public.generate_monthly_charges(p_month text default to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM'))
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
  due int := coalesce((select (value->>'payment_due_day')::int from settings where key = 'center'), 10);
begin
  if auth.uid() is not null and not public.has_role('owner', 'admin', 'manager', 'accountant') then
    raise exception 'forbidden';
  end if;
  with calc as (
    select e.student_id, e.group_id, e.start_date,
      coalesce(e.payment_day, g.payment_day, due) as pay_day,
      coalesce(e.monthly_price, nullif(g.monthly_price, 0), c.monthly_price) as price,
      public.lesson_days(g.days, p_month, null, null) as total,
      public.lesson_days(g.days, p_month, greatest(g.start_date, e.start_date), least(g.end_date, e.end_date)) as mine,
      coalesce(e.discount_percent, 0) as dp, coalesce(e.discount_amount, 0) as da
    from enrollments e
    join groups g on g.id = e.group_id and g.status = 'active'
    join courses c on c.id = g.course_id
    where e.status in ('active', 'left', 'finished')
  ), amounts as (
    select student_id, group_id, start_date, pay_day, round(price * mine / nullif(total, 0)) as base, dp, da
    from calc where mine > 0 and total > 0
  )
  insert into charges (student_id, group_id, month, amount, discount, due_date)
  select student_id, group_id, p_month,
    round(greatest(0, base * (1 - dp / 100) - da) / 1000) * 1000,
    base - greatest(0, base * (1 - dp / 100) - da),
    public.due_date_for(p_month, pay_day, start_date)
  from amounts
  where greatest(0, base * (1 - dp / 100) - da) > 0
  on conflict (student_id, group_id, month) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Summani faqat rahbar, administrator, filial menejeri va buxgalter o'zgartiradi.
-- Qabulxona yangi o'quvchini yozib, birinchi hisobni yarata oladi, lekin keyin summani o'zgartira olmaydi.
create or replace function public.protect_charge_amount() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.amount is distinct from old.amount or new.discount is distinct from old.discount)
     and not public.has_role('owner', 'admin', 'manager', 'accountant') then
    raise exception 'Oylik summani faqat rahbar, administrator yoki buxgalter o''zgartira oladi';
  end if;
  return new;
end $$;
revoke all on function public.protect_charge_amount() from public, anon, authenticated;
create trigger charges_protect_amount before update on charges for each row execute function public.protect_charge_amount();

create or replace function public.protect_enrollment_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.monthly_price is distinct from old.monthly_price
          or new.discount_percent is distinct from old.discount_percent
          or new.discount_amount is distinct from old.discount_amount)
     and not public.has_role('owner', 'admin', 'manager', 'accountant') then
    raise exception 'Oylik narxni faqat rahbar, administrator yoki buxgalter o''zgartira oladi';
  end if;
  return new;
end $$;
revoke all on function public.protect_enrollment_price() from public, anon, authenticated;
create trigger enrollments_protect_price before update on enrollments for each row execute function public.protect_enrollment_price();
