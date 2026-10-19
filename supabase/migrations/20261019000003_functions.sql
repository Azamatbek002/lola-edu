-- ════════════════════════════════════════════════════════════════════════════
-- Biznes mantiq: oylik hisob-kitob, avtomatik xabarlar, audit
-- (src/lib/finance.ts dagi chargeForMonth bilan bir xil hisoblaydi)
-- ════════════════════════════════════════════════════════════════════════════

/** Guruhning oy ichidagi dars kunlari (from..to oralig'ida) */
create or replace function public.lesson_days(p_days int[], p_month text, p_from date, p_to date)
returns int language sql immutable as $$
  select count(*)::int
  from generate_series(to_date(p_month || '-01', 'YYYY-MM-DD'), (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date, interval '1 day') d
  where extract(isodow from d)::int = any(p_days)
    and (p_from is null or d::date >= p_from)
    and (p_to is null or d::date <= p_to)
$$;

/**
 * Tanlangan oy uchun barcha faol yozilishlarga to'lov hisoblaydi.
 * Oy o'rtasida qo'shilgan/ketganlar uchun proporsional, chegirmalar hisobga olinadi.
 * Takroriy chaqiruv xavfsiz (unique student+group+month).
 */
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
    select e.student_id, e.group_id,
      coalesce(nullif(g.monthly_price, 0), c.monthly_price) as price,
      public.lesson_days(g.days, p_month, null, null) as total,
      public.lesson_days(g.days, p_month, greatest(g.start_date, e.start_date), least(g.end_date, e.end_date)) as mine,
      coalesce(e.discount_percent, 0) as dp, coalesce(e.discount_amount, 0) as da
    from enrollments e
    join groups g on g.id = e.group_id and g.status = 'active'
    join courses c on c.id = g.course_id
    where e.status in ('active', 'left', 'finished')
  ), amounts as (
    select student_id, group_id, round(price * mine / nullif(total, 0)) as base, dp, da
    from calc where mine > 0 and total > 0
  )
  insert into charges (student_id, group_id, month, amount, discount, due_date)
  select student_id, group_id, p_month,
    round(greatest(0, base * (1 - dp / 100) - da) / 1000) * 1000,
    base - greatest(0, base * (1 - dp / 100) - da),
    to_date(p_month || '-' || lpad(least(due, 28)::text, 2, '0'), 'YYYY-MM-DD')
  from amounts
  where greatest(0, base * (1 - dp / 100) - da) > 0
  on conflict (student_id, group_id, month) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

/** O'quvchi balansi (to'lovlar − hisoblanganlar) */
create or replace view public.student_balances with (security_invoker = true) as
select s.id as student_id, s.full_name, s.branch_id,
  coalesce((select sum(amount) from payments p where p.student_id = s.id and p.status = 'completed'), 0)
  - coalesce((select sum(amount) from charges c where c.student_id = s.id), 0) as balance
from students s;

/** Shablonni to'ldirish: {name}, {amount} ... */
create or replace function public.fill_template(p_text text, p_vars jsonb) returns text
language plpgsql immutable as $$
declare k text; v text; r text := p_text;
begin
  for k, v in select * from jsonb_each_text(p_vars) loop
    r := replace(r, '{' || k || '}', coalesce(v, ''));
  end loop;
  return r;
end $$;

/** Avtomatik xabarni navbatga qo'yish (shablon faol bo'lsa) */
create or replace function public.queue_trigger(p_trigger text, p_phone text, p_chat text, p_name text, p_vars jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare tpl text;
begin
  select text into tpl from message_templates where trigger = p_trigger and is_active limit 1;
  if tpl is null or (p_phone is null and p_chat is null) then return; end if;
  insert into messages (channel, recipient, recipient_name, text)
  values (case when p_chat is not null then 'telegram' else 'sms' end, coalesce(p_chat, p_phone), p_name,
          public.fill_template(tpl, p_vars || jsonb_build_object('name', p_name)));
end $$;

/** Kunlik avtomatik ishlar: hisoblash (oyning 1-kuni), qarz eslatmasi, tug'ilgan kun, sinov darsi eslatmasi */
create or replace function public.run_daily_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Tashkent')::date;
  cfg jsonb := coalesce((select value from settings where key = 'center'), '{}');
  due int := coalesce((cfg->>'payment_due_day')::int, 10);
  charged int := 0; reminded int := 0; bdays int := 0; trials int := 0;
  r record;
begin
  if extract(day from today) = 1 then
    charged := public.generate_monthly_charges(to_char(today, 'YYYY-MM'));
  end if;

  -- Qarz eslatmasi: to'lov muddatidan keyingi kun va har 7 kunda
  if coalesce((cfg->>'debt_alert')::boolean, true) and extract(day from today) >= due + 1 and (extract(day from today) - due - 1)::int % 7 = 0 then
    for r in select s.*, b.balance from student_balances b join students s on s.id = b.student_id
             where b.balance < 0 and s.status in ('active', 'frozen') loop
      perform public.queue_trigger('debt_reminder', coalesce(r.parent_phone, r.phone), coalesce(r.parent_telegram_chat_id, r.telegram_chat_id), r.full_name,
        jsonb_build_object('amount', to_char(-r.balance, 'FM999G999G999') || ' so''m', 'month', to_char(today, 'MM.YYYY')));
      reminded := reminded + 1;
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

  return jsonb_build_object('charged', charged, 'debt_reminders', reminded, 'birthdays', bdays, 'trial_reminders', trials);
end $$;
revoke all on function public.run_daily_jobs() from public, anon, authenticated;

-- ─── Triggerlar ─────────────────────────────────────────────────────────────

/** Onlayn to'lov kelganda xodimlarga bildirishnoma */
create or replace function public.on_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.branch_id is null then
    select branch_id into new.branch_id from students where id = new.student_id;
  end if;
  return new;
end $$;
create trigger payments_branch before insert on payments for each row execute function public.on_payment_insert();

/** Lid "won" bo'lganda konversiya bildirishnomasi */
create or replace function public.on_lead_won() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'won' and old.stage is distinct from 'won' then
    insert into notifications (roles, title, body, link)
    values (array['owner', 'manager', 'marketer'], 'Yangi o''quvchi: ' || new.full_name, new.source, '/leads');
  end if;
  return new;
end $$;
create trigger leads_won after update of stage on leads for each row execute function public.on_lead_won();
