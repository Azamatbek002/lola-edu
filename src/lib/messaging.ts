import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db } from './db'
import { useRows } from './data'
import { useAuth } from './auth'
import { fillTemplate } from './format'
import type { TemplateTrigger } from './types'

export interface Recipient {
  phone?: string | null
  telegram_chat_id?: string | null
  name?: string | null
  vars?: Record<string, string | number | null | undefined>
}

/**
 * Xabarlarni navbatga qo'yadi. Supabase rejimida `send-messages` Edge Function
 * navbatdagi xabarlarni Eskiz (SMS) yoki Telegram Bot orqali yuboradi.
 * Telegram chat_id bo'lsa — Telegram, aks holda SMS ishlatiladi.
 */
export function useMessenger() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const templates = useRows('message_templates')

  const send = useCallback(
    async (text: string, recipients: Recipient[], channel?: 'sms' | 'telegram') => {
      const rows = recipients
        .filter((r) => r.phone || r.telegram_chat_id)
        .map((r) => {
          const ch = channel ?? (r.telegram_chat_id ? 'telegram' : 'sms')
          return {
            channel: ch,
            recipient: (ch === 'telegram' ? r.telegram_chat_id : r.phone) || r.phone || '',
            recipient_name: r.name ?? null,
            text: fillTemplate(text, { name: r.name ?? '', ...r.vars }),
            status: db.mode === 'demo' ? ('sent' as const) : ('queued' as const),
            created_by: user?.id ?? null,
          }
        })
        .filter((r) => r.recipient)
      if (!rows.length) return 0
      await db.insertMany('messages', rows)
      qc.invalidateQueries({ queryKey: ['messages'] })
      return rows.length
    },
    [qc, user],
  )

  /** Avtomatik shablon bo'yicha yuborish (shablon o'chirilgan bo'lsa — yubormaydi) */
  const sendTrigger = useCallback(
    async (trigger: TemplateTrigger, recipients: Recipient[]) => {
      const tpl = templates.find((t) => t.trigger === trigger && t.is_active)
      if (!tpl) return 0
      return send(tpl.text, recipients)
    },
    [templates, send],
  )

  return { send, sendTrigger }
}

export const TEMPLATE_VARS = ['{name}', '{amount}', '{month}', '{group}', '{date}', '{time}', '{schedule}']
