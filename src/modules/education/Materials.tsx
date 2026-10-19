import { FileText, Headphones, Link2, Video, File } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge } from '@/components/ui'
import { LEVELS, type Material } from '@/lib/types'
import { useLookups, useOptions } from '../shared'

const ICON = { pdf: FileText, video: Video, audio: Headphones, link: Link2, doc: File }

export default function MaterialsPage() {
  const t = useT()
  const me = useMe()
  const L = useLookups()
  const opts = useOptions()
  return (
    <ResourcePage
      table="materials"
      title={t('nav.materials')}
      editable={canEdit(me.role, 'materials')}
      addLabel={t('mat.add')}
      onRowClick={(m) => window.open(m.url, '_blank', 'noopener')}
      searchText={(m) => m.title + ' ' + (m.description ?? '')}
      columns={[
        {
          key: 'title',
          label: t('common.name'),
          render: (m: Material) => {
            const I = ICON[m.type] ?? File
            return (
              <div className="row">
                <I size={18} className="brand" />
                <div>
                  <div className="bold">{m.title}</div>
                  {m.description && <div className="small muted">{m.description}</div>}
                </div>
              </div>
            )
          },
        },
        { key: 'type', label: t('common.type'), render: (m) => <Badge>{m.type.toUpperCase()}</Badge> },
        { key: 'level', label: t('common.level'), render: (m) => (m.level ? <Badge tone="purple">{m.level}</Badge> : '—') },
        { key: 'course', label: t('group.course'), hideSm: true, value: (m) => L.courses.get(m.course_id || '')?.name, render: (m) => L.courses.get(m.course_id || '')?.name ?? '—' },
      ]}
      fields={[
        { name: 'title', label: t('common.name'), required: true, full: true },
        { name: 'type', label: t('common.type'), type: 'select', required: true, options: ['pdf', 'video', 'audio', 'link', 'doc'].map((x) => ({ value: x, label: x.toUpperCase() })) },
        { name: 'level', label: t('common.level'), type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
        { name: 'course_id', label: t('group.course'), type: 'select', options: opts.courses },
        { name: 'url', label: t('common.url'), type: 'url', required: true, full: true },
        { name: 'description', label: t('common.description'), type: 'textarea' },
      ]}
      defaults={() => ({ type: 'pdf' })}
    />
  )
}
