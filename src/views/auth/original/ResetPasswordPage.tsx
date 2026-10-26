import React, { useState } from 'react'
import Brand from './components/Brand'
import ThemeToggle from './components/ThemeToggle'
import { Splash } from './AuthPage'
import { AuthNavContext, useAuth } from './lib/authAdapter'
import './login-original.css'
import { translateAuthError } from './lib/authErrors'

// Halaman tujuan tautan "reset password" dari email. Supabase otomatis membuat sesi pemulihan dari URL.
export default function ResetPasswordPage({ onGoToCustomer }: { onGoToCustomer: () => void }) {
  const { session, loading, updatePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) return <Splash label="Memverifikasi tautan…" />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password minimal 8 karakter.')
    if (password !== confirm) return setError('Konfirmasi password tidak sama dengan password.')
    setError('')
    setBusy(true)
    const { error: err } = await updatePassword(password)
    setBusy(false)
    if (err) return setError(translateAuthError(err))
    setDone(true)
    setTimeout(() => window.location.replace('/'), 1600)
  }

  return (
    <AuthNavContext.Provider value={{ goHome: onGoToCustomer }}>
    <div className="nn-auth-root"><div className="center-page">
      <header className="topbar">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="center-card">
        {!session ? (
          <div className="auth-form">
            <h2>Tautan tidak valid</h2>
            <p>Tautan reset password sudah kedaluwarsa atau sudah dipakai. Minta tautan baru dari halaman masuk.</p>
            <a href="/?mode=forgot" className="btn btn-primary btn-block">
              Minta tautan baru
            </a>
          </div>
        ) : done ? (
          <div className="auth-form auth-done" role="status">
            <h2>Password diperbarui</h2>
            <p>Password baru Anda tersimpan. Mengarahkan ke dashboard…</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <header className="form-head">
              <h2>Buat password baru</h2>
              <p>Masukkan password baru untuk akun {session.user.email}.</p>
            </header>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="field">
              <label htmlFor="new-password">Password baru</label>
              <div className="field-control">
                <input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={show}
                >
                  {show ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirm-new-password">Konfirmasi password baru</label>
              <div className="field-control">
                <input
                  id="confirm-new-password"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ulangi password"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? (<><span className="spinner" aria-hidden="true" />Menyimpan…</>) : 'Simpan password baru'}
            </button>
            <p className="switch-text">
              <button type="button" className="link-btn" onClick={async () => {
                  await signOut()
                  window.location.replace('/')
                }}>
                Batalkan dan keluar
              </button>
            </p>
          </form>
        )}
      </main>
    </div></div>
    </AuthNavContext.Provider>
  )
}
