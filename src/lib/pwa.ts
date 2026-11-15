// Ilovani telefonga o'rnatish (PWA). Brauzer "beforeinstallprompt" hodisasini sahifa
// ochilishi bilan yuboradi, shuning uchun uni main.tsx da darhol ushlab qolamiz.
import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function initInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ o'zini Mac deb ko'rsatadi
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Qanday o'rnatish mumkin:
 *  - 'prompt'  — Android/Chrome/Edge: brauzerning o'z oynasi
 *  - 'ios'     — iPhone/iPad Safari: qo'lda "Bosh ekranga qo'shish" (yo'riqnoma ko'rsatiladi)
 *  - null      — allaqachon o'rnatilgan yoki brauzer qo'llamaydi
 */
export function useInstallMode(): 'prompt' | 'ios' | null {
  const hasPrompt = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => deferred !== null,
    () => false,
  )
  if (isStandalone()) return null
  if (hasPrompt) return 'prompt'
  if (isIOS()) return 'ios'
  return null
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  await e.prompt()
  const { outcome } = await e.userChoice
  deferred = null
  emit()
  return outcome === 'accepted'
}

// ─── Yangilanishlar ─────────────────────────────────────────────────────────
// Yangi versiya chiqqanda: service worker uni fonda yuklab oladi va sahifa o'zi
// qayta ochiladi. Telefonda ilova odatda yopilmaydi (fonda turadi), shuning uchun
// ilovaga qaytilganda va har 30 daqiqada yangi versiya tekshiriladi.
/** Ilova versiyasi: qurilgan sana va commit (vite.config.ts → define) */
export const APP_VERSION: string = __APP_VERSION__

const busy = () => !!document.querySelector('.modal') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')

export function initServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      if (!r) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine && !busy()) r.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, 30 * 60 * 1000)
    },
  })
}

/** "Yangilash" tugmasi: eski keshni tozalab, eng yangi versiyani yuklaydi */
export async function hardRefresh() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } finally {
    window.location.reload()
  }
}
