import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Row, TableName } from '../types'
import { uid } from '../format'
import { buildSeed } from './seed'

export interface DB {
  mode: 'demo' | 'supabase'
  list<T extends TableName>(table: T): Promise<Row<T>[]>
  insert<T extends TableName>(table: T, row: Partial<Row<T>>): Promise<Row<T>>
  insertMany<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<Row<T>[]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove(table: TableName, id: string): Promise<void>
}

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null

// ─── Supabase ───────────────────────────────────────────────────────────────

function supabaseDB(sb: SupabaseClient): DB {
  return {
    mode: 'supabase',
    async list(table) {
      const out: any[] = []
      const page = 1000
      for (let from = 0; ; from += page) {
        const { data, error } = await sb.from(table).select('*').range(from, from + page - 1)
        if (error) throw error
        out.push(...(data || []))
        if (!data || data.length < page) break
      }
      if (table === 'profiles') {
        // Portal foydalanuvchilari boshqa profillarni ko'rmaydi — o'qituvchi ismlari ma'lumotnomadan olinadi
        const { data } = await sb.from('staff_directory').select('*')
        const have = new Set(out.map((p) => p.id))
        for (const p of data || []) if (!have.has(p.id)) out.push({ ...p, is_active: true })
      }
      return out
    },
    async insert(table, row) {
      const { data, error } = await sb.from(table).insert(row as any).select().single()
      if (error) throw error
      return data
    },
    async insertMany(table, rows) {
      if (!rows.length) return []
      const { data, error } = await sb.from(table).insert(rows as any).select()
      if (error) throw error
      return data || []
    },
    async update(table, id, patch) {
      const { data, error } = await sb.from(table).update(patch as any).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq('id', id)
      if (error) throw error
    },
  }
}

// ─── Demo (brauzer xotirasi) ────────────────────────────────────────────────

const PREFIX = 'lola:v2:'

function localDB(): DB {
  const mem = new Map<string, any[]>()
  let seeded = false

  function ensureSeed() {
    if (seeded) return
    seeded = true
    let has = false
    try {
      has = localStorage.getItem(PREFIX + '__seeded') === '1'
    } catch {
      /* xotira yo'q */
    }
    if (!has) {
      const seed = buildSeed()
      for (const [t, rows] of Object.entries(seed)) save(t, rows as any[])
      try {
        localStorage.setItem(PREFIX + '__seeded', '1')
      } catch {
        /* ignore */
      }
    }
  }

  function load(table: string): any[] {
    ensureSeed()
    if (mem.has(table)) return mem.get(table)!
    let rows: any[] = []
    try {
      rows = JSON.parse(localStorage.getItem(PREFIX + table) || '[]')
    } catch {
      rows = []
    }
    mem.set(table, rows)
    return rows
  }

  function save(table: string, rows: any[]) {
    mem.set(table, rows)
    try {
      localStorage.setItem(PREFIX + table, JSON.stringify(rows))
    } catch {
      /* to'lgan bo'lishi mumkin */
    }
  }

  const delay = () => new Promise((r) => setTimeout(r, 40))

  return {
    mode: 'demo',
    async list(table) {
      await delay()
      return [...load(table)]
    },
    async insert(table, row) {
      const rows = load(table)
      const r = { id: uid(), created_at: new Date().toISOString(), ...row }
      save(table, [...rows, r])
      return r as any
    },
    async insertMany(table, newRows) {
      const rows = load(table)
      const rs = newRows.map((row) => ({ id: uid(), created_at: new Date().toISOString(), ...row }))
      save(table, [...rows, ...rs])
      return rs as any
    },
    async update(table, id, patch) {
      const rows = load(table)
      let updated: any
      save(
        table,
        rows.map((r) => (r.id === id ? (updated = { ...r, ...patch }) : r)),
      )
      if (!updated) throw new Error('Topilmadi')
      return updated
    },
    async remove(table, id) {
      save(
        table,
        load(table).filter((r) => r.id !== id),
      )
    },
  }
}

export function resetDemoData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  location.reload()
}

export const db: DB = supabase ? supabaseDB(supabase) : localDB()
