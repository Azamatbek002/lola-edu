// Onlayn to'lov (Payme, Click) sozlamalari: settings jadvalidagi 'online_pay' yozuvi.
// Kassa ID'lari ochiq ma'lumot (to'lov havolasida ko'rinadi). Maxfiy kalitlar faqat Supabase Secrets'da.
import { useMemo } from 'react'
import { useRows } from './data'
import { SUPABASE_URL } from './config'

export interface OnlinePayConfig {
  payme_merchant_id?: string
  click_service_id?: string
  click_merchant_id?: string
  site_url?: string
  /** Fiskal chek uchun (Payme so'rasa): IKPU (MXIK) kodi, o'lchov birligi kodi, QQS foizi */
  mxik?: string
  package_code?: string
  vat_percent?: number
}

export const DEFAULT_SITE = 'https://lola-edu.vercel.app'
export const PAYME_ENDPOINT = `${SUPABASE_URL}/functions/v1/payme`
export const CLICK_ENDPOINT = `${SUPABASE_URL}/functions/v1/click`

export interface OnlinePay {
  cfg: OnlinePayConfig
  payme: string
  clickService: string
  clickMerchant: string
  site: string
  enabled: boolean
}

export function readOnlinePay(value: unknown): OnlinePay {
  const cfg = (value ?? {}) as OnlinePayConfig
  const env = import.meta.env
  const payme = (cfg.payme_merchant_id || env.VITE_PAYME_MERCHANT_ID || '').trim()
  const clickService = String(cfg.click_service_id || env.VITE_CLICK_SERVICE_ID || '').trim()
  const clickMerchant = String(cfg.click_merchant_id || env.VITE_CLICK_MERCHANT_ID || '').trim()
  const site = (cfg.site_url || DEFAULT_SITE).replace(/\/+$/, '')
  return { cfg, payme, clickService, clickMerchant, site, enabled: !!(payme || (clickService && clickMerchant)) }
}

export function useOnlinePay(): OnlinePay {
  const settings = useRows('settings')
  return useMemo(() => readOnlinePay(settings.find((s) => s.key === 'online_pay')?.value), [settings])
}

/** O'quvchining ochiq to'lov sahifasi: /pay/<to'lov raqami>?a=<summa> */
export function payPageUrl(site: string, code: string, amount?: number): string {
  const a = Math.round(amount ?? 0)
  return `${site.replace(/\/+$/, '')}/pay/${code}${a > 0 ? `?a=${a}` : ''}`
}
