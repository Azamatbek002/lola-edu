import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { useRows } from '@/lib/data'
import { Button, Card, PageHead, Select, Badge } from '@/components/ui'
import { addDays, date, todayISO } from '@/lib/format'
import { findConflicts, hasLessonOn, toMinutes, weekStart } from '@/lib/schedule'
import { useLookups, useOptions } from '../shared'

const START_HOUR = 8
const END_HOUR = 21
const HOUR_PX = 56

export default function SchedulePage() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const opts = useOptions()
  const all = byBranch(useRows('groups')).filter((g) => g.status === 'active' || g.status === 'forming')
  const events = byBranch(useRows('events'))
  const [week, setWeek] = useState(weekStart())
  const [teacher, setTeacher] = useState(me.role === 'teacher' ? me.id : '')
  const [room, setRoom] = useState('')

  const groups = all.filter((g) => (!teacher || g.teacher_id === teacher) && (!room || g.room_id === room))
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const today = todayISO()
  const conflicts = useMemo(() => findConflicts(all), [all])

  return (
    <>
      <PageHead
        title={t('nav.schedule')}
        subtitle={`${date(days[0])} — ${date(days[6])}`}
        actions={
          <>
            <Button onClick={() => setWeek(addDays(week, -7))}>‹</Button>
            <Button onClick={() => setWeek(weekStart())}>{t('common.today')}</Button>
            <Button onClick={() => setWeek(addDays(week, 7))}>›</Button>
          </>
        }
      />
      {conflicts.length > 0 && (
        <Card className="mb">
          {conflicts.map((c, i) => (
            <div key={i} className="list-item">
              <AlertTriangle size={16} className="red" />
              <div className="grow small">
                <b>{t('group.conflict')}</b> ({c.type === 'room' ? t('group.conflictRoom') : t('group.conflictTeacher')}): {c.a.name} ↔ {c.b.name}
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <div className="card-head">
          <div className="row-wrap">
            {me.role !== 'teacher' && <Select style={{ width: 200 }} value={teacher} onChange={(e) => setTeacher(e.target.value)} options={opts.teachers} placeholder={t('group.teacher') + ': ' + t('common.all')} />}
            <Select style={{ width: 170 }} value={room} onChange={(e) => setRoom(e.target.value)} options={opts.rooms} placeholder={t('group.room') + ': ' + t('common.all')} />
          </div>
        </div>
        <div className="table-wrap">
          <div className="timetable">
            <div className="tt-head" />
            {days.map((d, i) => (
              <div key={d} className={'tt-head' + (d === today ? ' today' : '')}>
                {t('day.' + (i + 1))} <span className="muted">{d.slice(8)}.{d.slice(5, 7)}</span>
              </div>
            ))}
            <div>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, h) => (
                <div key={h} className="tt-hour">{String(START_HOUR + h).padStart(2, '0')}:00</div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className="tt-col" style={{ background: d === today ? 'var(--brand-50)' : undefined }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, h) => (
                  <div key={h} className="tt-line" />
                ))}
                {groups
                  .filter((g) => hasLessonOn(g, d) || (g.status === 'forming' && g.days.includes(days.indexOf(d) + 1)))
                  .map((g) => {
                    const top = ((toMinutes(g.start_time) - START_HOUR * 60) / 60) * HOUR_PX
                    const h = ((toMinutes(g.end_time) - toMinutes(g.start_time)) / 60) * HOUR_PX
                    const color = L.courses.get(g.course_id)?.color || '#c0272d'
                    return (
                      <div key={g.id} className="tt-event" style={{ top, height: Math.max(h - 2, 24), background: color, opacity: g.status === 'forming' ? 0.65 : 1 }} onClick={() => nav('/groups/' + g.id)} title={g.name}>
                        <b>{g.name}</b>
                        {g.start_time}–{g.end_time}
                        <br />
                        {L.rooms.get(g.room_id || '')?.name} · {L.profiles.get(g.teacher_id || '')?.full_name?.split(' ')[0]}
                      </div>
                    )
                  })}
                {events
                  .filter((e) => e.date === d && e.time)
                  .map((e) => (
                    <div key={e.id} className="tt-event" style={{ top: ((toMinutes(e.time!) - START_HOUR * 60) / 60) * HOUR_PX, height: 40, background: '#13192b' }} onClick={() => nav('/events')}>
                      <b>★ {e.title}</b>
                      {e.time}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="row-wrap mt">
        {[...new Set(groups.map((g) => g.course_id))].map((cid) => (
          <Badge key={cid}>
            <span className="dot" style={{ background: L.courses.get(cid)?.color || '#c0272d' }} /> {L.courses.get(cid)?.name}
          </Badge>
        ))}
      </div>
    </>
  )
}
