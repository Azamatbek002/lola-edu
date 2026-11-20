// Ilova qulfi: qachon qulflanishi va biometrik javobni tekshirish (src/lib/applock.ts)
import { beforeEach, describe, expect, it } from 'vitest'
import { cacheConfig, cachedConfig, clearActive, configFromCenter, DEFAULT_LOCK, markActive, shouldLock, userVerified } from './applock'

class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}
const g = globalThis as unknown as { sessionStorage: MemStorage; localStorage: MemStorage }

const T = 1_800_000_000_000
const MIN = 60_000

beforeEach(() => {
  g.sessionStorage = new MemStorage()
  g.localStorage = new MemStorage()
})

describe('qachon qulflanadi', () => {
  it("ilova yangidan ochilganda (faollik yozuvi yo'q) — qulflanadi", () => {
    expect(shouldLock({ enabled: true, minutes: 5 }, T)).toBe(true)
  })
  it("rahbar o'chirgan bo'lsa — hech qachon", () => {
    expect(shouldLock({ enabled: false, minutes: 5 }, T)).toBe(false)
  })
  it('belgilangan vaqtdan oldin qaytsa — qulflanmaydi, keyin — qulflanadi', () => {
    markActive(T)
    expect(shouldLock({ enabled: true, minutes: 5 }, T + 4 * MIN)).toBe(false)
    expect(shouldLock({ enabled: true, minutes: 5 }, T + 5 * MIN + 1)).toBe(true)
  })
  it('"Darhol" — fondan qaytgan zahoti qulflanadi', () => {
    markActive(T)
    expect(shouldLock({ enabled: true, minutes: 0 }, T + 1500)).toBe(true)
  })
  it('kompyuterda yangi tab: boshqa oyna hozirgina faol bo\'lsa — qulflanmaydi', () => {
    markActive(T)
    g.sessionStorage = new MemStorage() // yangi tab — o'z sessionStorage'i bo'sh
    expect(shouldLock({ enabled: true, minutes: 5 }, T + 10_000)).toBe(false)
    expect(shouldLock({ enabled: true, minutes: 5 }, T + 25_000)).toBe(true)
  })
  it('chiqishdan keyin — albatta qulflanadi', () => {
    markActive(T)
    clearActive()
    expect(shouldLock({ enabled: true, minutes: 60 }, T + 1000)).toBe(true)
  })
})

describe('sozlama', () => {
  it('markaz sozlamasidan o\'qish (standart: yoqilgan, 5 daqiqa)', () => {
    expect(configFromCenter(undefined)).toEqual(DEFAULT_LOCK)
    expect(configFromCenter({ app_lock: false })).toEqual({ enabled: false, minutes: 5 })
    expect(configFromCenter({ app_lock: true, lock_minutes: 0 })).toEqual({ enabled: true, minutes: 0 })
    expect(configFromCenter({ lock_minutes: -3 })).toEqual(DEFAULT_LOCK)
  })
  it('oxirgi qiymat ochilishda darhol ishlatiladi', () => {
    expect(cachedConfig()).toEqual(DEFAULT_LOCK)
    cacheConfig({ enabled: false, minutes: 15 })
    expect(cachedConfig()).toEqual({ enabled: false, minutes: 15 })
  })
})

describe('biometrik javob', () => {
  const authData = (flags: number) => {
    const a = new Uint8Array(37)
    a[32] = flags
    return a.buffer
  }
  it('faqat "foydalanuvchi tasdiqlandi" (UV) bayrog\'i bo\'lsa qabul qilinadi', () => {
    expect(userVerified(authData(0x01 | 0x04))).toBe(true) // UP + UV
    expect(userVerified(authData(0x01))).toBe(false) // faqat UP (tasdiqlanmagan)
    expect(userVerified(new Uint8Array(10).buffer)).toBe(false)
  })
})
