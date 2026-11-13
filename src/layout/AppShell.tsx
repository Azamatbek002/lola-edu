import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Sun, User } from 'lucide-react'
import { useAuth, useMe } from '@/lib/auth'
import { useI18n, LANGS } from '@/lib/i18n'
import { canView } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { Avatar, Badge, Button } from '@/components/ui'
import { PORTAL_NAV, STAFF_NAV, type NavSection } from './nav'
import { dateTime } from '@/lib/format'
import type { Lang } from '@/lib/types'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('lola:theme') as 'light' | 'dark') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('lola:theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  return [theme, setTheme] as const
}

export function LangSwitch() {
  const { lang, setLang } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label="language">
      {LANGS.map((l) => (
        <button key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code as Lang)} title={l.label}>
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function NotificationBell() {
  const me = useMe()
  const { t } = useI18n()
  const nav = useNavigate()
  const all = useRows('notifications')
  const m = useMutate('notifications')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mine = useMemo(
    () =>
      all
        .filter((n) => n.user_id === me.id || (!n.user_id && (!n.roles?.length || n.roles.includes(me.role))))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
    [all, me],
  )
  const unread = mine.filter((n) => !n.read_by?.includes(me.id))
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const markAll = () => unread.forEach((n) => m.update(n.id, { read_by: [...(n.read_by || []), me.id] }))
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <Button variant="ghost" icon={<Bell size={19} />} onClick={() => setOpen((o) => !o)} aria-label={t('nav.notifications')} />
      {unread.length > 0 && (
        <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--brand)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '0 5px' }}>{unread.length}</span>
      )}
      {open && (
        <div className="popover">
          <div className="card-head">
            <h3>{t('nav.notifications')}</h3>
            {unread.length > 0 && (
              <span className="link small" onClick={markAll}>
                ✓ {t('common.all')}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {mine.length === 0 && <div className="empty">{t('common.empty')}</div>}
            {mine.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className="list-item"
                style={{ cursor: n.link ? 'pointer' : undefined, background: n.read_by?.includes(me.id) ? undefined : 'var(--brand-50)' }}
                onClick={() => {
                  m.update(n.id, { read_by: [...new Set([...(n.read_by || []), me.id])] })
                  if (n.link) {
                    nav(n.link)
                    setOpen(false)
                  }
                }}
              >
                <div className="grow">
                  <div className="bold small">{n.title}</div>
                  {n.body && <div className="small muted">{n.body}</div>}
                  <div className="small muted">{dateTime(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const me = useMe()
  const { logout, canSwitchBranch, branchId, setBranchId } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const loc = useLocation()
  const branches = useRows('branches')
  const isPortal = me.role === 'student' || me.role === 'parent'
  useEffect(() => setOpen(false), [loc.pathname])

  const sections: NavSection[] = useMemo(() => {
    const src = isPortal ? PORTAL_NAV : STAFF_NAV
    return src
      .map((s) => ({ ...s, items: s.items.filter((i) => (!i.module || canView(me.role, i.module)) && (!i.roles || i.roles.includes(me.role))) }))
      .filter((s) => s.items.length)
  }, [me.role, isPortal])

  const bottom = sections.flatMap((s) => s.items).slice(0, 5)

  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sidebar-head">
          <img src="/logo.svg" className="logo" alt="Lola Edu" />
          <div>
            <b>Lola Edu</b>
            <small>{t('app.tagline')}</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sections.map((s) => (
            <div key={s.title}>
              <div className="nav-section">{t(s.title)}</div>
              {s.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                  <i.icon size={17} />
                  <span>{t(i.label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/profile" className="me">
            <Avatar name={me.full_name} />
            <div style={{ minWidth: 0 }}>
              <b>{me.full_name}</b>
              <small>{t('role.' + me.role)}</small>
            </div>
          </NavLink>
          <button className="btn btn-ghost btn-sm btn-block" style={{ color: 'rgba(255,255,255,.6)', marginTop: 8 }} onClick={logout}>
            <LogOut size={15} /> {t('nav.logout')}
          </button>
        </div>
      </aside>
      <div className={'backdrop' + (open ? ' open' : '')} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <Button variant="ghost" className="menu-btn" icon={<Menu size={20} />} onClick={() => setOpen(true)} aria-label="menu" />
          <h1>{title}</h1>
          {db.mode === 'demo' && (
            <span className="hide-sm">
              <Badge tone="yellow">{t('common.demoMode')}</Badge>
            </span>
          )}
          {canSwitchBranch && branches.length > 1 && (
            <select className="select hide-sm" style={{ width: 'auto', minHeight: 34 }} value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value || null)}>
              <option value="">{t('common.all')} — {t('common.branch').toLowerCase()}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <span className="hide-sm">
            <LangSwitch />
          </span>
          <Button variant="ghost" icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('common.darkMode')} />
          <NotificationBell />
          <NavLink to="/profile" className="btn btn-ghost btn-icon" aria-label={t('nav.profile')} style={{ display: 'inline-flex' }}>
            <User size={18} />
          </NavLink>
        </header>
        <main className="content">{children}</main>
      </div>
      <nav className="bottom-nav">
        {bottom.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <i.icon size={20} />
            <span className="ellipsis" style={{ maxWidth: 70 }}>
              {t(i.label)}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
