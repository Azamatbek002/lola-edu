import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Card, MonthInput } from '@/components/ui'
import { date, money, monthISO } from '@/lib/format'
import { sumBy } from '@/lib/finance'
import { methodLabel, payMethodOptions, useLookups, useOptions } from '../shared'

export const EXPENSE_CATEGORIES = ['Ijara', 'Kommunal', 'Marketing', 'Internet', 'Kanselyariya', 'Kitoblar', 'Jihozlar', "Ta'mirlash", 'Soliq', 'Transport', 'Mehmondorchilik', 'Boshqa']
const COLORS = ['#c0272d', '#2563eb', '#7c3aed', '#0d9488', '#d97706', '#db2777', '#4f46e5', '#059669', '#64748b', '#ea580c', '#0891b2', '#a3a3a3']

export default function ExpensesPage() {
  const t = useT()
  const me = useMe()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const opts = useOptions()
  const [month, setMonth] = useState(monthISO())
  const rows = byBranch(useRows('expenses')).filter((e) => e.date.startsWith(month))
  const cats = sumBy(rows, (e) => e.category, (e) => e.amount)
  const total = rows.reduce((s, e) => s + e.amount, 0)

  return (
    <ResourcePage
      table="expenses"
      title={t('nav.expenses')}
      subtitle={`${money(total)}`}
      branchScoped
      editable={canEdit(me.role, 'expenses')}
      addLabel={t('exp.add')}
      filter={(e) => e.date.startsWith(month)}
      searchText={(e) => e.category + ' ' + (e.note ?? '')}
      initialSort={{ key: 'date', dir: -1 }}
      toolbar={<MonthInput value={month} onChange={setMonth} />}
      top={
        cats.length > 0 && (
          <Card title={t('exp.byCategory')} className="mb">
            <div className="grid grid-2" style={{ alignItems: 'center' }}>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={cats} dataKey="value" nameKey="key" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {cats.map((c, i) => <Cell key={c.key} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ padding: 16 }}>
                {cats.map((c, i) => (
                  <div key={c.key} className="row between" style={{ padding: '4px 0' }}>
                    <span className="row"><span className="dot" style={{ background: COLORS[i % COLORS.length] }} /> {c.key}</span>
                    <b>{money(c.value)}</b>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )
      }
      columns={[
        { key: 'date', label: t('common.date'), render: (e) => date(e.date) },
        { key: 'category', label: t('common.category'), render: (e) => <Badge>{e.category}</Badge> },
        { key: 'note', label: t('common.note') },
        { key: 'branch', label: t('common.branch'), hideSm: true, value: (e) => L.branches.get(e.branch_id)?.name, render: (e) => L.branches.get(e.branch_id)?.name },
        { key: 'method', label: t('common.method'), hideSm: true, render: (e) => methodLabel(t, e.method) },
        { key: 'amount', label: t('common.amount'), num: true, render: (e) => <b className="red">{money(e.amount)}</b> },
      ]}
      fields={[
        { name: 'category', label: t('common.category'), type: 'select', required: true, options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: 'amount', label: t('common.amount'), type: 'money', required: true },
        { name: 'date', label: t('common.date'), type: 'date', required: true },
        { name: 'method', label: t('common.method'), type: 'select', required: true, options: payMethodOptions(t) },
        { name: 'branch_id', label: t('common.branch'), type: 'select', required: true, options: opts.branches },
        { name: 'note', label: t('common.note'), type: 'textarea' },
      ]}
      defaults={() => ({ date: new Date().toISOString().slice(0, 10), method: 'cash', branch_id: me.branch_id || opts.branches[0]?.value, created_by: me.id, category: 'Boshqa' })}
    />
  )
}
