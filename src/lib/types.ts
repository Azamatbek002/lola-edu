// Ma'lumotlar modeli. Maydon nomlari Supabase (PostgreSQL) ustunlari bilan bir xil — snake_case.

export type ID = string

export type Role =
  | 'owner' // Rahbar
  | 'admin' // Administrator
  | 'manager' // Filial menejeri
  | 'reception' // Resepshn
  | 'sales' // Sotuv operatori (lidlar)
  | 'marketer' // Marketolog
  | 'accountant' // Buxgalter / kassir
  | 'teacher' // O'qituvchi
  | 'student' // O'quvchi
  | 'parent' // Ota-ona

export const STAFF_ROLES: Role[] = ['owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher']
export const ALL_ROLES: Role[] = [...STAFF_ROLES, 'student', 'parent']

export type Lang = 'uz' | 'ru' | 'tr'

interface Base {
  id: ID
  created_at?: string
}

export interface Branch extends Base {
  name: string
  address?: string
  phone?: string
  is_active: boolean
}

export interface Room extends Base {
  branch_id: ID
  name: string
  capacity: number
}

export type SalaryType = 'fixed' | 'percent' | 'per_lesson' | 'mixed'

export interface Profile extends Base {
  full_name: string
  phone?: string
  email?: string
  role: Role
  branch_id?: ID | null
  is_active: boolean
  lang?: Lang
  telegram_chat_id?: string | null
  // Xodim uchun
  hire_date?: string | null
  salary_type?: SalaryType | null
  salary_fixed?: number | null
  salary_percent?: number | null
  salary_per_lesson?: number | null
  specialization?: string | null
  // O'quvchi / ota-ona portali uchun bog'lanish
  student_id?: ID | null
  notes?: string | null
}

export type StudentStatus = 'trial' | 'active' | 'frozen' | 'left' | 'graduated'
export type Gender = 'male' | 'female'

export interface Student extends Base {
  full_name: string
  phone?: string
  birth_date?: string | null
  gender?: Gender | null
  branch_id: ID
  status: StudentStatus
  parent_name?: string | null
  parent_phone?: string | null
  source?: string | null
  lead_id?: ID | null
  referred_by?: ID | null
  level?: Level | null
  passport?: string | null
  address?: string | null
  telegram_chat_id?: string | null
  parent_telegram_chat_id?: string | null
  notes?: string | null
}

export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface Course extends Base {
  name: string
  level?: Level | null
  description?: string | null
  duration_months: number
  lessons_per_week: number
  lesson_minutes: number
  monthly_price: number
  color?: string | null
  is_active: boolean
}

export type GroupStatus = 'forming' | 'active' | 'finished' | 'archived'

export interface Group extends Base {
  name: string
  course_id: ID
  teacher_id: ID | null
  branch_id: ID
  room_id?: ID | null
  days: number[] // 1=Dushanba ... 7=Yakshanba
  start_time: string // HH:MM
  end_time: string
  start_date: string
  end_date?: string | null
  status: GroupStatus
  capacity: number
  monthly_price?: number | null // kurs narxini almashtiradi
}

export type EnrollmentStatus = 'active' | 'frozen' | 'left' | 'finished'

export interface Enrollment extends Base {
  student_id: ID
  group_id: ID
  start_date: string
  end_date?: string | null
  status: EnrollmentStatus
  discount_percent?: number | null
  discount_amount?: number | null
  left_reason?: string | null
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface Attendance extends Base {
  group_id: ID
  student_id: ID
  date: string
  status: AttendanceStatus
  note?: string | null
  marked_by?: ID | null
}

export interface Lesson extends Base {
  group_id: ID
  date: string
  topic?: string | null
  homework?: string | null
  status: 'done' | 'cancelled'
  teacher_id?: ID | null
}

export type GradeType = 'homework' | 'quiz' | 'speaking' | 'writing' | 'listening' | 'reading' | 'midterm' | 'final'

export interface Grade extends Base {
  student_id: ID
  group_id: ID
  type: GradeType
  title: string
  score: number
  max_score: number
  date: string
  comment?: string | null
  teacher_id?: ID | null
}

export interface Homework extends Base {
  group_id: ID
  title: string
  description?: string | null
  due_date: string
  attachment_url?: string | null
  created_by?: ID | null
}

export interface HomeworkSubmission extends Base {
  homework_id: ID
  student_id: ID
  text?: string | null
  file_url?: string | null
  status: 'submitted' | 'checked' | 'returned'
  score?: number | null
  feedback?: string | null
}

export interface Certificate extends Base {
  student_id: ID
  course_id: ID
  level?: Level | null
  number: string
  issued_date: string
  score?: number | null
}

export interface Charge extends Base {
  student_id: ID
  group_id: ID
  month: string // YYYY-MM
  amount: number // chegirma qo'llangandan keyingi summa
  discount: number
  due_date: string
  note?: string | null
}

export type PayMethod = 'cash' | 'card' | 'payme' | 'click' | 'uzum' | 'transfer'
export const PAY_METHODS: PayMethod[] = ['cash', 'card', 'payme', 'click', 'uzum', 'transfer']

export interface Payment extends Base {
  student_id: ID
  group_id?: ID | null
  amount: number
  method: PayMethod
  paid_at: string // YYYY-MM-DD
  month?: string | null
  status: 'completed' | 'pending' | 'refunded' | 'cancelled'
  received_by?: ID | null
  branch_id?: ID | null
  external_id?: string | null
  note?: string | null
}

export interface Expense extends Base {
  branch_id: ID
  category: string
  amount: number
  date: string
  method: PayMethod
  note?: string | null
  created_by?: ID | null
}

export interface SalaryPayout extends Base {
  teacher_id: ID
  month: string
  base: number
  bonus: number
  deduction: number
  total: number
  status: 'draft' | 'paid'
  paid_at?: string | null
  note?: string | null
}

export type LeadStage = 'new' | 'contacted' | 'interested' | 'trial_scheduled' | 'trial_attended' | 'won' | 'lost'
export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'interested', 'trial_scheduled', 'trial_attended', 'won', 'lost']

export interface Lead extends Base {
  full_name: string
  phone: string
  source: string
  campaign_id?: ID | null
  course_id?: ID | null
  branch_id?: ID | null
  stage: LeadStage
  assigned_to?: ID | null
  trial_date?: string | null
  trial_group_id?: ID | null
  level?: Level | null
  lost_reason?: string | null
  next_contact_at?: string | null
  notes?: string | null
  utm_source?: string | null
  utm_campaign?: string | null
  student_id?: ID | null
}

export interface LeadActivity extends Base {
  lead_id: ID
  type: 'call' | 'sms' | 'note' | 'meeting' | 'stage'
  text: string
  created_by?: ID | null
}

export interface Campaign extends Base {
  name: string
  channel: string
  start_date: string
  end_date?: string | null
  budget: number
  spent: number
  status: 'planned' | 'running' | 'finished'
  notes?: string | null
}

export interface PromoCode extends Base {
  code: string
  discount_percent?: number | null
  discount_amount?: number | null
  valid_until?: string | null
  max_uses?: number | null
  used_count: number
  is_active: boolean
}

export interface Task extends Base {
  title: string
  description?: string | null
  assigned_to?: ID | null
  created_by?: ID | null
  due_date?: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  related_type?: 'lead' | 'student' | 'group' | null
  related_id?: ID | null
}

export interface Message extends Base {
  channel: 'sms' | 'telegram'
  recipient: string
  recipient_name?: string | null
  text: string
  status: 'queued' | 'sent' | 'failed'
  created_by?: ID | null
}

export type TemplateTrigger =
  | 'manual'
  | 'debt_reminder'
  | 'absence'
  | 'birthday'
  | 'lesson_reminder'
  | 'payment_received'
  | 'welcome'
  | 'trial_reminder'

export interface MessageTemplate extends Base {
  name: string
  text: string
  trigger: TemplateTrigger
  is_active: boolean
}

export interface Notification extends Base {
  user_id?: ID | null
  roles?: Role[] | null
  title: string
  body?: string | null
  link?: string | null
  read_by: ID[]
}

export interface Material extends Base {
  title: string
  type: 'pdf' | 'video' | 'audio' | 'link' | 'doc'
  url: string
  course_id?: ID | null
  level?: Level | null
  description?: string | null
}

export interface Feedback extends Base {
  student_id?: ID | null
  rating: number
  type: 'nps' | 'complaint' | 'suggestion' | 'praise'
  text?: string | null
  status: 'new' | 'in_progress' | 'resolved'
  response?: string | null
}

export interface CenterEvent extends Base {
  title: string
  date: string
  time?: string | null
  branch_id?: ID | null
  description?: string | null
  capacity?: number | null
  type: 'speaking_club' | 'exam' | 'holiday' | 'masterclass' | 'meeting' | 'other'
}

export interface Product extends Base {
  name: string
  price: number
  stock: number
  category?: string | null
}

export interface ProductSale extends Base {
  product_id: ID
  student_id?: ID | null
  quantity: number
  amount: number
  date: string
  method: PayMethod
}

export interface AuditLog extends Base {
  user_id?: ID | null
  user_name?: string | null
  action: 'create' | 'update' | 'delete'
  entity: string
  entity_id: ID
  summary?: string | null
}

export interface Setting extends Base {
  key: string
  value: unknown
}

export interface Tables {
  branches: Branch
  rooms: Room
  profiles: Profile
  students: Student
  courses: Course
  groups: Group
  enrollments: Enrollment
  attendance: Attendance
  lessons: Lesson
  grades: Grade
  homework: Homework
  homework_submissions: HomeworkSubmission
  certificates: Certificate
  charges: Charge
  payments: Payment
  expenses: Expense
  salary_payouts: SalaryPayout
  leads: Lead
  lead_activities: LeadActivity
  campaigns: Campaign
  promo_codes: PromoCode
  tasks: Task
  messages: Message
  message_templates: MessageTemplate
  notifications: Notification
  materials: Material
  feedback: Feedback
  events: CenterEvent
  products: Product
  product_sales: ProductSale
  audit_log: AuditLog
  settings: Setting
}

export type TableName = keyof Tables
export type Row<T extends TableName> = Tables[T]
