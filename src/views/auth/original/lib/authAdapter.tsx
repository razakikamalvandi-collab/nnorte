import { createContext, useContext, useMemo } from 'react'
import { useAuth as useNnorteAuth } from '../../../../context/AuthContext'

/**
 * Adapter: UI login original memanggil API bergaya `{ error }` (AuthContext PROYEK A),
 * sedangkan NNORTE memakai AuthContext sendiri (`{ ok, error: string }` + role dari
 * tabel `memberships`). Adapter ini menerjemahkan keduanya tanpa membuat sesi kedua.
 */

type AuthErr = { message: string } | null
const toErr = (msg: string | null | undefined): AuthErr => (msg ? { message: msg } : null)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
// Sama dengan pengecekan di login original: tolak nilai placeholder dari .env.example.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey && !supabaseUrl.includes('xxxxxxxx') && !supabaseKey.startsWith('isi-dengan'),
)

export function useAuth() {
  const auth = useNnorteAuth()
  return useMemo(
    () => ({
      session: auth.session,
      user: auth.user,
      loading: auth.loading,
      isConfigured: isSupabaseConfigured,
      signIn: async ({ email, password }: { email: string; password: string }) => {
        const r = await auth.signIn(email, password)
        return { error: toErr(r.error) }
      },
      signUp: async ({ fullName, email, password }: { fullName: string; email: string; password: string }) => {
        const r = await auth.signUp(email, password, fullName)
        return { error: toErr(r.error), needsConfirmation: r.needsConfirmation }
      },
      signInWithGoogle: async () => {
        const r = await auth.signInWithGoogle()
        return { error: toErr(r.error) }
      },
      resetPassword: async (email: string) => {
        const r = await auth.resetPassword(email)
        return { error: toErr(r.error) }
      },
      updatePassword: async (password: string) => {
        const r = await auth.updatePassword(password)
        return { error: toErr(r.error) }
      },
      signOut: async () => {
        await auth.signOut()
        return { error: null }
      },
    }),
    [auth],
  )
}

/** Navigasi ke luar halaman login (NNORTE tidak memakai router). */
export const AuthNavContext = createContext<{ goHome: () => void }>({ goHome: () => {} })
export const useAuthNav = () => useContext(AuthNavContext)
