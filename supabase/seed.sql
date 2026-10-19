-- Boshlang'ich ma'lumotlar (yangi bazaga bir marta ishga tushiriladi)
insert into settings (key, value) values
  ('center', '{"name":"Lola Edu Türk Dili Markazi","payment_due_day":10,"absence_alert":true,"debt_alert":true}')
on conflict (key) do nothing;

insert into branches (name, address, is_active) values ('Lola Edu — Asosiy filial', 'Toshkent', true);

insert into courses (name, level, duration_months, lessons_per_week, lesson_minutes, monthly_price, color, description) values
  ('Türkçe A1 — Boshlang‘ich', 'A1', 2, 3, 90, 600000, '#ef4444', 'Noldan boshlovchilar uchun'),
  ('Türkçe A2 — Elementar', 'A2', 2, 3, 90, 650000, '#f97316', 'Grammatika asoslari'),
  ('Türkçe B1 — O‘rta', 'B1', 3, 3, 90, 700000, '#eab308', 'Erkin muloqot'),
  ('Türkçe B2 — O‘rtadan yuqori', 'B2', 3, 3, 90, 750000, '#22c55e', 'Akademik matnlar'),
  ('Türkçe C1 — Yuqori', 'C1', 3, 3, 90, 800000, '#3b82f6', 'Ilg‘or daraja'),
  ('TÖMER / YÖS tayyorlov', 'B2', 4, 5, 120, 1100000, '#8b5cf6', 'Turkiya universitetlariga tayyorlov'),
  ('Bolalar uchun turk tili', 'A1', 6, 2, 60, 450000, '#ec4899', '7–12 yosh'),
  ('Speaking Club', null, 1, 1, 90, 200000, '#14b8a6', 'Haftalik muloqot klubi');

insert into message_templates (name, trigger, text) values
  ('Qarzdorlik eslatmasi', 'debt_reminder', 'Hurmatli {name}! Lola Edu: {month} oyi uchun {amount} to''lov muddati o''tdi. Payme/Click orqali to''lash mumkin.'),
  ('Darsga kelmadi', 'absence', 'Assalomu alaykum! {name} bugun ({date}) {group} guruhidagi darsga kelmadi. Lola Edu'),
  ('To''lov qabul qilindi', 'payment_received', '{name}, {amount} to''lovingiz qabul qilindi. Rahmat! Lola Edu'),
  ('Tug''ilgan kun', 'birthday', 'Doğum günün kutlu olsun, {name}! Lola Edu jamoasi sizni tabriklaydi!'),
  ('Xush kelibsiz', 'welcome', 'Hoş geldiniz, {name}! Siz {group} guruhiga qo''shildingiz. Darslar: {schedule}.'),
  ('Sinov darsi eslatmasi', 'trial_reminder', '{name}, ertaga {date} soat {time} da Lola Edu''da bepul sinov darsingiz bor!');
