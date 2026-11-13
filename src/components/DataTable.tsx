import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Empty } from './ui'
import { useT } from '@/lib/i18n'

export interface Column<R> {
  key: string
  label: ReactNode
  render?: (r: R) => ReactNode
  /** Saralash va CSV uchun qiymat */
  value?: (r: R) => string | number | null | undefined
  num?: boolean
  hideSm?: boolean
  sortable?: boolean
}

export function DataTable<R extends { id: string }>({
  rows,
  columns,
  onRowClick,
  pageSize = 25,
  empty,
  initialSort,
}: {
  rows: R[]
  columns: Column<R>[]
  onRowClick?: (r: R) => void
  pageSize?: number
  empty?: string
  initialSort?: { key: string; dir: 1 | -1 }
}) {
  const t = useT()
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.value ?? ((r: R) => (r as any)[col.key])
    return [...rows].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const p = Math.min(page, pages - 1)
  const view = sorted.slice(p * pageSize, (p + 1) * pageSize)

  if (!rows.length) return <Empty text={empty} />

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={[c.num && 'num', c.hideSm && 'hide-sm', c.sortable !== false && 'sortable'].filter(Boolean).join(' ')}
                  onClick={() => c.sortable !== false && setSort((s) => ({ key: c.key, dir: s?.key === c.key ? ((-s.dir) as 1 | -1) : 1 }))}
                >
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className={onRowClick ? 'clickable' : ''} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={[c.num && 'num', c.hideSm && 'hide-sm'].filter(Boolean).join(' ')}>
                    {c.render ? c.render(r) : ((r as any)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="row between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="muted small">
            {p * pageSize + 1}–{Math.min(sorted.length, (p + 1) * pageSize)} / {sorted.length}
          </span>
          <div className="row">
            <Button size="sm" icon={<ChevronLeft size={15} />} disabled={p === 0} onClick={() => setPage(p - 1)} aria-label={t('common.prev')} />
            <span className="small bold">
              {p + 1} / {pages}
            </span>
            <Button size="sm" icon={<ChevronRight size={15} />} disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label={t('common.next')} />
          </div>
        </div>
      )}
    </>
  )
}
