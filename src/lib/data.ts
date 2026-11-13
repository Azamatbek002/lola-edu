import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { db } from './db'
import type { Row, TableName } from './types'
import { useAuth } from './auth'
import { useToast } from '@/components/Toast'
import { useT } from './i18n'

export function useTable<T extends TableName>(table: T) {
  return useQuery({ queryKey: [table], queryFn: () => db.list(table), staleTime: 30_000 })
}

/** Jadval qatorlari (yuklanayotganda bo'sh massiv) */
export function useRows<T extends TableName>(table: T): Row<T>[] {
  const q = useTable(table)
  return (q.data as Row<T>[] | undefined) ?? EMPTY
}
const EMPTY: any[] = []

export function useById<T extends TableName>(table: T): Map<string, Row<T>> {
  const rows = useRows(table)
  return useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])
}

const NO_AUDIT: TableName[] = ['audit_log', 'notifications', 'messages', 'lead_activities']

export function useMutate<T extends TableName>(table: T) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()

  const audit = (action: 'create' | 'update' | 'delete', id: string, summary?: string) => {
    if (NO_AUDIT.includes(table) || !user) return
    db.insert('audit_log', { user_id: user.id, user_name: user.full_name, action, entity: table, entity_id: id, summary: summary?.slice(0, 120) ?? null })
      .then(() => qc.invalidateQueries({ queryKey: ['audit_log'] }))
      .catch(() => {})
  }
  const label = (r: any) => r?.full_name || r?.name || r?.title || r?.code || ''
  const onError = (e: any) => toast.error(e?.message || t('common.error'))
  const done = () => qc.invalidateQueries({ queryKey: [table] })

  const create = useMutation({
    mutationFn: (row: Partial<Row<T>>) => db.insert(table, row),
    onSuccess: (r) => {
      audit('create', r.id, label(r))
      done()
    },
    onError,
  })
  const createMany = useMutation({
    mutationFn: (rows: Partial<Row<T>>[]) => db.insertMany(table, rows),
    onSuccess: done,
    onError,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Row<T>> }) => db.update(table, id, patch),
    onSuccess: (r) => {
      audit('update', r.id, label(r))
      done()
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.remove(table, id),
    onSuccess: (_, id) => {
      audit('delete', id)
      done()
    },
    onError,
  })

  return {
    create: create.mutateAsync,
    createMany: createMany.mutateAsync,
    update: (id: string, patch: Partial<Row<T>>) => update.mutateAsync({ id, patch }),
    remove: remove.mutateAsync,
    busy: create.isPending || update.isPending || remove.isPending || createMany.isPending,
  }
}
