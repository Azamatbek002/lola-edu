// Ilovani telefonga o'rnatish (PWA). Brauzer "beforeinstallprompt" hodisasini sahifa
// ochilishi bilan yuboradi, shuning uchun uni main.tsx da darhol ushlab qolamiz.
import { useSyncExternalStore } from 'react'

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
