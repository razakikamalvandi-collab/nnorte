import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { customerSupabase, supabase } from '../lib/supabase'
import { User, UserRole } from '../types'

type AuthResult = { ok: boolean; error: string | null }

interface AuthContextType {
  user: User | null
  /** Sesi Supabase mentah (dipakai halaman reset password). */
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<AuthResult & { needsConfirmation: boolean }>
  signInWithGoogle: () => Promise<AuthResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  /** Klien Supabase yang dipakai. Default: klien staf. */
  client?: SupabaseClient
  /** Hanya izinkan akun dengan role `customer` (portal pelanggan). */
  customerOnly?: boolean
  /** Klien untuk mengirim email reset password. Default: `client`. */
  passwordResetClient?: SupabaseClient
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  client = supabase,
  customerOnly = false,
  passwordResetClient = client,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Role SELALU dibaca dari tabel `memberships` (dilindungi RLS), bukan dari
  // metadata/localStorage yang bisa diubah di browser. Akun tanpa membership
  // aktif (mis. pendaftar mandiri / Google) hanya menjadi `customer`.
  const loadUserFromSession = useCallback(async (authUser: any): Promise<User | null> => {
    try {
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      const { data: memberships } = await client
        .from('memberships')
        .select('*, branches(name)')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle()

      const membership = memberships as any
      const role = (membership?.role || 'customer') as UserRole

      // Portal pelanggan hanya untuk akun pelanggan. Akun staf yang masuk
      // lewat modal pelanggan langsung dikeluarkan dari sesi pelanggan.
      if (customerOnly && role !== 'customer') {
        await client.auth.signOut()
        setUser(null)
        return null
      }

      const branchId = membership?.branch_id || undefined
      const nextUser: User = {
        id: authUser.id,
        name: profile?.full_name || authUser.email || 'Pengguna',
        email: authUser.email || '',
        role,
        branchId,
        branchName: membership?.branches?.name || undefined,
        avatar: profile?.avatar_url || undefined,
        phone: profile?.phone || undefined,
        status: 'active',
        lastLogin: new Date().toISOString(),
      }

      setUser(nextUser)
      return nextUser
    } catch (err) {
      console.error('Gagal memuat sesi pengguna:', err)
      setUser(null)
      return null
    }
  }, [client, customerOnly])

  useEffect(() => {
    const initSession = async () => {
      const { data: { session: current } } = await client.auth.getSession()
      setSession(current ?? null)
      if (current?.user) {
        await loadUserFromSession(current.user)
      }
      setLoading(false)
    }
    initSession()

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession ?? null)
        // Query Supabase tidak boleh di-await langsung di dalam callback ini
        // (berisiko deadlock pada auth lock), jadi ditunda satu tick.
        setTimeout(async () => {
          if (nextSession?.user) {
            await loadUserFromSession(nextSession.user)
          } else {
            setUser(null)
          }
          setLoading(false)
        }, 0)
      }
    )

    return () => subscription.unsubscribe()
  }, [client, loadUserFromSession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })
      if (error) return { ok: false, error: error.message }
      const nextUser = data.user ? await loadUserFromSession(data.user) : null
      if (customerOnly && data.user && !nextUser) {
        return {
          ok: false,
          error: 'Akun ini tidak dapat digunakan di portal pelanggan. Silakan masuk dengan akun pelanggan.',
        }
      }
      return { ok: true, error: null }
    },
    [client, customerOnly, loadUserFromSession]
  )

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      // Pendaftaran mandiri TIDAK memberi hak staf: role ditentukan oleh
      // `memberships`, yang hanya bisa dibuat/diubah owner (lihat RLS).
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin + window.location.search,
        },
      })
      if (error) return { ok: false, error: error.message, needsConfirmation: false }
      // Email sudah terdaftar + konfirmasi email aktif -> Supabase mengembalikan user tanpa identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { ok: false, error: 'User already registered', needsConfirmation: false }
      }
      return { ok: true, error: null, needsConfirmation: !data.session }
    },
    [client]
  )

  const signInWithGoogle = useCallback(async () => {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.search },
    })
    return { ok: !error, error: error?.message || null }
  }, [client])

  const signOut = useCallback(async () => {
    await client.auth.signOut()
    setUser(null)
    setSession(null)
    setLoading(false)
  }, [client])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await passwordResetClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { ok: !error, error: error?.message || null }
  }, [passwordResetClient])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await client.auth.updateUser({ password })
    return { ok: !error, error: error?.message || null }
  }, [client])

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

/**
 * Provider khusus portal pelanggan. Memakai sesi Supabase terpisah supaya
 * login pelanggan tidak mengganggu sesi staf di dashboard, dan sebaliknya.
 * Reset password tetap memakai klien utama agar halaman /reset-password
 * (yang memakai AuthProvider utama) bisa membaca sesi pemulihan.
 */
export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider client={customerSupabase} customerOnly passwordResetClient={supabase}>
    {children}
  </AuthProvider>
)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
