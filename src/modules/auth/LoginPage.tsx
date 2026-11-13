import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarDays, CheckSquare, MessageSquare, Target, Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { db } from '@/lib/db'
import { Button, Field, Input } from '@/components/ui'
import { LangSwitch } from '@/layout/AppShell'

const DEMO = [
  { id: 'u-owner', role: 'owner' },
  { id: 'u-admin', role: 'admin' },
  { id: 'u-manager', role: 'manager' },
  { id: 'u-reception', role: 'reception' },
  { id: 'u-sales', role: 'sales' },
  { id: 'u-marketer', role: 'marketer' },
  { id: 'u-accountant', role: 'accountant' },
  { id: 'u-t1', role: 'teacher' },
  { id: 'u-student', role: 'student' },
  { id: 'u-parent', role: 'parent' },
]

export default function LoginPage() {
  const t = useT()
  const { login, demoLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const ok = await login(email, pass)
    setBusy(false)
    if (!ok) setErr(t('login.error'))
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="row">
          <img src="/logo.svg" alt="" style={{ width: 56, height: 56, background: '#fff', borderRadius: 16, padding: 4 }} />
          <div>
            <b style={{ fontSize: '1.2rem' }}>Lola Edu</b>
            <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>{t('app.tagline')}</div>
          </div>
        </div>
        <div>
          <h1>Türkçe öğrenmenin en güzel yolu</h1>
          <p>{t('login.subtitle')}</p>
          <div className="feat">
            <div><Target size={18} /> {t('nav.leads')}</div>
            <div><CalendarDays size={18} /> {t('nav.schedule')}</div>
            <div><CheckSquare size={18} /> {t('nav.attendance')}</div>
            <div><Wallet size={18} /> Payme · Click</div>
            <div><MessageSquare size={18} /> SMS · Telegram</div>
            <div><BarChart3 size={18} /> {t('nav.reports')}</div>
          </div>
        </div>
        <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>© {new Date().getFullYear()} Lola Edu</div>
      </div>
      <div className="auth-form">
        <div className="box">
          <div className="row between mb">
            <h1>{t('login.title')}</h1>
            <LangSwitch />
          </div>
          <form onSubmit={submit} className="col" style={{ gap: 12 }}>
            <Field label={t('login.email')}>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </Field>
            <Field label={t('login.password')}>
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
            </Field>
            {err && <div className="badge badge-red" style={{ padding: 8 }}>{err}</div>}
            <Button variant="primary" block disabled={busy} type="submit">
              {t('login.submit')}
            </Button>
          </form>
          <div className="mt center small">
            <Link to="/apply" className="link">
              {t('login.apply')} →
            </Link>
          </div>
          {db.mode === 'demo' && (
            <div className="mt">
              <div className="divider" />
              <div className="small bold mb" style={{ marginBottom: 8 }}>
                {t('login.demo')}
              </div>
              <div className="demo-grid">
                {DEMO.map((d) => (
                  <button key={d.id} onClick={() => demoLogin(d.id)}>
                    <b>{t('role.' + d.role)}</b>
                  </button>
                ))}
              </div>
              <p className="small muted mt">{t('login.demoNote')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
