// Zaxira nusxa: har kecha avtomatik (server → Telegram), qo'lda "Hozir zaxira olish" va JSON yuklab olish
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { db, supabase } from '@/lib/db'
import { TELEGRAM_BOT_USERNAME } from '@/lib/config'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card } from '@/components/ui'
import { DownloadSimple, ShieldCheck, TelegramLogo } from '@/components/icons'
import type { TableName } from '@/lib/types'

/** Ilova orqali yuklab olinadigan jadvallar (rahbar hammasini ko'radi) */
const EXPORT_TABLES: TableName[] = [
  'branches', 'rooms', 'courses', 'profiles', 'students', 'groups', 'enrollments', 'lessons', 'attendance', 'grades',
  'homework', 'homework_submissions', 'certificates', 'materials', 'charges', 'payments', 'expenses', 'salary_payouts',
  'products', 'product_sales', 'campaigns', 'leads', 'lead_activities', 'promo_codes', 'message_templates', 'messages',
  'notifications', 'feedback', 'events', 'tasks', 'settings', 'audit_log',
]

export function BackupCard() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const [busy, setBusy] = useState<'' | 'server' | 'json'>('')
  const linked = !!me.telegram_chat_id

  const runServer = async () => {
    if (!supabase) return
    setBusy('server')
    try {
      const { data, error } = await supabase.functions.invoke('backup', { body: {} })
      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null)
        const msg = String(body?.error ?? error.message)
        toast.error(msg.includes('BACKUP_ZIP_PASSWORD') ? t('backup.noPassword') : msg)
        return
      }
      const c = data?.counts ?? {}
      toast.success(
        t('backup.done')
          .replace('{s}', String(c.students ?? 0))
          .replace('{p}', String(c.payments ?? 0)) + (data?.telegram_sent ? ' · ' + t('backup.sentTg') : ''),
      )
    } finally {
      setBusy('')
    }
  }

  const downloadJson = async () => {
    setBusy('json')
    try {
      const tables: Record<string, unknown[]> = {}
      for (const name of EXPORT_TABLES) {
        try {
          tables[name] = await db.list(name)
        } catch {
          tables[name] = []
        }
      }
      const created = new Date().toISOString()
      const blob = new Blob([JSON.stringify({ meta: { created_at: created, created_by: me.full_name, source: 'app' }, tables }, null, 1)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `lola-edu-malumotlar-${created.slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBusy('')
    }
  }

  return (
    <Card title={t('backup.title')} pad>
      <div className="row mb" style={{ alignItems: 'flex-start' }}>
        <ShieldCheck size={22} style={{ color: 'var(--green)', flexShrink: 0 }} />
        <p className="small" style={{ color: 'var(--text-2)' }}>{t('backup.auto')}</p>
      </div>
      <div className="list-item" style={{ padding: '10px 0' }}>
        <TelegramLogo size={18} />
        <div className="grow small">{t('backup.telegram')}</div>
        {linked ? (
          <Badge tone="green">{t('set.connected')}</Badge>
        ) : TELEGRAM_BOT_USERNAME ? (
          <a className="btn btn-sm btn-secondary" href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${me.id}`} target="_blank" rel="noreferrer">
            {t('backup.connect')}
          </a>
        ) : (
          <Badge>{t('set.notConnected')}</Badge>
        )}
      </div>
      <div className="row-wrap mt">
        {supabase && (
          <Button variant="primary" icon={<ShieldCheck size={16} />} disabled={!!busy} onClick={runServer}>
            {busy === 'server' ? t('backup.working') : t('backup.now')}
          </Button>
        )}
        <Button icon={<DownloadSimple size={16} />} disabled={!!busy} onClick={downloadJson}>
          {busy === 'json' ? t('backup.working') : t('backup.json')}
        </Button>
      </div>
      <p className="small muted mt" style={{ marginTop: 10 }}>{t('backup.jsonHint')}</p>
    </Card>
  )
}
