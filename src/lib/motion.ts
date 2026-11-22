// Harakat (animatsiya) yordamchilari: kirish va chiqish animatsiyalari, "kamroq harakat" sozlamasi.
// Barcha davomiylik va egri chiziqlar app.css dagi --t-* va --ease-* tokenlari bilan bir xil.
import { useLayoutEffect, type RefObject } from 'react'
import { useIsFetching } from '@tanstack/react-query'

export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Foydalanuvchi tizimda "kamroq harakat"ni yoqqanmi */
export function reducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Chiqish animatsiyasi: element DOM'dan olib tashlanganda uning nusxasi o'sha joyda
 * `is-leaving` klassi bilan qoladi va CSS animatsiyasi tugagach o'chadi.
 * Shu tufayli modal qaysi yo'l bilan yopilmasin (X, Esc, "Saqlash"dan keyin) — silliq yopiladi.
 */
export function useExitAnimation(ref: RefObject<HTMLElement>, maxMs = 420) {
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentNode
    if (!el || !parent) return
    return () => {
      // StrictMode'dagi soxta "unmount"da element joyida qoladi — faqat haqiqiy o'chirishda ishlaymiz
      queueMicrotask(() => {
        if (el.isConnected || !(parent as Node).isConnected || reducedMotion()) return
        const ghost = el.cloneNode(true) as HTMLElement
        ghost.classList.add('is-leaving')
        ghost.setAttribute('aria-hidden', 'true')
        ghost.removeAttribute('id')
        ghost.style.pointerEvents = 'none'
        parent.appendChild(ghost)
        let done = false
        const remove = () => {
          if (done) return
          done = true
          ghost.remove()
        }
        ghost.addEventListener('animationend', (e) => e.target === ghost && remove())
        setTimeout(remove, maxMs)
      })
    }
  }, [ref, maxMs])
}

/** Elementni yumshoq paydo qilish (masalan, tab almashganda kontent) */
export function softEnter(el: Element | null | undefined) {
  if (!el || reducedMotion() || !(el as HTMLElement).animate) return
  ;(el as HTMLElement).animate(
    [
      { opacity: 0, transform: 'translate3d(0, 6px, 0)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 280, easing: EASE_OUT },
  )
}

/** Ma'lumot birinchi marta yuklanayaptimi (keyingi fon yangilanishlari hisobga olinmaydi) */
export function useInitialLoading(): boolean {
  return useIsFetching({ predicate: (q) => q.state.data === undefined }) > 0
}
