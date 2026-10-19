// Demo rejim uchun real ko'rinishdagi boshlang'ich ma'lumotlar.
// Sanalar bugungi kunga nisbatan hisoblanadi — demo har doim "jonli" ko'rinadi.
import type { Tables, Student, Group, Enrollment, Attendance, Payment, Charge, Lead, Lesson, Grade, LeadStage } from '../types'
import { addDays, addMonths, monthISO, todayISO } from '../format'
import { lessonDatesInMonth } from '../schedule'
import { chargeForMonth } from '../finance'

type Seed = { [K in keyof Tables]?: Tables[K][] }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const FIRST_M = ['Azizbek', 'Jasur', 'Sardor', 'Bekzod', 'Otabek', 'Javohir', 'Doston', 'Sherzod', 'Ulugbek', 'Islom', 'Temur', 'Abdulloh', 'Shohruh', 'Firdavs', 'Akmal']
const FIRST_F = ['Madina', 'Dilnoza', 'Sevara', 'Nilufar', 'Malika', 'Zarina', 'Shahzoda', 'Kamola', 'Gulnoza', 'Mohinur', 'Sabina', 'Feruza', 'Diyora', 'Laylo', 'Munisa']
const LAST = ['Karimov', 'Toshmatov', 'Rahimov', 'Yusupov', 'Abdullayev', 'Nazarov', 'Ergashev', 'Saidov', 'Qodirov', 'Mirzayev', 'Xolmatov', 'Ismoilov', 'Sobirov', 'Aliyev', 'Umarov']
const SOURCES = ['Instagram', 'Telegram', 'Tavsiya', 'Google', 'TikTok', 'YouTube', 'Banner', "Yo'ldan"]

export function buildSeed(): Seed {
  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const today = todayISO()
  const thisMonth = monthISO()
  const months = [addMonths(thisMonth, -3), addMonths(thisMonth, -2), addMonths(thisMonth, -1), thisMonth]
  const ts = new Date().toISOString()

  const person = (i: number) => {
    const female = i % 2 === 0
    const last = pick(LAST)
    return {
      name: `${female ? pick(FIRST_F) : pick(FIRST_M)} ${female ? last + 'a' : last}`,
      gender: (female ? 'female' : 'male') as 'female' | 'male',
    }
  }
  const phone = () => '+99890' + String(Math.floor(1000000 + r() * 8999999))

  const branches = [
    { id: 'b1', name: 'Lola Edu — Chilonzor', address: 'Toshkent, Chilonzor 9-kvartal', phone: '+998712001010', is_active: true, created_at: ts },
    { id: 'b2', name: 'Lola Edu — Yunusobod', address: 'Toshkent, Yunusobod 4-mavze', phone: '+998712002020', is_active: true, created_at: ts },
  ]
  const rooms = [
    { id: 'r1', branch_id: 'b1', name: 'İstanbul', capacity: 14 },
    { id: 'r2', branch_id: 'b1', name: 'Ankara', capacity: 12 },
    { id: 'r3', branch_id: 'b1', name: 'İzmir', capacity: 10 },
    { id: 'r4', branch_id: 'b2', name: 'Bursa', capacity: 12 },
    { id: 'r5', branch_id: 'b2', name: 'Antalya', capacity: 10 },
  ]

  const courses = [
    { id: 'c1', name: 'Türkçe A1 — Boshlang‘ich', level: 'A1', duration_months: 2, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 600000, color: '#ef4444', is_active: true, description: "Noldan boshlovchilar uchun: alifbo, talaffuz, kundalik so'zlashuv" },
    { id: 'c2', name: 'Türkçe A2 — Elementar', level: 'A2', duration_months: 2, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 650000, color: '#f97316', is_active: true, description: 'Grammatika asoslari, oddiy matnlar' },
    { id: 'c3', name: 'Türkçe B1 — O‘rta', level: 'B1', duration_months: 3, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 700000, color: '#eab308', is_active: true, description: "Erkin muloqot, o'qish va yozish" },
    { id: 'c4', name: 'Türkçe B2 — O‘rtadan yuqori', level: 'B2', duration_months: 3, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 750000, color: '#22c55e', is_active: true, description: 'Akademik matnlar, munozara' },
    { id: 'c5', name: 'Türkçe C1 — Yuqori', level: 'C1', duration_months: 3, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 800000, color: '#3b82f6', is_active: true, description: 'Ilg‘or daraja, adabiyot va media' },
    { id: 'c6', name: 'TÖMER / YÖS tayyorlov', level: 'B2', duration_months: 4, lessons_per_week: 5, lesson_minutes: 120, monthly_price: 1100000, color: '#8b5cf6', is_active: true, description: 'Turkiya universitetlariga kirish va TÖMER sertifikati uchun' },
    { id: 'c7', name: 'Bolalar uchun turk tili (7–12 yosh)', level: 'A1', duration_months: 6, lessons_per_week: 2, lesson_minutes: 60, monthly_price: 450000, color: '#ec4899', is_active: true, description: "O'yinlar, qo'shiqlar va multfilmlar orqali" },
    { id: 'c8', name: 'Speaking Club', level: null, duration_months: 1, lessons_per_week: 1, lesson_minutes: 90, monthly_price: 200000, color: '#14b8a6', is_active: true, description: 'Haftalik jonli muloqot klubi' },
  ] as Tables['courses'][]

  const staff = [
    { id: 'u-owner', full_name: 'Lola Rahimova', role: 'owner', branch_id: null, email: 'rahbar@lola.uz', phone: '+998901000001' },
    { id: 'u-admin', full_name: 'Dilorom Nazarova', role: 'admin', branch_id: null, email: 'admin@lola.uz', phone: '+998901000002' },
    { id: 'u-manager', full_name: 'Murod Ismoilov', role: 'manager', branch_id: 'b1', email: 'menejer@lola.uz', phone: '+998901000003' },
    { id: 'u-manager2', full_name: 'Shoira Yo‘ldosheva', role: 'manager', branch_id: 'b2', email: 'menejer2@lola.uz', phone: '+998901000013' },
    { id: 'u-reception', full_name: 'Shahlo Mirzayeva', role: 'reception', branch_id: 'b1', email: 'resepshn@lola.uz', phone: '+998901000004' },
    { id: 'u-sales', full_name: 'Aziza Xasanova', role: 'sales', branch_id: 'b1', email: 'sotuv@lola.uz', phone: '+998901000005' },
    { id: 'u-marketer', full_name: 'Farrux Qodirov', role: 'marketer', branch_id: null, email: 'marketing@lola.uz', phone: '+998901000006' },
    { id: 'u-accountant', full_name: 'Bekzod Toshmatov', role: 'accountant', branch_id: null, email: 'kassa@lola.uz', phone: '+998901000007' },
    { id: 'u-t1', full_name: 'Elif Yılmaz', role: 'teacher', branch_id: 'b1', email: 'elif@lola.uz', phone: '+998901000008', salary_type: 'percent', salary_percent: 40, specialization: 'A1–B1, Speaking' },
    { id: 'u-t2', full_name: 'Mehmet Demir', role: 'teacher', branch_id: 'b1', email: 'mehmet@lola.uz', phone: '+998901000009', salary_type: 'mixed', salary_fixed: 2000000, salary_percent: 25, specialization: 'B2–C1, TÖMER' },
    { id: 'u-t3', full_name: 'Gulnoza Karimova', role: 'teacher', branch_id: 'b2', email: 'gulnoza@lola.uz', phone: '+998901000010', salary_type: 'per_lesson', salary_per_lesson: 120000, specialization: 'Bolalar, A1–A2' },
    { id: 'u-t4', full_name: 'Ayşe Kaya', role: 'teacher', branch_id: 'b2', email: 'ayse@lola.uz', phone: '+998901000011', salary_type: 'fixed', salary_fixed: 6000000, specialization: 'B1–B2' },
  ].map((p) => ({ is_active: true, lang: 'uz', hire_date: addDays(today, -400), created_at: ts, ...p })) as Tables['profiles'][]

  const groups: Group[] = [
    { id: 'g1', name: 'A1-01 (ertalab)', course_id: 'c1', teacher_id: 'u-t1', branch_id: 'b1', room_id: 'r1', days: [1, 3, 5], start_time: '09:00', end_time: '10:30', start_date: addDays(today, -95), end_date: null, status: 'active', capacity: 14, monthly_price: null },
    { id: 'g2', name: 'A2-02 (kechki)', course_id: 'c2', teacher_id: 'u-t1', branch_id: 'b1', room_id: 'r1', days: [1, 3, 5], start_time: '18:00', end_time: '19:30', start_date: addDays(today, -120), end_date: null, status: 'active', capacity: 14, monthly_price: null },
    { id: 'g3', name: 'B1-01', course_id: 'c3', teacher_id: 'u-t2', branch_id: 'b1', room_id: 'r2', days: [2, 4, 6], start_time: '14:00', end_time: '15:30', start_date: addDays(today, -110), end_date: null, status: 'active', capacity: 12, monthly_price: null },
    { id: 'g4', name: 'TÖMER-1', course_id: 'c6', teacher_id: 'u-t2', branch_id: 'b1', room_id: 'r3', days: [1, 2, 3, 4, 5], start_time: '16:00', end_time: '18:00', start_date: addDays(today, -100), end_date: null, status: 'active', capacity: 10, monthly_price: null },
    { id: 'g5', name: 'Kids-01', course_id: 'c7', teacher_id: 'u-t3', branch_id: 'b2', room_id: 'r4', days: [2, 4], start_time: '15:00', end_time: '16:00', start_date: addDays(today, -130), end_date: null, status: 'active', capacity: 12, monthly_price: null },
    { id: 'g6', name: 'B2-01', course_id: 'c4', teacher_id: 'u-t4', branch_id: 'b2', room_id: 'r5', days: [1, 3, 5], start_time: '10:00', end_time: '11:30', start_date: addDays(today, -90), end_date: null, status: 'active', capacity: 10, monthly_price: null },
    { id: 'g7', name: 'A1-03 (yangi)', course_id: 'c1', teacher_id: 'u-t3', branch_id: 'b2', room_id: 'r4', days: [1, 3, 5], start_time: '18:30', end_time: '20:00', start_date: addDays(today, 7), end_date: null, status: 'forming', capacity: 12, monthly_price: null },
    { id: 'g8', name: 'Speaking Club', course_id: 'c8', teacher_id: 'u-t1', branch_id: 'b1', room_id: 'r2', days: [6], start_time: '11:00', end_time: '12:30', start_date: addDays(today, -80), end_date: null, status: 'active', capacity: 20, monthly_price: null },
  ]

  // O'quvchilar va guruhlarga yozilish
  const students: Student[] = []
  const enrollments: Enrollment[] = []
  const groupSizes: Record<string, number> = { g1: 12, g2: 12, g3: 10, g4: 8, g5: 11, g6: 9, g7: 4, g8: 8 }
  let n = 0
  for (const g of groups) {
    for (let i = 0; i < groupSizes[g.id]; i++) {
      n++
      const p = person(n)
      const id = `s${n}`
      const kid = g.id === 'g5'
      const status = g.status === 'forming' ? 'trial' : r() < 0.08 ? 'frozen' : 'active'
      students.push({
        id,
        full_name: p.name,
        phone: phone(),
        gender: p.gender,
        birth_date: addDays(today, -Math.floor((kid ? 8 : 17 + r() * 15) * 365 + r() * 300)),
        branch_id: g.branch_id,
        status,
        parent_name: kid || r() < 0.3 ? `${pick(FIRST_F)} ${pick(LAST)}a` : null,
        parent_phone: kid || r() < 0.3 ? phone() : null,
        source: pick(SOURCES),
        level: courses.find((c) => c.id === g.course_id)?.level ?? null,
        created_at: ts,
        notes: null,
      })
      const joinedLate = r() < 0.2
      enrollments.push({
        id: `e${n}`,
        student_id: id,
        group_id: g.id,
        start_date: joinedLate ? addDays(today, -Math.floor(10 + r() * 20)) : g.start_date,
        end_date: null,
        status: status === 'frozen' ? 'frozen' : 'active',
        discount_percent: r() < 0.15 ? 10 : 0,
        discount_amount: 0,
      })
    }
  }
  // s5 — ketish xavfi ostidagi faol o'quvchi (demo uchun)
  students[4].status = 'active'
  enrollments[4].status = 'active'
  enrollments[4].start_date = groups[0].start_date
  // Bitta ketgan o'quvchi
  students[3].status = 'left'
  enrollments[3].status = 'left'
  enrollments[3].end_date = addDays(today, -20)
  enrollments[3].left_reason = "Ish vaqti to'g'ri kelmadi"

  // Darslar va davomat (oxirgi 4 hafta)
  const lessons: Lesson[] = []
  const attendance: Attendance[] = []
  const grades: Grade[] = []
  const TOPICS = ['Selamlaşma', 'Sayılar', 'Aile', 'Günlük rutin', 'Geçmiş zaman (-di)', 'Gelecek zaman (-ecek)', 'Alışveriş', 'Yön tarifi', 'Hava durumu', 'Restoranda', 'Seyahat', 'Meslekler']
  for (const g of groups.filter((g) => g.status === 'active')) {
    const dates = [...lessonDatesInMonth(g, addMonths(thisMonth, -1)), ...lessonDatesInMonth(g, thisMonth)].filter(
      (d) => d < today && d >= addDays(today, -28),
    )
    dates.forEach((d, i) => {
      lessons.push({ id: `l-${g.id}-${d}`, group_id: g.id, date: d, topic: TOPICS[i % TOPICS.length], homework: 'Çalışma kitabı s. ' + (10 + i * 2), status: 'done', teacher_id: g.teacher_id })
      for (const e of enrollments.filter((e) => e.group_id === g.id && e.start_date <= d && (!e.end_date || e.end_date >= d) && e.status !== 'frozen')) {
        const x = r()
        // s5 ketma-ket qoldirmoqda — xavf ro'yxatida ko'rinadi
        const status = e.student_id === 's5' && i >= dates.length - 4 ? 'absent' : x < 0.82 ? 'present' : x < 0.9 ? 'late' : x < 0.96 ? 'absent' : 'excused'
        attendance.push({ id: `a-${e.student_id}-${d}`, group_id: g.id, student_id: e.student_id, date: d, status, marked_by: g.teacher_id })
      }
    })
    // Baholar
    const gs = enrollments.filter((e) => e.group_id === g.id && e.status === 'active')
    ;(['quiz', 'speaking', 'writing', 'midterm'] as const).forEach((type, k) => {
      const d = addDays(today, -25 + k * 7)
      for (const e of gs) {
        grades.push({ id: `gr-${e.student_id}-${type}`, student_id: e.student_id, group_id: g.id, type, title: { quiz: 'Unite 3 testi', speaking: 'Konuşma', writing: 'Kompozisyon', midterm: 'Ara sınav' }[type], score: Math.round(55 + r() * 45), max_score: 100, date: d, teacher_id: g.teacher_id })
      }
    })
  }

  // Hisob-kitob va to'lovlar
  const charges: Charge[] = []
  const payments: Payment[] = []
  const METHODS = ['cash', 'cash', 'card', 'payme', 'click', 'click', 'uzum'] as const
  for (const e of enrollments) {
    const g = groups.find((x) => x.id === e.group_id)!
    for (const m of months) {
      const c = chargeForMonth(e, g, courses, m)
      if (!c.amount) continue
      charges.push({ id: `ch-${e.id}-${m}`, student_id: e.student_id, group_id: g.id, month: m, amount: c.amount, discount: c.discount, due_date: m + '-10' })
      const isCurrent = m === thisMonth
      const pays = isCurrent ? r() < 0.7 : r() < 0.95
      if (pays) {
        const maxDay = isCurrent ? Number(today.slice(8, 10)) : 12
        const day = String(Math.min(28, 1 + Math.floor(r() * maxDay))).padStart(2, '0')
        const paidAt = m + '-' + day > today ? today : m + '-' + day
        payments.push({ id: `p-${e.id}-${m}`, student_id: e.student_id, group_id: g.id, amount: c.amount, method: pick([...METHODS]), paid_at: paidAt, month: m, status: 'completed', received_by: 'u-reception', branch_id: g.branch_id, created_at: paidAt + 'T10:00:00Z' })
      }
    }
  }

  const expenseCats = [
    ['Ijara', 5000000, 'b1'],
    ['Ijara', 3500000, 'b2'],
    ['Kommunal', 700000, 'b1'],
    ['Kommunal', 500000, 'b2'],
    ['Marketing', 2000000, 'b1'],
    ['Internet', 300000, 'b1'],
    ['Kanselyariya', 250000, 'b1'],
    ['Kitoblar', 600000, 'b2'],
  ] as const
  const expenses = months.flatMap((m, mi) =>
    expenseCats.map(([category, amount, branch_id], i) => ({
      id: `ex-${mi}-${i}`,
      branch_id,
      category,
      amount: Math.round(amount * (0.9 + r() * 0.2)),
      date: (m + '-05') > today ? today : m + '-05',
      method: 'transfer' as const,
      note: null,
      created_by: 'u-accountant',
    })),
  )

  const salary_payouts = staff
    .filter((s) => s.role === 'teacher')
    .flatMap((t) =>
      months.slice(0, 3).map((m) => {
        const base = 3000000 + Math.round(r() * 1500000)
        return { id: `sp-${t.id}-${m}`, teacher_id: t.id, month: m, base, bonus: 0, deduction: 0, total: base, status: 'paid' as const, paid_at: addMonths(m, 1) + '-05' }
      }),
    )

  const campaigns = [
    { id: 'cm1', name: 'Instagram — Kuzgi qabul', channel: 'Instagram', start_date: addDays(today, -40), end_date: addDays(today, 10), budget: 6000000, spent: 4200000, status: 'running' },
    { id: 'cm2', name: 'Telegram kanallarda reklama', channel: 'Telegram', start_date: addDays(today, -30), end_date: addDays(today, 5), budget: 3000000, spent: 2500000, status: 'running' },
    { id: 'cm3', name: 'TÖMER — Google Ads', channel: 'Google', start_date: addDays(today, -60), end_date: addDays(today, -5), budget: 2500000, spent: 2500000, status: 'finished' },
    { id: 'cm4', name: 'Chilonzor banner', channel: 'Banner', start_date: addDays(today, -90), end_date: addDays(today, -30), budget: 1500000, spent: 1500000, status: 'finished' },
  ] as Tables['campaigns'][]

  const STAGES: LeadStage[] = ['new', 'new', 'new', 'contacted', 'contacted', 'interested', 'trial_scheduled', 'trial_attended', 'won', 'won', 'lost']
  const leads: Lead[] = Array.from({ length: 38 }, (_, i) => {
    const p = person(i + 200)
    const cm = pick(campaigns)
    const stage = pick(STAGES)
    return {
      id: `ld${i + 1}`,
      full_name: p.name,
      phone: phone(),
      source: cm.channel,
      campaign_id: cm.id,
      course_id: pick(courses).id,
      branch_id: r() < 0.6 ? 'b1' : 'b2',
      stage,
      assigned_to: r() < 0.7 ? 'u-sales' : 'u-reception',
      trial_date: stage === 'trial_scheduled' ? addDays(today, 1 + Math.floor(r() * 4)) : stage === 'trial_attended' ? addDays(today, -2) : null,
      trial_group_id: stage.startsWith('trial') ? 'g1' : null,
      lost_reason: stage === 'lost' ? pick(['Narx qimmat', 'Vaqt to‘g‘ri kelmadi', 'Boshqa markazni tanladi', 'Javob bermadi']) : null,
      next_contact_at: ['new', 'contacted', 'interested'].includes(stage) ? addDays(today, Math.floor(r() * 4) - 1) : null,
      notes: null,
      created_at: addDays(today, -Math.floor(r() * 45)) + 'T09:00:00Z',
    }
  })
  // Yutilgan lidlarni o'quvchilarga bog'lash (marketing ROI hisobi uchun)
  leads.filter((l) => l.stage === 'won').forEach((l, i) => {
    const st = students[(i * 7) % students.length]
    l.student_id = st.id
    st.lead_id = l.id
    st.source = l.source
  })
  const lead_activities = leads
    .filter((l) => l.stage !== 'new')
    .map((l, i) => ({ id: `la${i}`, lead_id: l.id, type: 'call' as const, text: "Qo'ng'iroq qilindi, kurs haqida ma'lumot berildi", created_by: l.assigned_to, created_at: l.created_at }))

  const message_templates = [
    { id: 'mt1', name: 'Qarzdorlik eslatmasi', trigger: 'debt_reminder', is_active: true, text: "Hurmatli {name}! Lola Edu: {month} oyi uchun {amount} to'lov muddati o'tdi. Iltimos, to'lovni amalga oshiring. Payme/Click orqali to'lash mumkin." },
    { id: 'mt2', name: 'Darsga kelmadi', trigger: 'absence', is_active: true, text: "Assalomu alaykum! Farzandingiz {name} bugun ({date}) {group} guruhidagi darsga kelmadi. Lola Edu" },
    { id: 'mt3', name: "To'lov qabul qilindi", trigger: 'payment_received', is_active: true, text: "{name}, {amount} to'lovingiz qabul qilindi. Rahmat! Lola Edu Türk Dili Markazi" },
    { id: 'mt4', name: "Tug'ilgan kun", trigger: 'birthday', is_active: true, text: "Doğum günün kutlu olsun, {name}! 🎉 Lola Edu jamoasi sizni tabriklaydi!" },
    { id: 'mt5', name: 'Xush kelibsiz', trigger: 'welcome', is_active: true, text: "Hoş geldiniz, {name}! Siz {group} guruhiga qo'shildingiz. Darslar: {schedule}. Lola Edu" },
    { id: 'mt6', name: 'Sinov darsi eslatmasi', trigger: 'trial_reminder', is_active: true, text: "{name}, ertaga {date} kuni soat {time} da Lola Edu'da bepul sinov darsingiz bor. Kutib qolamiz!" },
  ] as Tables['message_templates'][]

  const tasks = [
    { id: 'tk1', title: "Qarzdorlarga qo'ng'iroq qilish", priority: 'high', status: 'todo', assigned_to: 'u-reception', created_by: 'u-admin', due_date: today },
    { id: 'tk2', title: 'A1-03 guruhini 8 kishiga to‘ldirish', priority: 'high', status: 'in_progress', assigned_to: 'u-sales', created_by: 'u-manager', due_date: addDays(today, 5) },
    { id: 'tk3', title: 'Oylik hisobotni tayyorlash', priority: 'medium', status: 'todo', assigned_to: 'u-accountant', created_by: 'u-owner', due_date: addDays(today, 3) },
    { id: 'tk4', title: 'Instagram uchun 5 ta reels', priority: 'medium', status: 'in_progress', assigned_to: 'u-marketer', created_by: 'u-owner', due_date: addDays(today, 2) },
    { id: 'tk5', title: 'B1-01 oraliq imtihon savollari', priority: 'low', status: 'done', assigned_to: 'u-t2', created_by: 'u-admin', due_date: addDays(today, -2) },
  ] as Tables['tasks'][]

  const materials = [
    { id: 'm1', title: 'Yedi İklim Türkçe A1 — Ders Kitabı', type: 'pdf', url: 'https://example.com/yedi-iklim-a1.pdf', course_id: 'c1', level: 'A1', description: 'Asosiy darslik' },
    { id: 'm2', title: 'Türkçe telaffuz — video dars', type: 'video', url: 'https://youtube.com', course_id: 'c1', level: 'A1' },
    { id: 'm3', title: 'İstanbul Türkçe B1 — Dinleme', type: 'audio', url: 'https://example.com/b1-audio.mp3', course_id: 'c3', level: 'B1' },
    { id: 'm4', title: 'TÖMER sınav örnekleri', type: 'pdf', url: 'https://example.com/tomer.pdf', course_id: 'c6', level: 'B2' },
    { id: 'm5', title: '1000 ta eng ko‘p ishlatiladigan turkcha so‘z', type: 'doc', url: 'https://example.com/1000-kelime', level: 'A2' },
  ] as Tables['materials'][]

  const events = [
    { id: 'ev1', title: 'Speaking Club: Türk mutfağı', date: addDays(today, 5), time: '11:00', branch_id: 'b1', type: 'speaking_club', capacity: 25, description: 'Turk oshxonasi haqida suhbat va degustatsiya' },
    { id: 'ev2', title: 'Oylik daraja imtihoni', date: addDays(today, 12), time: '10:00', branch_id: null, type: 'exam', capacity: null },
    { id: 'ev3', title: 'Cumhuriyet Bayramı kechasi', date: addDays(today, 10), time: '17:00', branch_id: 'b1', type: 'holiday', capacity: 80 },
  ] as Tables['events'][]

  const products = [
    { id: 'pr1', name: 'Yedi İklim A1 kitob to‘plami', price: 180000, stock: 24, category: 'Kitob' },
    { id: 'pr2', name: 'Yedi İklim A2 kitob to‘plami', price: 180000, stock: 15, category: 'Kitob' },
    { id: 'pr3', name: 'Lola Edu daftar', price: 15000, stock: 120, category: 'Kanselyariya' },
    { id: 'pr4', name: 'Lola Edu futbolka', price: 90000, stock: 30, category: 'Merch' },
  ] as Tables['products'][]

  const feedback = [
    { id: 'fb1', student_id: 's2', rating: 5, type: 'praise', text: 'Elif hoca juda zo‘r tushuntiradi!', status: 'resolved', created_at: addDays(today, -6) + 'T12:00:00Z' },
    { id: 'fb2', student_id: 's12', rating: 3, type: 'complaint', text: 'Xonada konditsioner ishlamayapti', status: 'new', created_at: addDays(today, -1) + 'T12:00:00Z' },
    { id: 'fb3', student_id: 's20', rating: 4, type: 'suggestion', text: "Speaking club'ni haftada 2 marta qilsangiz", status: 'in_progress', created_at: addDays(today, -3) + 'T12:00:00Z' },
  ] as Tables['feedback'][]

  // Portal uchun demo hisoblar (o'quvchi va ota-ona)
  const kid = students.find((s) => enrollments.find((e) => e.student_id === s.id)?.group_id === 'g5')!
  const portal = [
    { id: 'u-student', full_name: students[0].full_name, role: 'student', branch_id: 'b1', email: 'talaba@lola.uz', phone: students[0].phone, student_id: students[0].id },
    { id: 'u-parent', full_name: kid.parent_name || 'Ota-ona', role: 'parent', branch_id: kid.branch_id, email: 'otaona@lola.uz', phone: kid.parent_phone, student_id: kid.id },
  ].map((p) => ({ is_active: true, lang: 'uz', created_at: ts, ...p })) as Tables['profiles'][]

  const notifications = [
    { id: 'n1', roles: ['owner', 'admin', 'manager', 'reception'], title: 'Yangi lid: Instagram', body: "Kuzgi qabul kampaniyasidan 3 ta yangi so'rov", link: '/leads', read_by: [], created_at: ts },
    { id: 'n2', roles: ['owner', 'admin', 'accountant'], title: 'Qarzdorlar', body: "Bu oy to'lov qilmagan o'quvchilar bor", link: '/finance/debtors', read_by: [], created_at: ts },
  ] as Tables['notifications'][]

  return {
    branches,
    rooms,
    courses,
    profiles: [...staff, ...portal],
    students,
    groups,
    enrollments,
    lessons,
    attendance,
    grades,
    charges,
    payments,
    expenses,
    salary_payouts,
    campaigns,
    leads,
    lead_activities,
    message_templates,
    tasks,
    materials,
    events,
    products,
    feedback,
    notifications,
    promo_codes: [{ id: 'pc1', code: 'KUZ2026', discount_percent: 15, discount_amount: null, valid_until: addDays(today, 30), max_uses: 50, used_count: 7, is_active: true }],
    homework: [
      { id: 'hw1', group_id: 'g1', title: 'Aile — 10 ta gap yozing', description: "Oilangiz haqida 10 ta gap turkchada", due_date: addDays(today, 2), created_by: 'u-t1' },
      { id: 'hw2', group_id: 'g3', title: 'Geçmiş zaman — mashqlar', description: 'Kitob 34-35 betlar', due_date: addDays(today, 1), created_by: 'u-t2' },
    ],
    homework_submissions: [],
    certificates: [],
    messages: [],
    product_sales: [],
    audit_log: [],
    settings: [
      { id: 'st1', key: 'center', value: { name: 'Lola Edu Türk Dili Markazi', phone: '+998712001010', telegram: '@lolaedu', instagram: '@lola.edu', payment_due_day: 10, absence_alert: true, debt_alert: true } },
    ],
  }
}
