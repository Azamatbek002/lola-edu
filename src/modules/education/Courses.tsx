import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge } from '@/components/ui'
import { money } from '@/lib/format'
import { LEVELS } from '@/lib/types'
import { useGroupStats } from '../shared'
import { useRows } from '@/lib/data'

export default function CoursesPage() {
  const t = useT()
  const me = useMe()
  const groups = useRows('groups')
  const gs = useGroupStats()
  const studentsIn = (cid: string) => groups.filter((g) => g.course_id === cid && g.status === 'active').reduce((n, g) => n + gs.count(g.id), 0)
  return (
    <ResourcePage
      table="courses"
      title={t('nav.courses')}
      editable={canEdit(me.role, 'courses')}
      addLabel={t('course.add')}
      searchText={(c) => c.name + ' ' + (c.description ?? '')}
      columns={[
        {
          key: 'name',
          label: t('common.name'),
          render: (c) => (
            <div className="row">
              <span className="dot" style={{ background: c.color || 'var(--brand)', width: 12, height: 12 }} />
              <div>
                <div className="bold">{c.name}</div>
                <div className="small muted ellipsis" style={{ maxWidth: 360 }}>{c.description}</div>
              </div>
            </div>
          ),
        },
        { key: 'level', label: t('common.level'), render: (c) => (c.level ? <Badge tone="purple">{c.level}</Badge> : '—') },
        { key: 'duration_months', label: t('course.duration'), num: true, hideSm: true },
        { key: 'lessons', label: t('course.lessonsPerWeek'), num: true, hideSm: true, value: (c) => c.lessons_per_week, render: (c) => `${c.lessons_per_week} × ${c.lesson_minutes}′` },
        { key: 'students', label: t('group.students'), num: true, value: (c) => studentsIn(c.id), render: (c) => studentsIn(c.id) },
        { key: 'monthly_price', label: t('course.monthlyPrice'), num: true, render: (c) => <b>{money(c.monthly_price)}</b> },
        { key: 'is_active', label: t('common.status'), render: (c) => (c.is_active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>) },
      ]}
      fields={[
        { name: 'name', label: t('common.name'), required: true, full: true },
        { name: 'level', label: t('common.level'), type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
        { name: 'monthly_price', label: t('course.monthlyPrice'), type: 'money', required: true },
        { name: 'duration_months', label: t('course.duration'), type: 'number', required: true },
        { name: 'lessons_per_week', label: t('course.lessonsPerWeek'), type: 'number', required: true },
        { name: 'lesson_minutes', label: t('course.lessonMinutes'), type: 'number', required: true },
        { name: 'color', label: t('course.color'), type: 'color' },
        { name: 'is_active', label: t('common.status'), type: 'checkbox', placeholder: t('common.active') },
        { name: 'description', label: t('common.description'), type: 'textarea' },
      ]}
      defaults={() => ({ duration_months: 3, lessons_per_week: 3, lesson_minutes: 90, monthly_price: 600000, is_active: true, color: '#c0272d' })}
    />
  )
}
