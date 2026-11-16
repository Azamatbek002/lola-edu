// Zaxira arxivi: barcha jadvallar → parol bilan himoyalangan ZIP (AES-256).
// Ichida: to'liq JSON (tiklash uchun) va har bir jadval CSV (Excel'da ochish uchun).
import { BlobWriter, configure, TextReader, ZipWriter } from 'npm:@zip.js/zip.js@2.7.57'

configure({ useWebWorkers: false })

/** Zaxiraga kiradigan jadvallar (public sxemasi) */
export const TABLES = [
  'branches', 'rooms', 'courses', 'profiles', 'students', 'groups', 'enrollments', 'lessons', 'attendance', 'grades',
  'homework', 'homework_submissions', 'certificates', 'materials', 'charges', 'payments', 'payment_transactions',
  'expenses', 'salary_payouts', 'products', 'product_sales', 'campaigns', 'leads', 'lead_activities', 'promo_codes',
  'message_templates', 'messages', 'notifications', 'feedback', 'events', 'tasks', 'settings', 'audit_log',
]

/** Excel (ru/uz sozlamalari) uchun: ";" ajratuvchi, UTF-8 BOM */
export function toCsv(rows: Record<string, unknown>[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n')
}

export interface BackupMeta {
  created_at: string
  created_by: string
  counts: Record<string, number>
  errors: Record<string, string>
}

export async function buildBackupZip(tables: Record<string, Record<string, unknown>[]>, password: string, meta: BackupMeta): Promise<Blob> {
  const zw = new ZipWriter(new BlobWriter('application/zip'), { password, encryptionStrength: 3 })
  const readme = [
    'Lola Edu Türk Dili Markazi — zaxira nusxa',
    `Sana: ${meta.created_at}`,
    `Kim olgan: ${meta.created_by}`,
    '',
    'Ichida:',
    '  lola-edu-zaxira.json — barcha ma\'lumot (bazani tiklash uchun)',
    '  jadvallar/*.csv      — har bir jadval, Excel\'da ochiladi',
    '',
    'Yozuvlar soni:',
    ...Object.entries(meta.counts).filter(([, n]) => n > 0).map(([t, n]) => `  ${t}: ${n}`),
    ...(Object.keys(meta.errors).length ? ['', 'O\'qib bo\'lmagan jadvallar:', ...Object.entries(meta.errors).map(([t, e]) => `  ${t}: ${e}`)] : []),
    '',
    'Kirish loginlari (parollar) bu arxivda yo\'q: ular Supabase Auth\'da alohida, shifrlangan holda saqlanadi.',
  ].join('\r\n')
  await zw.add('O\'QING.txt', new TextReader(readme))
  await zw.add('lola-edu-zaxira.json', new TextReader(JSON.stringify({ meta, tables })))
  for (const [t, rows] of Object.entries(tables)) {
    if (rows.length) await zw.add(`jadvallar/${t}.csv`, new TextReader(toCsv(rows)))
  }
  return await zw.close()
}
