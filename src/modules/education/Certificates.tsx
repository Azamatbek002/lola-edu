import { useState } from 'react'
import { Printer } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Button, Modal } from '@/components/ui'
import { date, todayISO } from '@/lib/format'
import { LEVELS, type Certificate } from '@/lib/types'
import { useLookups, useOptions } from '../shared'

export default function CertificatesPage() {
  const t = useT()
  const me = useMe()
  const L = useLookups()
  const opts = useOptions()
  const all = useRows('certificates')
  const [print, setPrint] = useState<Certificate | null>(null)
  return (
    <>
      <ResourcePage
        table="certificates"
        title={t('nav.certificates')}
        editable={canEdit(me.role, 'certificates')}
        addLabel={t('cert.add')}
        searchText={(c) => (L.students.get(c.student_id)?.full_name ?? '') + ' ' + c.number}
        rowActions={(c) => <Button size="sm" variant="ghost" icon={<Printer size={14} />} onClick={() => setPrint(c)} aria-label={t('common.print')} />}
        columns={[
          { key: 'number', label: t('cert.number'), render: (c) => <b>{c.number}</b> },
          { key: 'student', label: t('role.student'), value: (c) => L.students.get(c.student_id)?.full_name, render: (c) => L.students.get(c.student_id)?.full_name },
          { key: 'course', label: t('group.course'), value: (c) => L.courses.get(c.course_id)?.name, render: (c) => L.courses.get(c.course_id)?.name, hideSm: true },
          { key: 'level', label: t('common.level'), render: (c) => (c.level ? <Badge tone="purple">{c.level}</Badge> : '—') },
          { key: 'score', label: t('common.score'), num: true },
          { key: 'issued_date', label: t('cert.issued'), render: (c) => date(c.issued_date) },
        ]}
        fields={[
          { name: 'student_id', label: t('role.student'), type: 'select', options: opts.allStudents, required: true, full: true },
          { name: 'course_id', label: t('group.course'), type: 'select', options: opts.courses, required: true },
          { name: 'level', label: t('common.level'), type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
          { name: 'number', label: t('cert.number'), required: true },
          { name: 'issued_date', label: t('cert.issued'), type: 'date', required: true },
          { name: 'score', label: t('common.score'), type: 'number' },
        ]}
        defaults={() => ({ issued_date: todayISO(), number: `LE-${new Date().getFullYear()}-${String(all.length + 1).padStart(4, '0')}` })}
      />
      {print && (
        <Modal title={t('nav.certificates')} onClose={() => setPrint(null)} wide footer={<Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>{t('common.print')}</Button>}>
          <div className="certificate printable">
            <img src="/logo.svg" alt="" style={{ width: 90, margin: '0 auto' }} />
            <div style={{ letterSpacing: '0.15em', fontWeight: 700 }}>LOLA EDU · TÜRK DİLİ MERKEZİ</div>
            <h2>{t('cert.title')}</h2>
            <div className="name">{L.students.get(print.student_id)?.full_name}</div>
            <div>
              «{L.courses.get(print.course_id)?.name}» {t('cert.body')}
              {print.level && <> — <b>{print.level}</b></>}
              {print.score != null && <> · {print.score} {t('common.score').toLowerCase()}</>}
            </div>
            <div className="row between" style={{ marginTop: 30, fontSize: '0.85rem' }}>
              <span>№ {print.number}</span>
              <span>{date(print.issued_date)}</span>
              <span>{t('cert.director')}: ____________</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
