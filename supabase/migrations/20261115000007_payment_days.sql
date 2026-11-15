-- ════════════════════════════════════════════════════════════════════════════
-- To'lov kunlari: har bir guruh (yoki o'quvchi) har oy o'z kunida to'laydi.
-- Muddat o'tguncha hisob "kutilmoqda", o'tgach to'lanmagan qismi "muddati o'tgan".
-- (src/lib/finance.ts: paymentDayFor, dueDateFor, allocateCharges bilan bir xil)
-- ════════════════════════════════════════════════════════════════════════════

alter table groups add column if not exists payment_day smallint check (payment_day between 1 and 31);
alter table enrollments add column if not exists payment_day smallint check (payment_day between 1 and 31);
comment on column groups.payment_day is 'Har oygi to''lov kuni (1–31). Bo''sh — markaz sozlamasi';
comment on column enrollments.payment_day is 'O''quvchining shaxsiy to''lov kuni. Bo''sh — guruh kuni';

-- Yangi eslatma turi: "ertaga to'lov kuni"
alter table message_templates drop constraint if exists message_templates_trigger_check;
alter table message_templates add constraint message_templates_trigger_check
  check (trigger in ('manual', 'debt_reminder', 'absence', 'birthday', 'lesson_reminder', 'payment_received', 'welcome', 'trial_reminder', 'payment_due'));
insert into message_templates (name, trigger, text)
select 'To''lov kuni eslatmasi', 'payment_due',
  'Assalomu alaykum! {name}: oylik to''lov muddati — ertaga, {date}. Summa: {amount}. Lola Edu Türk Dili Markazi'
where not exists (select 1 from message_templates where trigger = 'payment_due');

/** Oy uchun to'lov sanasi: oyda bunday kun bo'lmasa — oxirgi kun; qo'shilgan kundan oldin bo'lmaydi */
create or replace function public.due_date_for(p_month text, p_day int, p_start date default null)
returns date language sql immutable set search_path = public as $$
  select greatest(
    make_date(
      split_part(p_month, '-', 1)::int,
      split_part(p_month, '-', 2)::int,
      least(greatest(coalesce(p_day, 10), 1),
            extract(day from (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day'))::int)),
    coalesce(p_start, '-infinity'::date))
$$;

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
      coalesce(nullif(g.monthly_price, 0), c.monthly_price) as price,
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

/**
 * Har bir hisobning holati. To'lovlar eng eski muddatdan boshlab taqsimlanadi:
 * guruh ko'rsatilgan to'lov avval o'sha guruhga, guruhsiz to'lov va ortiqchasi — qolganlariga.
 * state: paid | upcoming (muddat oldinda) | today (bugun) | overdue (muddati o'tgan)
 */
create or replace view public.charge_status with (security_invoker = true) as
with ch as (
  select c.id, c.student_id, c.group_id, c.month, c.amount, c.due_date,
    coalesce(sum(c.amount) over (partition by c.student_id, c.group_id order by c.due_date, c.month, c.id
                                 rows between unbounded preceding and 1 preceding), 0) as g_before
  from charges c
), pay as (
  select p.student_id, p.amount,
    case when p.group_id is not null
          and exists (select 1 from charges x where x.student_id = p.student_id and x.group_id = p.group_id)
         then p.group_id end as group_id
  from payments p where p.status = 'completed'
), gp as (
  select student_id, group_id, sum(amount) as paid from pay where group_id is not null group by 1, 2
), gt as (
  select student_id, group_id, sum(amount) as total from charges group by 1, 2
), pool as (
  select student_id, sum(amt) as amt from (
    select student_id, amount as amt from pay where group_id is null
    union all
    select gp.student_id, greatest(0, gp.paid - gt.total) from gp join gt on gt.student_id = gp.student_id and gt.group_id = gp.group_id
  ) z group by 1
), s1 as (
  select ch.*, least(ch.amount, greatest(0, coalesce(gp.paid, 0) - ch.g_before)) as paid1
  from ch left join gp on gp.student_id = ch.student_id and gp.group_id = ch.group_id
), s2 as (
  select s1.*,
    coalesce(sum(s1.amount - s1.paid1) over (partition by s1.student_id order by s1.due_date, s1.month, s1.id
                                            rows between unbounded preceding and 1 preceding), 0) as rem_before
  from s1
), s3 as (
  select s2.id, s2.student_id, s2.group_id, s2.month, s2.amount, s2.due_date,
    s2.paid1 + least(s2.amount - s2.paid1, greatest(0, coalesce(pool.amt, 0) - s2.rem_before)) as paid
  from s2 left join pool on pool.student_id = s2.student_id
)
select id as charge_id, student_id, group_id, month, amount, due_date, paid,
  amount - paid as remaining,
  case when amount - paid <= 0 then 'paid'
       when due_date > (now() at time zone 'Asia/Tashkent')::date then 'upcoming'
       when due_date = (now() at time zone 'Asia/Tashkent')::date then 'today'
       else 'overdue' end as state
from s3;
revoke all on public.charge_status from anon, authenticated, service_role;
grant select on public.charge_status to authenticated, service_role;
revoke all on function public.due_date_for(text, int, date) from anon;

/** Kunlik ishlar: endi qarz eslatmasi har bir o'quvchining o'z muddatiga qarab yuboriladi */
create or replace function public.run_daily_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tashkent')::date;
  cfg jsonb := coalesce((select value from settings where key = 'center'), '{}');
  charged int := 0; reminded int := 0; due_soon int := 0; bdays int := 0; trials int := 0;
  r record;
begin
  if extract(day from today) = 1 then
    charged := public.generate_monthly_charges(to_char(today, 'YYYY-MM'));
  end if;

  if coalesce((cfg->>'debt_alert')::boolean, true) then
    -- Muddati o'tgan: muddatdan keyingi kuni va keyin har 7 kunda
    for r in
      select s.*, x.debt, x.months from (
        select student_id, sum(remaining) as debt,
          string_agg(distinct to_char(to_date(month || '-01', 'YYYY-MM-DD'), 'MM.YYYY'), ', ') as months
        from charge_status where state = 'overdue'
        group by student_id
        having bool_or((today - due_date - 1) % 7 = 0)
      ) x join students s on s.id = x.student_id
      where s.status in ('active', 'frozen')
    loop
      perform public.queue_trigger('debt_reminder', coalesce(r.parent_phone, r.phone), coalesce(r.parent_telegram_chat_id, r.telegram_chat_id), r.full_name,
        jsonb_build_object('amount', to_char(r.debt, 'FM999G999G999') || ' so''m', 'month', r.months));
      reminded := reminded + 1;
    end loop;

    -- Ertaga to'lov kuni
    for r in
      select s.*, x.amt, x.due from (
        select student_id, sum(remaining) as amt, min(due_date) as due
        from charge_status where state = 'upcoming' and due_date = today + 1
        group by student_id
      ) x join students s on s.id = x.student_id
      where s.status = 'active'
    loop
      perform public.queue_trigger('payment_due', coalesce(r.parent_phone, r.phone), coalesce(r.parent_telegram_chat_id, r.telegram_chat_id), r.full_name,
        jsonb_build_object('amount', to_char(r.amt, 'FM999G999G999') || ' so''m', 'date', to_char(r.due, 'DD.MM.YYYY')));
      due_soon := due_soon + 1;
    end loop;
  end if;

  for r in select * from students where status = 'active' and birth_date is not null
           and extract(month from birth_date) = extract(month from today) and extract(day from birth_date) = extract(day from today) loop
    perform public.queue_trigger('birthday', r.phone, r.telegram_chat_id, r.full_name, '{}');
    bdays := bdays + 1;
  end loop;

  for r in select l.*, g.start_time from leads l left join groups g on g.id = l.trial_group_id
           where l.stage = 'trial_scheduled' and l.trial_date = today + 1 loop
    perform public.queue_trigger('trial_reminder', r.phone, null, r.full_name,
      jsonb_build_object('date', to_char(r.trial_date, 'DD.MM.YYYY'), 'time', coalesce(r.start_time, '')));
    trials := trials + 1;
  end loop;

  return jsonb_build_object('charged', charged, 'debt_reminders', reminded, 'due_reminders', due_soon, 'birthdays', bdays, 'trial_reminders', trials);
end $$;
revoke all on function public.run_daily_jobs() from public, anon, authenticated;

-- Mavjud ma'lumotdan to'lov kunlarini tiklash:
-- guruh kuni — hisoblarda eng ko'p uchragan kun; farq qiladigan o'quvchilarga — shaxsiy kun.
with d as (
  select group_id, extract(day from due_date)::int as day, count(*) as n from charges group by 1, 2
), best as (
  select distinct on (group_id) group_id, day from d order by group_id, n desc, day
)
update groups g set payment_day = best.day from best where best.group_id = g.id and g.payment_day is null;

update enrollments e set payment_day = extract(day from c.due_date)::int
from charges c, groups g
where c.student_id = e.student_id and c.group_id = e.group_id and g.id = e.group_id
  and e.payment_day is null and g.payment_day is not null
  and extract(day from c.due_date)::int <> g.payment_day;
