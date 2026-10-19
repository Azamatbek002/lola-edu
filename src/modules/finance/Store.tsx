import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Button, Card, Field, Input, Modal, Select, Tabs } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { date, money, todayISO } from '@/lib/format'
import { methodLabel, payMethodOptions, useLookups, useOptions } from '../shared'
import type { PayMethod, Product } from '@/lib/types'

export default function StorePage() {
  const t = useT()
  const me = useMe()
  const L = useLookups()
  const [tab, setTab] = useState<'products' | 'sales'>('products')
  const [sell, setSell] = useState<Product | null>(null)
  const sales = useRows('product_sales')
  const products = useRows('products')
  const editable = canEdit(me.role, 'store')
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'products', label: t('store.product') }, { key: 'sales', label: t('store.sales') }]} />
      {tab === 'products' && (
        <ResourcePage
          table="products"
          title={t('nav.store')}
          editable={editable}
          addLabel={t('store.addProduct')}
          searchText={(p) => p.name + (p.category ?? '')}
          rowActions={(p) => editable && <Button size="sm" variant="primary" icon={<ShoppingCart size={14} />} disabled={p.stock < 1} onClick={() => setSell(p)}>{t('store.sell')}</Button>}
          columns={[
            { key: 'name', label: t('store.product'), render: (p) => <b>{p.name}</b> },
            { key: 'category', label: t('common.category'), render: (p) => <Badge>{p.category ?? '—'}</Badge> },
            { key: 'price', label: t('common.price'), num: true, render: (p) => money(p.price) },
            { key: 'stock', label: t('store.stock'), num: true, render: (p) => <b className={p.stock < 5 ? 'red' : ''}>{p.stock}</b> },
          ]}
          fields={[
            { name: 'name', label: t('store.product'), required: true, full: true },
            { name: 'category', label: t('common.category') },
            { name: 'price', label: t('common.price'), type: 'money', required: true },
            { name: 'stock', label: t('store.stock'), type: 'number', required: true },
          ]}
          defaults={() => ({ stock: 0, price: 0 })}
        />
      )}
      {tab === 'sales' && (
        <Card title={t('store.sales')}>
          <DataTable
            rows={sales}
            initialSort={{ key: 'date', dir: -1 }}
            columns={[
              { key: 'date', label: t('common.date'), render: (s) => date(s.date) },
              { key: 'product', label: t('store.product'), render: (s) => products.find((p) => p.id === s.product_id)?.name },
              { key: 'student', label: t('role.student'), render: (s) => L.students.get(s.student_id || '')?.full_name ?? '—' },
              { key: 'quantity', label: t('store.quantity'), num: true },
              { key: 'method', label: t('common.method'), render: (s) => methodLabel(t, s.method) },
              { key: 'amount', label: t('common.amount'), num: true, render: (s) => <b>{money(s.amount)}</b> },
            ]}
          />
        </Card>
      )}
      {sell && <SellModal product={sell} onClose={() => setSell(null)} />}
    </>
  )
}

function SellModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const opts = useOptions()
  const sm = useMutate('product_sales')
  const pm = useMutate('products')
  const [v, setV] = useState({ student_id: '', quantity: '1', method: 'cash' as PayMethod })
  const qty = Math.max(1, Number(v.quantity) || 1)
  const save = async () => {
    if (qty > product.stock) return toast.error(t('store.outOfStock'))
    await sm.create({ product_id: product.id, student_id: v.student_id || null, quantity: qty, amount: qty * product.price, date: todayISO(), method: v.method })
    await pm.update(product.id, { stock: product.stock - qty })
    toast.success(t('common.saved'))
    onClose()
  }
  return (
    <Modal title={`${t('store.sell')}: ${product.name}`} onClose={onClose} footer={<Button variant="primary" onClick={save}>{t('store.sell')} · {money(qty * product.price)}</Button>}>
      <div className="form-grid">
        <Field label={t('role.student')} full><Select value={v.student_id} options={opts.students} placeholder="—" onChange={(e) => setV({ ...v, student_id: e.target.value })} /></Field>
        <Field label={t('store.quantity')}><Input type="number" min={1} max={product.stock} value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} /></Field>
        <Field label={t('common.method')}><Select value={v.method} options={payMethodOptions(t)} onChange={(e) => setV({ ...v, method: e.target.value as PayMethod })} /></Field>
      </div>
    </Modal>
  )
}
