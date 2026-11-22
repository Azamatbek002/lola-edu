// Ilova qulfi: ochilganda yoki fondan qaytganda barmoq izi / Face ID yoki parol so'raydi.
// Mantiq va WebAuthn: src/lib/applock.ts. Sozlama: Sozlamalar → Xavfsizlik (rahbar). Shaxsiy: Profil → Ilova qulfi.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth, useMe } from '@/lib/auth'
import { useRows } from '@/lib/data'
import { db, supabase } from '@/lib/db'
import { useT } from '@/lib/i18n'
import { useExitAnimation } from '@/lib/motion'
import {
  biometricAvailable,
  biometricErrorKind,
  cacheConfig,
  cachedConfig,
  configFromCenter,
  enroll as enrollDevice,
  isEnrolled,
  markActive,
  removeEnrollment,
  shouldLock,
  clearOffer,
  offerPending,
  verifyBiometric,
  type LockConfig,
} from '@/lib/applock'
import { Avatar, Badge, Button, Card, Modal } from './ui'
import { useToast } from './Toast'
import { Eye, EyeSlash, Fingerprint, LockSimple } from './icons'

interface LockCtx {
  /** Qulf shu foydalanuvchi uchun ishlayaptimi (demo va o'chirilgan holatda — yo'q) */
  active: boolean
  locked: boolean
  config: LockConfig
  available: boolean
  enrolled: boolean
  enroll: () => Promise<boolean>
  remove: () => void
  lockNow: () => void
}
const Ctx = createContext<LockCtx | null>(null)
export const useAppLock = () => useContext(Ctx)

const MAX_TRIES = 5

export function AppLockProvider({ children }: { children: ReactNode }) {
  const me = useMe()
  const { logout } = useAuth()
  const t = useT()
  const toast = useToast()
  const center = useRows('settings').find((s) => s.key === 'center')

  const [config, setConfig] = useState<LockConfig>(cachedConfig)
  useEffect(() => {
    if (!center) return
    const c = configFromCenter(center.value)
    setConfig(c)
    cacheConfig(c)
  }, [center])
  const active = config.enabled

  // Ochilishda darhol (birinchi kadrdan) qaror qilinadi — ilova mazmuni qulfsiz ko'rinib qolmaydi
  const [locked, setLocked] = useState(() => shouldLock(cachedConfig()))
  const [available, setAvailable] = useState(false)
  const [enrolled, setEnrolled] = useState(() => isEnrolled(me.id))
  const [offer, setOffer] = useState(false)
  const wantsOffer = useRef(offerPending())

  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    biometricAvailable().then(setAvailable)
  }, [])

  // Rahbar qulfni o'chirsa — darhol ochiladi
  useEffect(() => {
    if (!active && locked) {
      markActive()
      setLocked(false)
    }
  }, [active, locked])

  // Faollikni yozib borish; fondan qaytganda vaqtni tekshirish
  useEffect(() => {
    if (!active) return
    if (!lockedRef.current) markActive()
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (!lockedRef.current) markActive()
      } else if (!lockedRef.current && shouldLock(configRef.current)) {
        setLocked(true)
      }
    }
    const onHide = () => !lockedRef.current && markActive()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    const iv = setInterval(() => {
      if (!lockedRef.current && document.visibilityState === 'visible') markActive()
    }, 15_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      clearInterval(iv)
    }
  }, [active])

  // Parol bilan kirgandan keyin — biometrikani bir marta taklif qilish
  useEffect(() => {
    if (wantsOffer.current && available && active && !locked && !isEnrolled(me.id)) {
      wantsOffer.current = false
      clearOffer()
      setOffer(true)
    }
  }, [available, active, locked, me.id])

  const unlock = useCallback((viaPassword?: boolean) => {
    markActive()
    // Parol bilan ochdi va bu qurilmada biometrika hali ulanmagan — yoqishni taklif qilamiz
    if (viaPassword && !isEnrolled(me.id)) wantsOffer.current = true
    setLocked(false)
  }, [me.id])

  const enroll = useCallback(async () => {
    try {
      await enrollDevice(me)
      setEnrolled(true)
      toast.success(t('lock.enabled'))
      return true
    } catch (e) {
      if (biometricErrorKind(e) !== 'cancelled') toast.error(t('lock.bioFailed'))
      return false
    }
  }, [me, toast, t])

  const remove = useCallback(() => {
    removeEnrollment(me.id)
    setEnrolled(false)
  }, [me.id])

  const lockNow = useCallback(() => setLocked(true), [])

  // Qulf paytida orqadagi ilova bilan ishlab (Tab bilan o'tib) bo'lmaydi
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.toggleAttribute('inert', locked)
    if (locked) el.setAttribute('aria-hidden', 'true')
    else el.removeAttribute('aria-hidden')
  }, [locked])

  const value = useMemo(() => ({ active, locked, config, available, enrolled, enroll, remove, lockNow }), [active, locked, config, available, enrolled, enroll, remove, lockNow])

  return (
    <Ctx.Provider value={value}>
      <div ref={host} style={{ display: 'contents' }}>
        {children}
      </div>
      {/* Shu qurilmada ulangan bo'lsa — biometrika darhol taklif qilinadi (mavjudlik tekshiruvi kutilmaydi) */}
      {locked && active && <LockScreen enrolled={enrolled} onUnlock={unlock} onLogout={logout} onBiometricGone={remove} />}
      {offer && !locked && (
        <BiometricOffer
          onClose={() => setOffer(false)}
          onEnable={async () => {
            if (await enroll()) setOffer(false)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

/** Hisob parolini tekshirish (Supabase). Muvaffaqiyatda sessiya ham yangilanadi. */
async function checkPassword(email: string | null | undefined, password: string): Promise<'ok' | 'invalid' | 'network'> {
  // Demo rejim (Play tekshiruvchisi): haqiqiy hisob yo'q — demo kirishdagidek istalgan parol qabul qilinadi
  if (db.mode === 'demo') return password ? 'ok' : 'invalid'
  if (!supabase || !email) return 'invalid'
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return 'ok'
    const msg = error.message || ''
    if (/failed to fetch|network|load failed/i.test(msg)) return 'network'
    return 'invalid'
  } catch {
    return 'network'
  }
}

function LockScreen({ enrolled, onUnlock, onLogout, onBiometricGone }: { enrolled: boolean; onUnlock: (viaPassword?: boolean) => void; onLogout: () => void; onBiometricGone: () => void }) {
  const t = useT()
  const me = useMe()
  const ref = useRef<HTMLDivElement>(null)
  useExitAnimation(ref, 700)
  const [mode, setMode] = useState<'bio' | 'pw'>(enrolled ? 'bio' : 'pw')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const tries = useRef(0)
  const pwRef = useRef<HTMLInputElement>(null)
  // Bir vaqtda faqat bitta so'rov: yangisi boshlanganda yoki ekran yopilganda oldingisi bekor qilinadi
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const bio = useCallback(
    async (auto: boolean) => {
      pending.current?.abort()
      const ctrl = new AbortController()
      pending.current = ctrl
      setErr('')
      setBusy(true)
      try {
        if (await verifyBiometric(me.id, ctrl.signal)) return onUnlock()
        if (!auto) setErr(t('lock.bioFailed'))
      } catch (e) {
        if (ctrl.signal.aborted) return
        const kind = biometricErrorKind(e)
        // Kalit bu qurilmada endi yo'q (masalan, domen o'zgardi) — parolga o'tamiz va qayta ulashni taklif qilamiz
        if (kind === 'unavailable') {
          onBiometricGone()
          setMode('pw')
        }
        if (!auto) setErr(kind === 'cancelled' ? t('lock.bioCancelled') : t('lock.bioFailed'))
      } finally {
        if (pending.current === ctrl) {
          pending.current = null
          setBusy(false)
        }
      }
    },
    [me.id, onUnlock, onBiometricGone, t],
  )

  // Ekran chiqqach barmoq izi so'rovi o'zi ochiladi (iPhone'da tugmani bosish kerak bo'lishi mumkin)
  useEffect(() => {
    if (mode !== 'bio') return
    const id = setTimeout(() => bio(true), 380)
    return () => clearTimeout(id)
  }, []) // faqat ekran birinchi chiqqanda

  useEffect(() => {
    if (mode === 'pw') setTimeout(() => pwRef.current?.focus({ preventScroll: true }), 60)
  }, [mode])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setErr('')
    const res = await checkPassword(me.email, pw)
    setBusy(false)
    if (res === 'ok') return onUnlock(true)
    if (res === 'network') return setErr(t('login.network'))
    tries.current += 1
    setPw('')
    if (tries.current >= MAX_TRIES) return onLogout()
    setErr(t('lock.wrongPw').replace('{n}', String(MAX_TRIES - tries.current)))
  }

  return createPortal(
    <div className="lock-screen" ref={ref} role="dialog" aria-modal="true" aria-label={t('lock.title')}>
      <div className="lock-card">
        <div className="lock-brand">
          <img src="/logo.svg" alt="" />
          <span>Lola Edu</span>
        </div>
        <Avatar name={me.full_name} size="lg" />
        <div>
          <h2>{t('lock.hello').replace('{name}', me.full_name.split(' ')[0])}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>{t('lock.hint')}</p>
        </div>

        {mode === 'bio' ? (
          <>
            <button type="button" className={'lock-bio' + (busy ? ' busy' : '')} onClick={() => bio(false)} aria-label={t('lock.bio')}>
              <Fingerprint size={46} weight="light" />
            </button>
            <div className="small bold">{t('lock.bio')}</div>
            {err && <div className="lock-err">{err}</div>}
            <button type="button" className="lock-link" onClick={() => { pending.current?.abort(); setErr(''); setMode('pw') }}>
              {t('lock.usePw')}
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="lock-form">
            <div className="pw-wrap">
              <input
                ref={pwRef}
                className="input"
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={t('login.password')}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('login.password')}
              />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={t(show ? 'login.hidePw' : 'login.showPw')}>
                {show ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {err && <div className="lock-err">{err}</div>}
            <Button variant="primary" block type="submit" disabled={!pw || busy} icon={<LockSimple size={16} />}>
              {busy ? t('common.loading') : t('lock.unlock')}
            </Button>
            {enrolled && (
              <button type="button" className="lock-link" onClick={() => { setErr(''); setMode('bio'); bio(false) }}>
                <Fingerprint size={16} /> {t('lock.useBio')}
              </button>
            )}
          </form>
        )}

        <button type="button" className="lock-link muted" onClick={onLogout}>
          {t('lock.other')}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function BiometricOffer({ onClose, onEnable }: { onClose: () => void; onEnable: () => void }) {
  const t = useT()
  return (
    <Modal
      title={t('lock.offerTitle')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('lock.later')}</Button>
          <Button variant="primary" icon={<Fingerprint size={17} />} onClick={onEnable}>
            {t('lock.enable')}
          </Button>
        </>
      }
    >
      <div className="lock-offer">
        <span className="lock-offer-ico">
          <Fingerprint size={40} weight="light" />
        </span>
        <p>{t('lock.offerText')}</p>
      </div>
    </Modal>
  )
}

/** Profil sahifasi: shu qurilmadagi qulf holati */
export function AppLockCard() {
  const t = useT()
  const lock = useAppLock()
  if (!lock) return null
  const { active, config, available, enrolled, enroll, remove, lockNow } = lock
  return (
    <Card pad>
      <div className="row between mb" style={{ marginBottom: 10 }}>
        <div className="bold row" style={{ gap: 8 }}>
          <LockSimple size={18} /> {t('lock.card')}
        </div>
        <Badge tone={active ? 'green' : 'gray'}>{active ? t('set.connected') : t('set.notConnected')}</Badge>
      </div>
      {active ? (
        <p className="small muted">
          {t('lock.statusOn')} {config.minutes === 0 ? t('lock.afterNow') : t('lock.after').replace('{m}', String(config.minutes))}
        </p>
      ) : (
        <p className="small muted">{t('lock.statusOff')}</p>
      )}
      {active && (
        <>
          <div className="divider" />
          {available ? (
            enrolled ? (
              <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <span className="row small bold" style={{ gap: 8 }}>
                  <Fingerprint size={20} className="brand" /> {t('lock.connected')}
                </span>
                <Button size="sm" variant="ghost" onClick={remove}>
                  {t('lock.remove')}
                </Button>
              </div>
            ) : (
              <Button variant="primary" icon={<Fingerprint size={17} />} onClick={enroll}>
                {t('lock.connect')}
              </Button>
            )
          ) : (
            <p className="small muted">{t('lock.noBio')}</p>
          )}
          <Button className="mt" icon={<LockSimple size={16} />} onClick={lockNow}>
            {t('lock.lockNow')}
          </Button>
        </>
      )}
    </Card>
  )
}
