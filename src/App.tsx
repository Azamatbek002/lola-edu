import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/lib/auth'
import { I18nProvider, useT } from '@/lib/i18n'
import { ToastProvider } from '@/components/Toast'
import { ConfirmProvider } from '@/components/ui'
import { canView, type Module } from '@/lib/permissions'
import { AppShell } from '@/layout/AppShell'
import { STAFF_NAV, PORTAL_NAV } from '@/layout/nav'
import LoginPage from '@/modules/auth/LoginPage'
import ApplyPage from '@/modules/public/Apply'
import Dashboard from '@/modules/dashboard/Dashboard'

const StudentsPage = lazy(() => import('@/modules/students/Students'))
const StudentProfile = lazy(() => import('@/modules/students/StudentProfile'))
const GroupsPage = lazy(() => import('@/modules/groups/Groups'))
const GroupDetail = lazy(() => import('@/modules/groups/GroupDetail'))
const SchedulePage = lazy(() => import('@/modules/schedule/Schedule'))
const AttendancePage = lazy(() => import('@/modules/attendance/Attendance'))
const CoursesPage = lazy(() => import('@/modules/education/Courses'))
const GradesPage = lazy(() => import('@/modules/education/Grades'))
const HomeworkPage = lazy(() => import('@/modules/education/Homework'))
const CertificatesPage = lazy(() => import('@/modules/education/Certificates'))
const MaterialsPage = lazy(() => import('@/modules/education/Materials'))
const StaffPage = lazy(() => import('@/modules/staff/Staff'))
const TeachersPage = lazy(() => import('@/modules/staff/Staff').then((m) => ({ default: m.TeachersPage })))
const LeadsPage = lazy(() => import('@/modules/leads/Leads'))
const MarketingPage = lazy(() => import('@/modules/marketing/Marketing'))
const PaymentsPage = lazy(() => import('@/modules/finance/Payments'))
const DebtorsPage = lazy(() => import('@/modules/finance/Payments').then((m) => ({ default: m.DebtorsPage })))
const ExpensesPage = lazy(() => import('@/modules/finance/Expenses'))
const SalaryPage = lazy(() => import('@/modules/finance/Salary'))
const ReportsPage = lazy(() => import('@/modules/finance/Reports'))
const StorePage = lazy(() => import('@/modules/finance/Store'))
const MessagesPage = lazy(() => import('@/modules/comms/Messages'))
const FeedbackPage = lazy(() => import('@/modules/comms/Other').then((m) => ({ default: m.FeedbackPage })))
const EventsPage = lazy(() => import('@/modules/comms/Other').then((m) => ({ default: m.EventsPage })))
const TasksPage = lazy(() => import('@/modules/comms/Other').then((m) => ({ default: m.TasksPage })))
const BranchesPage = lazy(() => import('@/modules/admin/Admin').then((m) => ({ default: m.BranchesPage })))
const SettingsPage = lazy(() => import('@/modules/admin/Admin').then((m) => ({ default: m.SettingsPage })))
const AuditPage = lazy(() => import('@/modules/admin/Admin').then((m) => ({ default: m.AuditPage })))
const ProfilePage = lazy(() => import('@/modules/admin/Admin').then((m) => ({ default: m.ProfilePage })))
const MySchedule = lazy(() => import('@/modules/portal/Portal').then((m) => ({ default: m.MySchedule })))
const MyAttendance = lazy(() => import('@/modules/portal/Portal').then((m) => ({ default: m.MyAttendance })))
const MyGrades = lazy(() => import('@/modules/portal/Portal').then((m) => ({ default: m.MyGrades })))
const MyHomework = lazy(() => import('@/modules/portal/Portal').then((m) => ({ default: m.MyHomework })))
const MyPayments = lazy(() => import('@/modules/portal/Portal').then((m) => ({ default: m.MyPayments })))

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } })

function Loading() {
  const t = useT()
  return <div className="empty">{t('common.loading')}</div>
}

/** Sahifa nomi menyudan olinadi */
function usePageTitle() {
  const t = useT()
  const { pathname } = useLocation()
  const items = [...STAFF_NAV, ...PORTAL_NAV].flatMap((s) => s.items)
  const exact = items.find((i) => i.to === pathname)
  const prefix = items.filter((i) => i.to !== '/' && pathname.startsWith(i.to)).sort((a, b) => b.to.length - a.to.length)[0]
  const hit = exact ?? prefix
  if (pathname === '/profile') return t('nav.profile')
  return hit ? t(hit.label) : t('nav.dashboard')
}

function Guard({ module, children }: { module?: Module; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  if (module && !canView(user.role, module)) return <Navigate to="/" replace />
  return <>{children}</>
}

function Protected() {
  const { user } = useAuth()
  const title = usePageTitle()
  if (!user) return <LoginPage />
  const portal = user.role === 'student' || user.role === 'parent'
  const g = (m: Module, el: ReactNode) => <Guard module={m}>{el}</Guard>
  return (
    <AppShell title={title}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/materials" element={g('materials', <MaterialsPage />)} />
          <Route path="/events" element={g('events', <EventsPage />)} />
          <Route path="/feedback" element={g('feedback', <FeedbackPage />)} />
          {portal ? (
            <>
              <Route path="/my/schedule" element={<MySchedule />} />
              <Route path="/my/attendance" element={<MyAttendance />} />
              <Route path="/my/grades" element={<MyGrades />} />
              <Route path="/my/homework" element={<MyHomework />} />
              <Route path="/my/payments" element={<MyPayments />} />
            </>
          ) : (
            <>
              <Route path="/tasks" element={g('tasks', <TasksPage />)} />
              <Route path="/students" element={g('students', <StudentsPage />)} />
              <Route path="/students/:id" element={g('students', <StudentProfile />)} />
              <Route path="/groups" element={g('groups', <GroupsPage />)} />
              <Route path="/groups/:id" element={g('groups', <GroupDetail />)} />
              <Route path="/schedule" element={g('schedule', <SchedulePage />)} />
              <Route path="/attendance" element={g('attendance', <AttendancePage />)} />
              <Route path="/grades" element={g('grades', <GradesPage />)} />
              <Route path="/homework" element={g('homework', <HomeworkPage />)} />
              <Route path="/courses" element={g('courses', <CoursesPage />)} />
              <Route path="/teachers" element={g('teachers', <TeachersPage />)} />
              <Route path="/certificates" element={g('certificates', <CertificatesPage />)} />
              <Route path="/leads" element={g('leads', <LeadsPage />)} />
              <Route path="/marketing" element={g('marketing', <MarketingPage />)} />
              <Route path="/finance/payments" element={g('payments', <PaymentsPage />)} />
              <Route path="/finance/debtors" element={g('debtors', <DebtorsPage />)} />
              <Route path="/finance/expenses" element={g('expenses', <ExpensesPage />)} />
              <Route path="/finance/salary" element={g('salary', <SalaryPage />)} />
              <Route path="/reports" element={g('reports', <ReportsPage />)} />
              <Route path="/store" element={g('store', <StorePage />)} />
              <Route path="/messages" element={g('messages', <MessagesPage />)} />
              <Route path="/staff" element={g('staff', <StaffPage />)} />
              <Route path="/branches" element={g('branches', <BranchesPage />)} />
              <Route path="/settings" element={g('settings', <SettingsPage />)} />
              <Route path="/audit" element={g('audit', <AuditPage />)} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

function Root() {
  const { ready } = useAuth()
  if (!ready) return <Loading />
  return (
    <Routes>
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <ConfirmProvider>
              <BrowserRouter>
                <Root />
              </BrowserRouter>
            </ConfirmProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
