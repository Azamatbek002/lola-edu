import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarClock, CheckSquare, Star, Users } from 'lucide-react'
import { useMe } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useRows } from '@/lib/data'
import { Badge, Button, Card, Empty, PageHead, Stat } from '@/components/ui'
import { addDays, dayLabel, todayISO } from '@/lib/format'
import { hasLessonOn } from '@/lib/schedule'
import { attendanceRate } from '@/lib/analytics'
import { groupSchedule, useGroupStats, useLookups } from '../shared'

export default function TeacherDashboard() {
  const me = useMe()
  const t = useT()
  const nav = useNavigate()
  const L = useLookups()
  const gs = useGroupStats()
  const groups = useRows('groups').filter((g) => g.teacher_id === me.id && (g.status === 'active' || g.status === 'forming'))
  const attendance = useRows('attendance')
  const grades = useRows('grades')
  const homework = useRows('homework')
  const subs = useRows('homework_submissions')
  const today = todayISO()
  const ids = new Set(groups.map((g) => g.id))

  const s = useMemo(() => {
    const att = attendance.filter((a) => ids.has(a.group_id) && a.date >= addDays(today, -30))
    const gr = grades.filter((g) => ids.has(g.group_id))
    return {
      students: groups.reduce((n, g) => n + gs.count(g.id), 0),
      att: attendanceRate(att),
      avg: gr.length ? Math.round(gr.reduce((a, g) => a + (g.score / g.max_score) * 100, 0) / gr.length) : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, grades, groups.length])

  const todays = groups.filter((g) => g.status === 'active' && hasLessonOn(g, today)).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const marked = new Set(attendance.filter((a) => a.date === today).map((a) => a.group_id))
  const toCheck = subs.filter((x) => x.status === 'submitted' && homework.find((h) => h.id === x.homework_id && ids.has(h.group_id)))

  return (
    <>
      <PageHead title={`${t('dash.welcome')}, ${me.full_name.split(' ')[0]}!`} subtitle={dayLabel(today)} />
      <div className="grid grid-stats mb">
        <Stat icon={<BookOpen size={20} />} label={t('nav.myGroups')} value={groups.length} />
        <Stat icon={<Users size={20} />} color="#2563eb" label={t('group.students')} value={s.students} />
        <Stat icon={<CheckSquare size={20} />} color="#12a150" label={t('dash.attendanceRate')} value={s.att + '%'} />
        <Stat icon={<Star size={20} />} color="#d97706" label={t('dash.avgScore')} value={s.avg} />
      </div>
      <div className="grid grid-2">
        <Card title={t('dash.todayLessons')}>
          {todays.length === 0 && <Empty text={t('dash.noLessons')} icon={<CalendarClock size={30} />} />}
          {todays.map((g) => (
            <div key={g.id} className="list-item">
              <div className="bold" style={{ width: 48 }}>{g.start_time}</div>
              <div className="grow">
                <div className="bold">{g.name}</div>
                <div className="small muted">{L.rooms.get(g.room_id || '')?.name} · {gs.count(g.id)} {t('group.students').toLowerCase()}</div>
              </div>
              {marked.has(g.id) ? (
                <Badge tone="green">✓ {t('att.saved')}</Badge>
              ) : (
                <Button size="sm" variant="primary" onClick={() => nav(`/attendance?group=${g.id}&date=${today}`)}>
                  {t('att.mark')}
                </Button>
              )}
            </div>
          ))}
        </Card>
        <Card title={t('nav.myGroups')}>
          {groups.map((g) => (
            <div key={g.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav('/groups/' + g.id)}>
              <span className="dot" style={{ background: L.courses.get(g.course_id)?.color || 'var(--brand)' }} />
              <div className="grow">
                <div className="bold">{g.name}</div>
                <div className="small muted">{groupSchedule(t, g)}</div>
              </div>
              <Badge>{gs.count(g.id)}</Badge>
            </div>
          ))}
          {toCheck.length > 0 && (
            <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav('/homework')}>
              <div className="grow bold">{t('nav.homework')}: {t('hw.check').toLowerCase()}</div>
              <Badge tone="brand">{toCheck.length}</Badge>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
