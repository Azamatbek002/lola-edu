import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'
import { dict, type DictKey } from './dict'
import { setFormatLang } from '../format'

const IDX: Record<Lang, number> = { uz: 0, ru: 1, tr: 2 }
export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
]

export type T = (key: DictKey | string, fallback?: string) => string

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: T
}

const I18nCtx = createContext<Ctx>(null as any)

function initialLang(): Lang {
  try {
    const s = localStorage.getItem('lola:lang') as Lang | null
    if (s && s in IDX) return s
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'uz'
  return nav === 'ru' ? 'ru' : nav === 'tr' ? 'tr' : 'uz'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang()
    setFormatLang(l)
    return l
  })
  const setLang = useCallback((l: Lang) => {
    setFormatLang(l)
    setLangState(l)
    document.documentElement.lang = l
    try {
      localStorage.setItem('lola:lang', l)
    } catch {
      /* ignore */
    }
  }, [])
  const t = useCallback<T>(
    (key, fallback) => {
      const entry = (dict as Record<string, readonly string[]>)[key]
      return entry ? entry[IDX[lang]] : fallback ?? key
    },
    [lang],
  )
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
export const useT = () => useContext(I18nCtx).t
