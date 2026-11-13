import type { Role } from './types'

export type Module =
  | 'dashboard'
  | 'students'
  | 'groups'
  | 'courses'
  | 'schedule'
  | 'attendance'
  | 'grades'
  | 'homework'
  | 'certificates'
  | 'materials'
  | 'teachers'
  | 'leads'
  | 'marketing'
  | 'payments'
  | 'debtors'
  | 'expenses'
  | 'salary'
  | 'reports'
  | 'store'
  | 'messages'
  | 'feedback'
  | 'events'
  | 'tasks'
  | 'staff'
  | 'branches'
  | 'settings'
  | 'audit'

const MGMT: Role[] = ['owner', 'admin', 'manager']
const STAFF: Role[] = ['owner', 'admin', 'manager', 'reception', 'sales', 'marketer', 'accountant', 'teacher']

/** Kim ko'ra oladi */
const VIEW: Record<Module, Role[]> = {
  dashboard: [...STAFF, 'student', 'parent'],
  students: [...MGMT, 'reception', 'sales', 'accountant'],
  groups: [...MGMT, 'reception', 'teacher', 'sales'],
  courses: [...MGMT, 'reception', 'sales', 'marketer'],
  schedule: STAFF,
  attendance: [...MGMT, 'reception', 'teacher'],
  grades: [...MGMT, 'teacher'],
  homework: [...MGMT, 'teacher'],
  certificates: [...MGMT, 'reception'],
  materials: [...MGMT, 'teacher', 'student', 'parent'],
  teachers: [...MGMT],
  leads: [...MGMT, 'reception', 'sales', 'marketer'],
  marketing: [...MGMT, 'marketer'],
  payments: [...MGMT, 'reception', 'accountant'],
  debtors: [...MGMT, 'reception', 'accountant'],
  expenses: [...MGMT, 'accountant'],
  salary: ['owner', 'admin', 'accountant', 'teacher'],
  reports: ['owner', 'admin', 'manager', 'accountant'],
  store: [...MGMT, 'reception', 'accountant'],
  messages: [...MGMT, 'reception', 'sales', 'marketer'],
  feedback: [...MGMT, 'student', 'parent'],
  events: [...STAFF, 'student', 'parent'],
  tasks: STAFF,
  staff: ['owner', 'admin'],
  branches: ['owner', 'admin'],
  settings: ['owner', 'admin'],
  audit: ['owner', 'admin'],
}

/** Kim o'zgartira oladi (VIEW ichidan) */
const EDIT: Partial<Record<Module, Role[]>> = {
  students: [...MGMT, 'reception'],
  groups: [...MGMT],
  courses: ['owner', 'admin'],
  attendance: [...MGMT, 'teacher'],
  grades: [...MGMT, 'teacher'],
  homework: [...MGMT, 'teacher'],
  certificates: [...MGMT],
  materials: [...MGMT, 'teacher'],
  teachers: ['owner', 'admin'],
  leads: [...MGMT, 'reception', 'sales'],
  marketing: [...MGMT, 'marketer'],
  payments: [...MGMT, 'reception', 'accountant'],
  expenses: ['owner', 'admin', 'accountant'],
  salary: ['owner', 'admin', 'accountant'],
  store: [...MGMT, 'reception', 'accountant'],
  feedback: [...MGMT],
  events: [...MGMT, 'marketer'],
}

export function canView(role: Role, m: Module): boolean {
  return VIEW[m].includes(role)
}

export function canEdit(role: Role, m: Module): boolean {
  return (EDIT[m] ?? VIEW[m]).includes(role) && canView(role, m)
}

/** Butun markaz bo'yicha ko'radigan rollar (boshqalar faqat o'z filialini) */
export function seesAllBranches(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'marketer' || role === 'accountant'
}
