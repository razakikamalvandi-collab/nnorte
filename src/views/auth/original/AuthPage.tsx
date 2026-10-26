import { useEffect, useState } from 'react'
import AuthForm from './components/AuthForm'
import Brand from './components/Brand'
import Cafe3DLazy from './components/Cafe3DLazy'
import ThemeToggle from './components/ThemeToggle'
import useButtonTilt from './lib/useButtonTilt'
import { AuthNavContext, isSupabaseConfigured } from './lib/authAdapter'
import './login-original.css'

const MODES = ['login', 'register', 'forgot'] as const
type Mode = (typeof MODES)[number]

export function Splash({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="nn-auth-root">
      <div className="splash" role="status" aria-live="polite">
        <span className="spinner spinner-lg" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </div>
  )
}

function readMode(): Mode {
  const raw = new URLSearchParams(window.location.search).get('mode')
  return (MODES as readonly string[]).includes(raw ?? '') ? (raw as Mode) : 'login'
}

/** Halaman autentikasi original (login / daftar / lupa password), markup identik dengan Auth.jsx. */
export default function AuthPage({ onGoToCustomer }: { onGoToCustomer: () => void }) {
  const [mode, setMode] = useState<Mode>(readMode)
  useButtonTilt()

  // Pindah mode tanpa reload; ?mode= tetap disinkronkan seperti di login original.
  const changeMode = (next: Mode) => {
    setMode(next)
    const url = new URL(window.location.href)
    url.searchParams.set('mode', next)
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    const onPop = () => setMode(readMode())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <AuthNavContext.Provider value={{ goHome: onGoToCustomer }}>
      <div className="nn-auth-root">
        <div className="page-transition">
          <AuthLayout mode={mode} onModeChange={changeMode} />
        </div>
      </div>
    </AuthNavContext.Provider>
  )
}

function AuthLayout({ mode, onModeChange }: { mode: Mode; onModeChange: (m: Mode) => void }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <Brand size="lg" />
        </div>
        <div className="auth-brand-scene">
          <Cafe3DLazy fill />
        </div>
      </aside>

      <section className="auth-panel" aria-label="Autentikasi">
        <div className="auth-panel-top">
          <ThemeToggle />
        </div>

        <div className="auth-panel-body">
          {!isSupabaseConfigured && (
            <div className="alert alert-warn" role="alert">
              <strong>Supabase belum dikonfigurasi.</strong> Salin <code>.env.example</code> menjadi <code>.env.local</code>,
              isi URL dan anon key proyek Anda, lalu jalankan ulang <code>npm run dev</code>.
            </div>
          )}
          <AuthForm mode={mode} onModeChange={onModeChange} />
        </div>
      </section>
    </div>
  )
}
