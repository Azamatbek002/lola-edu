-- ════════════════════════════════════════════════════════════════════════════
-- Lola Edu — Türk Dili Markazi: ma'lumotlar bazasi sxemasi
-- ════════════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

-- ─── Filiallar va xonalar ───────────────────────────────────────────────────
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  capacity int not null default 12 check (capacity > 0),
  created_at timestamptz not null default now()
);

-- ─── O'quvchilar ────────────────────────────────────────────────────────────
create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  birth_date date,
  gender text check (gender in ('male', 'female')),
  branch_id uuid not null references branches(id),
  status text not null default 'trial' check (status in ('trial', 'active', 'frozen', 'left', 'graduated')),
  parent_name text,
  parent_phone text,
  source text,
  lead_id uuid,
  referred_by uuid references students(id) on delete set null,
  level text check (level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  passport text,
  address text,
  telegram_chat_id text,
  parent_telegram_chat_id text,
  notes text,
  created_at timestamptz not null default now()
);
create index students_branch_idx on students(branch_id);
create index students_phone_idx on students(phone);
create index students_parent_phone_idx on students(parent_phone);

-- ─── Foydalanuvchilar (auth.users bilan 1:1) ────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role text not null check (role in ('owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher', 'student', 'parent')),
  branch_id uuid references branches(id) on delete set null,
  is_active boolean not null default true,
  lang text not null default 'uz' check (lang in ('uz', 'ru', 'tr')),
  telegram_chat_id text,
  hire_date date,
  salary_type text check (salary_type in ('fixed', 'percent', 'per_lesson', 'mixed')),
  salary_fixed numeric(14, 2),
  salary_percent numeric(5, 2) check (salary_percent between 0 and 100),
  salary_per_lesson numeric(14, 2),
  specialization text,
  student_id uuid references students(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);
create unique index profiles_phone_uq on profiles(phone) where phone is not null and role not in ('student', 'parent');

-- ─── Kurslar va guruhlar ────────────────────────────────────────────────────
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text check (level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  description text,
  duration_months int not null default 3,
  lessons_per_week int not null default 3,
  lesson_minutes int not null default 90,
  monthly_price numeric(14, 2) not null default 0 check (monthly_price >= 0),
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_id uuid not null references courses(id),
  teacher_id uuid references profiles(id) on delete set null,
  branch_id uuid not null references branches(id),
  room_id uuid references rooms(id) on delete set null,
  days int[] not null check (days <@ array[1, 2, 3, 4, 5, 6, 7] and cardinality(days) > 0),
  start_time text not null check (start_time ~ '^\d{2}:\d{2}$'),
  end_time text not null check (end_time ~ '^\d{2}:\d{2}$'),
  start_date date not null,
  end_date date,
  status text not null default 'forming' check (status in ('forming', 'active', 'finished', 'archived')),
  capacity int not null default 12 check (capacity > 0),
  monthly_price numeric(14, 2) check (monthly_price >= 0),
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);
create index groups_teacher_idx on groups(teacher_id);
create index groups_branch_idx on groups(branch_id);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'frozen', 'left', 'finished')),
  discount_percent numeric(5, 2) default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(14, 2) default 0 check (discount_amount >= 0),
  left_reason text,
  created_at timestamptz not null default now()
);
create index enrollments_student_idx on enrollments(student_id);
create index enrollments_group_idx on enrollments(group_id);
create unique index enrollments_active_uq on enrollments(student_id, group_id) where status in ('active', 'frozen');

-- ─── Darslar, davomat, baholar ──────────────────────────────────────────────
create table lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  date date not null,
  topic text,
  homework text,
  status text not null default 'done' check (status in ('done', 'cancelled')),
  teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, date)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  note text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, student_id, date)
);
create index attendance_student_idx on attendance(student_id, date);

create table grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  type text not null check (type in ('homework', 'quiz', 'speaking', 'writing', 'listening', 'reading', 'midterm', 'final')),
  title text not null,
  score numeric(6, 2) not null check (score >= 0),
  max_score numeric(6, 2) not null default 100 check (max_score > 0),
  date date not null default current_date,
  comment text,
  teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index grades_student_idx on grades(student_id);

create table homework (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  attachment_url text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references homework(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  text text,
  file_url text,
  status text not null default 'submitted' check (status in ('submitted', 'checked', 'returned')),
  score numeric(6, 2),
  feedback text,
  created_at timestamptz not null default now(),
  unique (homework_id, student_id)
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  course_id uuid not null references courses(id),
  level text,
  number text not null unique,
  issued_date date not null default current_date,
  score numeric(6, 2),
  created_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('pdf', 'video', 'audio', 'link', 'doc')),
  url text not null,
  course_id uuid references courses(id) on delete set null,
  level text,
  description text,
  created_at timestamptz not null default now()
);

-- ─── Moliya ─────────────────────────────────────────────────────────────────
create table charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric(14, 2) not null check (amount >= 0),
  discount numeric(14, 2) not null default 0,
  due_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, group_id, month)
);
create index charges_student_idx on charges(student_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'payme', 'click', 'uzum', 'transfer')),
  paid_at date not null default current_date,
  month text check (month ~ '^\d{4}-\d{2}$'),
  status text not null default 'completed' check (status in ('completed', 'pending', 'refunded', 'cancelled')),
  received_by uuid references profiles(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  external_id text,
  note text,
  created_at timestamptz not null default now()
);
create index payments_student_idx on payments(student_id);
create index payments_paid_at_idx on payments(paid_at);
create unique index payments_external_uq on payments(method, external_id) where external_id is not null;

-- Payme / Click tranzaksiyalari (onlayn to'lov holatini kuzatish)
create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('payme', 'click')),
  external_id text not null,
  student_id uuid not null references students(id),
  amount numeric(14, 2) not null,
  state int not null, -- payme: 1 yaratildi, 2 bajarildi, -1/-2 bekor; click: 0 prepare, 1 complete, -1 bekor
  create_time bigint,
  perform_time bigint,
  cancel_time bigint,
  reason int,
  payment_id uuid references payments(id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  method text not null default 'cash' check (method in ('cash', 'card', 'payme', 'click', 'uzum', 'transfer')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table salary_payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  base numeric(14, 2) not null default 0,
  bonus numeric(14, 2) not null default 0,
  deduction numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at date,
  note text,
  created_at timestamptz not null default now(),
  unique (teacher_id, month)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(14, 2) not null default 0,
  stock int not null default 0,
  category text,
  created_at timestamptz not null default now()
);

create table product_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  student_id uuid references students(id) on delete set null,
  quantity int not null check (quantity > 0),
  amount numeric(14, 2) not null,
  date date not null default current_date,
  method text not null check (method in ('cash', 'card', 'payme', 'click', 'uzum', 'transfer')),
  created_at timestamptz not null default now()
);

-- ─── CRM va marketing ───────────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  start_date date not null,
  end_date date,
  budget numeric(14, 2) not null default 0,
  spent numeric(14, 2) not null default 0,
  status text not null default 'planned' check (status in ('planned', 'running', 'finished')),
  notes text,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  source text not null default 'Sayt',
  campaign_id uuid references campaigns(id) on delete set null,
  course_id uuid references courses(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'interested', 'trial_scheduled', 'trial_attended', 'won', 'lost')),
  assigned_to uuid references profiles(id) on delete set null,
  trial_date date,
  trial_group_id uuid references groups(id) on delete set null,
  level text,
  lost_reason text,
  next_contact_at date,
  notes text,
  utm_source text,
  utm_campaign text,
  student_id uuid references students(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leads_stage_idx on leads(stage);
create index leads_phone_idx on leads(phone);
alter table students add constraint students_lead_fk foreign key (lead_id) references leads(id) on delete set null;

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('call', 'sms', 'note', 'meeting', 'stage')),
  text text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent numeric(5, 2),
  discount_amount numeric(14, 2),
  valid_until date,
  max_uses int,
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Aloqa ──────────────────────────────────────────────────────────────────
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  trigger text not null default 'manual' check (trigger in ('manual', 'debt_reminder', 'absence', 'birthday', 'lesson_reminder', 'payment_received', 'welcome', 'trial_reminder')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms', 'telegram')),
  recipient text not null,
  recipient_name text,
  text text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text,
  attempts int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_queue_idx on messages(created_at) where status = 'queued';

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  roles text[],
  title text not null,
  body text,
  link text,
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  type text not null check (type in ('nps', 'complaint', 'suggestion', 'praise')),
  text text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  response text,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time text check (time ~ '^\d{2}:\d{2}$'),
  branch_id uuid references branches(id) on delete set null,
  description text,
  capacity int,
  type text not null default 'other' check (type in ('speaking_club', 'exam', 'holiday', 'masterclass', 'meeting', 'other')),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

-- ─── Tizim ──────────────────────────────────────────────────────────────────
create table settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  user_name text,
  action text not null check (action in ('create', 'update', 'delete')),
  entity text not null,
  entity_id text not null,
  summary text,
  created_at timestamptz not null default now()
);
create index audit_entity_idx on audit_log(entity_id);
