import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, supabase } from './db'
import type { Profile } from './types'
import { seesAllBranches } from './permissions'
import { normalizePhone } from './format'

interface AuthCtx {
  user: Profile | null
  ready: boolean
  login: (login: string, password: string) => Promise<boolean>
  demoLogin: (profileId: string) => Promise<void>
  logout: () => Promise<void>
  /** Hozir tanlangan filial (null — barcha filiallar) */
  branchId: string | null
  setBranchId: (id: string | null) => void
  canSwitchBranch: boolean
}

const Ctx = createContext<AuthCtx>(null as any)
const KEY = 'lola:demo-user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [branchOverride, setBranchOverride] = useState<string | null>(null)

  const loadProfile = useCallback(async (id: string) => {
    const all = await db.list('profiles')
    const p = all.find((x) => x.id === id && x.is_active) || null
    setUser(p)
    return p
  }, [])

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (data.session) await loadProfile(data.session.user.id)
        setReady(true)
      })
      const { data } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!session) setUser(null)
      })
      return () => data.subscription.unsubscribe()
    }
    let id: string | null = null
    try {
      id = localStorage.getItem(KEY)
    } catch {
      /* ignore */
    }
    ;(id ? loadProfile(id) : Promise.resolve(null)).finally(() => setReady(true))
  }, [loadProfile])

  const login = useCallback(
    async (loginStr: string, password: string) => {
      if (supabase) {
        // Telefon raqam bilan kirish: telefon → email (profiles jadvalidan)
        let email = loginStr.trim()
        if (!email.includes('@')) {
          const { data } = await supabase.rpc('email_by_phone', { p_phone: normalizePhone(email) })
          if (!data) return false
          email = data as string
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error || !data.user) return false
        return !!(await loadProfile(data.user.id))
      }
      // Demo: istalgan parol, email/telefon bo'yicha
      const all = await db.list('profiles')
      const s = loginStr.trim().toLowerCase()
      const p = all.find((x) => x.email?.toLowerCase() === s || (x.phone && normalizePhone(x.phone) === normalizePhone(s)))
      if (!p || !password) return false
      try {
        localStorage.setItem(KEY, p.id)
      } catch {
        /* ignore */
      }
      setUser(p)
      return true
    },
    [loadProfile],
  )

  const demoLogin = useCallback(
    async (id: string) => {
      try {
        localStorage.setItem(KEY, id)
      } catch {
        /* ignore */
      }
      await loadProfile(id)
    },
    [loadProfile],
  )

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    setBranchOverride(null)
    setUser(null)
  }, [])

  const canSwitchBranch = !!user && seesAllBranches(user.role)
  const branchId = canSwitchBranch ? branchOverride : user?.branch_id ?? null

  const value = useMemo(
    () => ({ user, ready, login, demoLogin, logout, branchId, setBranchId: setBranchOverride, canSwitchBranch }),
    [user, ready, login, demoLogin, logout, branchId, canSwitchBranch],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

/** Joriy foydalanuvchi (himoyalangan sahifalarda doim mavjud) */
export function useMe(): Profile {
  const { user } = useAuth()
  if (!user) throw new Error('Not authenticated')
  return user
}

/** Filial bo'yicha filtr */
export function useBranchFilter() {
  const { branchId } = useAuth()
  return useCallback(<R extends { branch_id?: string | null }>(rows: R[]) => (branchId ? rows.filter((r) => !r.branch_id || r.branch_id === branchId) : rows), [branchId])
}
