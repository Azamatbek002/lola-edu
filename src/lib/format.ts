import type { Lang } from './types'

let currentLang: Lang = 'uz'
export function setFormatLang(l: Lang) {
  currentLang = l
}

const CURRENCY: Record<Lang, string> = { uz: "so'm", ru: 'сум', tr: 'UZS' }

export function money(n: number | null | undefined, withCurrency = true): string {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (v < 0 ? '−' : '') + s + (withCurrency ? ' ' + CURRENCY[currentLang] : '')
}

/** Qisqa ko'rinish: 12.5 mln */
export function moneyShort(n: number): string {
  const abs = Math.abs(n)
  const units: Record<Lang, [string, string, string]> = {
    uz: ['mlrd', 'mln', 'ming'],
    ru: ['млрд', 'млн', 'тыс'],
    tr: ['mlr', 'mn', 'bin'],
  }
  const [b, m, k] = units[currentLang]
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' ' + b
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' ' + m
  if (abs >= 1e3) return Math.round(n / 1e3) + ' ' + k
  return String(Math.round(n))
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthISO(d = new Date()): string {
  return todayISO(d).slice(0, 7)
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return monthISO(d)
}

// Brauzerlar o'zbek oy nomlarini har doim ham bilmaydi — shuning uchun o'zimiz saqlaymiz
const MONTHS: Record<Lang, string[]> = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
}
const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

const SHORT_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
function short(m: number): string {
  return currentLang === 'uz' ? SHORT_UZ[m] : MONTHS[currentLang][m].slice(0, 3)
}

export function monthShort(month: string): string {
  return short(Number(month.slice(5, 7)) - 1)
}

function dayMonth(d: Date): string {
  const m = d.getMonth()
  if (currentLang === 'ru') return `${d.getDate()} ${MONTHS_GEN_RU[m].slice(0, 3)}`
  return `${d.getDate()} ${short(m).toLowerCase()}`
}

export function date(s?: string | null): string {
  if (!s) return '—'
  const d = parseISO(s)
  const y = d.getFullYear() === new Date().getFullYear() ? '' : ' ' + d.getFullYear()
  return dayMonth(d) + y
}

export function dateTime(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return `${dayMonth(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  return `${MONTHS[currentLang][Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

export function phone(p?: string | null): string {
  if (!p) return '—'
  const digits = p.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return p
}

/** Telefon raqamini +998XXXXXXXXX ko'rinishiga keltiradi */
export function normalizePhone(p: string): string {
  let d = p.replace(/\D/g, '')
  if (d.length === 9) d = '998' + d
  return d ? '+' + d : ''
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

export function age(birth?: string | null): number | null {
  if (!birth) return null
  const b = parseISO(birth)
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--
  return a
}

export function fillTemplate(text: string, vars: Record<string, string | number | undefined | null>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '') + '')
}

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = c == null ? '' : String(c)
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const WEEKDAYS: Record<Lang, string[]> = {
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
}

/** "Dushanba, 19 oktabr 2026" */
export function dayLabel(iso: string): string {
  const d = parseISO(iso)
  const m = currentLang === 'ru' ? MONTHS_GEN_RU[d.getMonth()] : MONTHS[currentLang][d.getMonth()].toLowerCase()
  return `${WEEKDAYS[currentLang][d.getDay()]}, ${d.getDate()} ${m} ${d.getFullYear()}`
}
