// Ilova qulfi: ilova ochilganda yoki fondan qaytganda barmoq izi / Face ID (WebAuthn) yoki parol so'raladi.
//
// Biometrika telefonning o'zida tekshiriladi (WebAuthn, "platform authenticator"): barmoq izi yoki yuz
// tasviri hech qayerga yuborilmaydi. Biz faqat qurilma "foydalanuvchi tasdiqlandi" (UV) deb javob
// berganini tekshiramiz. Kalit identifikatori shu qurilmada, shu foydalanuvchi uchun saqlanadi.

const CRED = (uid: string) => `lola:lock:cred:${uid}`
const LAST = 'lola:lock:last' // sessionStorage: shu oynadagi oxirgi faollik (ochiq holatda)
const SHARED = 'lola:lock:shared' // localStorage: istalgan oynadagi oxirgi faollik (kompyuterda yangi tab uchun)
const CFG = 'lola:lock:cfg' // localStorage: rahbar sozlamasining oxirgi qiymati (ochilishda darhol bilish uchun)
const OFFER = 'lola:lock:offer' // sessionStorage: parol bilan kirgandan keyin biometrikani taklif qilish

/** Boshqa ochiq oyna shu vaqt ichida faol bo'lgan bo'lsa, yangi tab qulflanmaydi */
const SHARED_WINDOW_MS = 20_000

export interface LockConfig {
  enabled: boolean
  minutes: number
}
export const DEFAULT_LOCK: LockConfig = { enabled: true, minutes: 5 }

const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
  del: (k: string) => {
    try {
      sessionStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

// ─── Vaqt va holat ───────────────────────────────────────────────────────────

/** Ilova ochiq va foydalanuvchi tasdiqlangan — faollikni belgilash */
export function markActive(now = Date.now()) {
  ss.set(LAST, String(now))
  ls.set(SHARED, String(now))
}

/** Chiqishda: keyingi kirishda albatta qulf so'ralsin */
export function clearActive() {
  ss.del(LAST)
  ls.del(SHARED)
  ss.del(OFFER)
}

/**
 * Qulflash kerakmi:
 *  - shu oynada faollik yozuvi yo'q (ilova yangidan ochildi) — boshqa oyna hozirgina faol bo'lmasa, qulflanadi;
 *  - oxirgi faollikdan beri `minutes` daqiqadan ko'p vaqt o'tgan bo'lsa ("0" — fondan qaytgan zahoti).
 */
export function shouldLock(cfg: LockConfig, now = Date.now()): boolean {
  if (!cfg.enabled) return false
  const last = Number(ss.get(LAST)) || 0
  if (!last) {
    const shared = Number(ls.get(SHARED)) || 0
    return !(shared && now - shared < SHARED_WINDOW_MS)
  }
  return now - last > Math.max(0, cfg.minutes) * 60_000
}

export function cachedConfig(): LockConfig {
  try {
    const v = JSON.parse(ls.get(CFG) || 'null')
    if (v && typeof v.enabled === 'boolean') return { enabled: v.enabled, minutes: Number(v.minutes) >= 0 ? Number(v.minutes) : DEFAULT_LOCK.minutes }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCK
}
export function cacheConfig(cfg: LockConfig) {
  ls.set(CFG, JSON.stringify(cfg))
}

/** Markaz sozlamasidan (settings.center) qulf sozlamasini o'qish */
export function configFromCenter(value: unknown): LockConfig {
  const v = (value ?? {}) as { app_lock?: boolean; lock_minutes?: number }
  return {
    enabled: v.app_lock !== false,
    minutes: typeof v.lock_minutes === 'number' && v.lock_minutes >= 0 ? v.lock_minutes : DEFAULT_LOCK.minutes,
  }
}

export const requestOffer = () => ss.set(OFFER, '1')
// O'qish va o'chirish alohida: React StrictMode'da boshlang'ich qiymat ikki marta hisoblanadi
export const offerPending = () => ss.get(OFFER) === '1'
export const clearOffer = () => ss.del(OFFER)

// ─── Biometrika (WebAuthn) ──────────────────────────────────────────────────

function b64url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): ArrayBuffer {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer as ArrayBuffer
}
const challenge = (): ArrayBuffer => crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer

/** Qurilmada barmoq izi / Face ID / ekran qulfi bilan tasdiqlash mumkinmi */
export async function biometricAvailable(): Promise<boolean> {
  try {
    if (!window.isSecureContext || !window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export const isEnrolled = (uid: string) => !!ls.get(CRED(uid))
export const removeEnrollment = (uid: string) => ls.del(CRED(uid))

/** Shu qurilmada biometrikani ulash (bir marta). Telefon barmoq izi yoki Face ID so'raydi. */
export async function enroll(user: { id: string; email?: string | null; full_name: string }): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'Lola Edu', id: location.hostname },
      user: { id: new TextEncoder().encode(user.id).buffer as ArrayBuffer, name: user.email || user.full_name, displayName: `${user.full_name} — Lola Edu` },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('cancelled')
  ls.set(CRED(user.id), b64url(cred.rawId))
}

/** "Foydalanuvchi tasdiqlandi" bayrog'i (authenticatorData, 32-bayt, UV = 0x04) */
export function userVerified(authData: ArrayBuffer): boolean {
  const a = new Uint8Array(authData)
  return a.length > 32 && (a[32] & 0x04) !== 0
}

/** Barmoq izi / Face ID bilan tasdiqlash. true — tasdiqlandi. */
export async function verifyBiometric(uid: string, signal?: AbortSignal): Promise<boolean> {
  const id = ls.get(CRED(uid))
  if (!id) return false
  const res = (await navigator.credentials.get({
    signal,
    publicKey: {
      challenge: challenge(),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64url(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!res) return false
  return userVerified((res.response as AuthenticatorAssertionResponse).authenticatorData)
}

/** Brauzer xatosini tushunarli turga ajratish */
export function biometricErrorKind(e: unknown): 'cancelled' | 'unavailable' | 'other' {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'AbortError') return 'cancelled'
  if (name === 'NotSupportedError' || name === 'SecurityError' || name === 'InvalidStateError') return 'unavailable'
  return 'other'
}
