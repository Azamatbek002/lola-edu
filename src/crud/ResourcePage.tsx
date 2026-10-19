import { useMemo, useState, type ReactNode } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, PageHead, SearchInput, useConfirm } from '@/components/ui'
import { DataTable, type Column } from '@/components/DataTable'
import { EntityForm, type FieldDef } from './EntityForm'
import { useMutate, useRows } from '@/lib/data'
import { useBranchFilter } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { downloadCSV } from '@/lib/format'
import type { Row, TableName } from '@/lib/types'

export interface ResourceProps<T extends TableName> {
  table: T
  title: string
  subtitle?: ReactNode
  columns: Column<Row<T>>[]
  fields: FieldDef<any>[]
  defaults: () => Record<string, any>
  searchText?: (r: Row<T>) => string
  filter?: (r: Row<T>) => boolean
  toolbar?: ReactNode
  editable?: boolean
  addLabel?: string
  branchScoped?: boolean
  onRowClick?: (r: Row<T>) => void
  beforeSave?: (v: any, existing?: Row<T>) => any
  afterSave?: (saved: Row<T>, isNew: boolean) => void
  /** Yaratishni o'zgartirish (masalan, Supabase'da foydalanuvchi yaratish) */
  onCreate?: (v: any) => Promise<unknown>
  rowActions?: (r: Row<T>) => ReactNode
  top?: ReactNode
  wideForm?: boolean
  validate?: (v: any) => string | null
  initialSort?: { key: string; dir: 1 | -1 }
}

export function ResourcePage<T extends TableName>(p: ResourceProps<T>) {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const all = useRows(p.table)
  const m = useMutate(p.table)
  const byBranch = useBranchFilter()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partial<Row<T>> | null>(null)

  const rows = useMemo(() => {
    let r = p.branchScoped ? byBranch(all as any[]) : (all as any[])
    if (p.filter) r = r.filter(p.filter)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      r = r.filter((x) => (p.searchText ? p.searchText(x) : JSON.stringify(x)).toLowerCase().includes(s))
    }
    return r as Row<T>[]
  }, [all, q, p.filter, p.searchText, p.branchScoped, byBranch])

  const columns: Column<Row<T>>[] = useMemo(() => {
    if (!p.editable && !p.rowActions) return p.columns
    return [
      ...p.columns,
      {
        key: '_actions',
        label: '',
        sortable: false,
        render: (r) => (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {p.rowActions?.(r)}
            {p.editable && (
              <>
                <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing(r)} aria-label={t('common.edit')} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} />}
                  aria-label={t('common.delete')}
                  onClick={async () => {
                    if (await confirm((r as any).full_name || (r as any).name || (r as any).title || '')) {
                      await m.remove(r.id)
                      toast.success(t('common.deleted'))
                    }
                  }}
                />
              </>
            )}
          </div>
        ),
      },
    ]
  }, [p.columns, p.editable, p.rowActions, t, confirm, m, toast])

  const exportCsv = () => {
    const cols = p.columns.filter((c) => c.key !== '_actions')
    downloadCSV(`${p.table}.csv`, [
      cols.map((c) => (typeof c.label === 'string' ? c.label : c.key)),
      ...rows.map((r) => cols.map((c) => (c.value ? c.value(r) : (r as any)[c.key]))),
    ])
  }

  return (
    <>
      <PageHead
        title={p.title}
        subtitle={p.subtitle}
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportCsv} className="hide-sm">
              {t('common.export')}
            </Button>
            {p.editable && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(p.defaults() as Partial<Row<T>>)}>
                {p.addLabel ?? t('common.add')}
              </Button>
            )}
          </>
        }
      />
      {p.top}
      <Card>
        <div className="card-head">
          <SearchInput value={q} onChange={setQ} />
          <div className="row-wrap">{p.toolbar}</div>
        </div>
        <DataTable rows={rows} columns={columns} onRowClick={p.onRowClick ?? (p.editable ? (r) => setEditing(r) : undefined)} initialSort={p.initialSort} />
      </Card>
      {editing && (
        <EntityForm
          title={editing.id ? t('common.edit') : p.addLabel ?? t('common.add')}
          fields={p.fields}
          initial={editing as any}
          wide={p.wideForm}
          validate={p.validate}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const existing = editing.id ? (editing as Row<T>) : undefined
            const data = p.beforeSave ? p.beforeSave(v, existing) : v
            const { id, created_at, ...patch } = data
            if (!existing && p.onCreate) await p.onCreate(patch)
            else {
              const saved = existing ? await m.update(existing.id, patch) : await m.create(patch)
              p.afterSave?.(saved, !existing)
            }
            toast.success(t('common.saved'))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
