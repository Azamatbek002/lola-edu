import {
  LayoutDashboard, Users, BookOpen, GraduationCap, CalendarDays, CheckSquare, Star, ClipboardList, Award, Library,
  UserSquare2, Target, Megaphone, Wallet, AlertTriangle, Receipt, Banknote, BarChart3, ShoppingBag, MessageSquare,
  MessageCircleHeart, PartyPopper, ListTodo, IdCard, Building2, Settings, History, type LucideIcon,
} from 'lucide-react'
import type { Module } from '@/lib/permissions'
import type { Role } from '@/lib/types'

export interface NavItem {
  to: string
  label: string // i18n kaliti
  icon: LucideIcon
  module?: Module
  roles?: Role[] // faqat shu rollar uchun
}
export interface NavSection {
  title: string
  items: NavItem[]
}

export const STAFF_NAV: NavSection[] = [
  {
    title: 'nav.main',
    items: [
      { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { to: '/tasks', label: 'nav.tasks', icon: ListTodo, module: 'tasks' },
    ],
  },
  {
    title: 'nav.education',
    items: [
      { to: '/students', label: 'nav.students', icon: Users, module: 'students' },
      { to: '/groups', label: 'nav.groups', icon: BookOpen, module: 'groups' },
      { to: '/schedule', label: 'nav.schedule', icon: CalendarDays, module: 'schedule' },
      { to: '/attendance', label: 'nav.attendance', icon: CheckSquare, module: 'attendance' },
      { to: '/grades', label: 'nav.grades', icon: Star, module: 'grades' },
      { to: '/homework', label: 'nav.homework', icon: ClipboardList, module: 'homework' },
      { to: '/courses', label: 'nav.courses', icon: GraduationCap, module: 'courses' },
      { to: '/teachers', label: 'nav.teachers', icon: UserSquare2, module: 'teachers' },
      { to: '/certificates', label: 'nav.certificates', icon: Award, module: 'certificates' },
      { to: '/materials', label: 'nav.materials', icon: Library, module: 'materials' },
    ],
  },
  {
    title: 'nav.sales',
    items: [
      { to: '/leads', label: 'nav.leads', icon: Target, module: 'leads' },
      { to: '/marketing', label: 'nav.marketing', icon: Megaphone, module: 'marketing' },
    ],
  },
  {
    title: 'nav.finance',
    items: [
      { to: '/finance/payments', label: 'nav.payments', icon: Wallet, module: 'payments' },
      { to: '/finance/debtors', label: 'nav.debtors', icon: AlertTriangle, module: 'debtors' },
      { to: '/finance/expenses', label: 'nav.expenses', icon: Receipt, module: 'expenses' },
      { to: '/finance/salary', label: 'nav.salary', icon: Banknote, module: 'salary' },
      { to: '/reports', label: 'nav.reports', icon: BarChart3, module: 'reports' },
      { to: '/store', label: 'nav.store', icon: ShoppingBag, module: 'store' },
    ],
  },
  {
    title: 'nav.communication',
    items: [
      { to: '/messages', label: 'nav.messages', icon: MessageSquare, module: 'messages' },
      { to: '/feedback', label: 'nav.feedback', icon: MessageCircleHeart, module: 'feedback', roles: ['owner', 'admin', 'manager'] },
      { to: '/events', label: 'nav.events', icon: PartyPopper, module: 'events' },
    ],
  },
  {
    title: 'nav.management',
    items: [
      { to: '/staff', label: 'nav.staff', icon: IdCard, module: 'staff' },
      { to: '/branches', label: 'nav.branches', icon: Building2, module: 'branches' },
      { to: '/settings', label: 'nav.settings', icon: Settings, module: 'settings' },
      { to: '/audit', label: 'nav.audit', icon: History, module: 'audit' },
    ],
  },
]

export const PORTAL_NAV: NavSection[] = [
  {
    title: 'nav.main',
    items: [
      { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/my/schedule', label: 'nav.mySchedule', icon: CalendarDays },
      { to: '/my/attendance', label: 'nav.myAttendance', icon: CheckSquare },
      { to: '/my/grades', label: 'nav.myGrades', icon: Star },
      { to: '/my/homework', label: 'nav.myHomework', icon: ClipboardList },
      { to: '/my/payments', label: 'nav.myPayments', icon: Wallet },
    ],
  },
  {
    title: 'nav.communication',
    items: [
      { to: '/materials', label: 'nav.materials', icon: Library },
      { to: '/events', label: 'nav.events', icon: PartyPopper },
      { to: '/feedback', label: 'nav.feedback', icon: MessageCircleHeart },
    ],
  },
]
