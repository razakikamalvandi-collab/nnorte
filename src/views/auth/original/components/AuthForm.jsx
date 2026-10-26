import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/authAdapter'
import { EMAIL_REGEX, translateAuthError } from '../lib/authErrors'

const MIN_PASSWORD = 8

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function EyeIcon({ off }) {
  return off ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Field({ id, label, type = 'text', value, onChange, error, autoComplete, placeholder, inputRef, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {children}
      </div>
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function PasswordField({ id, label, value, onChange, error, autoComplete, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <Field
      id={id}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      error={error}
      autoComplete={autoComplete}
      placeholder={placeholder}
    >
      <button
        type="button"
        className="eye-btn"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={show}
      >
        <EyeIcon off={show} />
      </button>
    </Field>
  )
}

function Alert({ kind, children }) {
  if (!children) return null
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div className="divider" aria-hidden="true">
      <span>atau</span>
    </div>
  )
}

function SubmitButton({ loading, children, loadingText }) {
  return (
    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}

function GoogleButton({ label, onClick, loading, disabled }) {
  return (
    <button type="button" className="btn btn-google btn-block" onClick={onClick} disabled={disabled}>
      {loading ? <span className="spinner spinner-dark" aria-hidden="true" /> : <GoogleIcon />}
      {label}
    </button>
  )
}

/* ---------------------------- LOGIN ---------------------------- */
export function LoginForm({ onMode, embedded = false, onSuccess }) {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    // Di beranda (embedded) fokus tidak dipaksa agar halaman tidak melompat saat dibuka.
    if (!embedded) emailRef.current?.focus({ preventScroll: true })
  }, [embedded])

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!email.trim()) next.email = 'Email wajib diisi.'
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Format email tidak valid. Contoh: nama@email.com'
    if (!password) next.password = 'Password wajib diisi.'
    setErrors(next)
    setStatus(null)
    if (Object.keys(next).length) return

    setBusy(true)
    const { error } = await signIn({ email: email.trim(), password })
    setBusy(false)
    if (error) setStatus({ kind: 'error', text: translateAuthError(error) })
    else onSuccess?.()
    // Jika berhasil, sesi berubah dan halaman otomatis diarahkan ke dashboard.
  }

  const google = async () => {
    setStatus(null)
    setGoogleBusy(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setGoogleBusy(false)
      setStatus({ kind: 'error', text: translateAuthError(error) })
    }
    // Jika berhasil, browser diarahkan ke Google.
  }

  return (
    <form onSubmit={submit} noValidate className={`auth-form ${embedded ? 'auth-form-embedded' : ''}`}>
      {!embedded && (
        <header className="form-head">
          <h2>Selamat datang kembali</h2>
          <p>Masuk untuk mengelola reservasi dan akun NNORTE Anda.</p>
        </header>
      )}

      <Alert kind={status?.kind}>{status?.text}</Alert>

      <Field
        id="login-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
        placeholder="nama@email.com"
        inputRef={emailRef}
      />
      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        autoComplete="current-password"
        placeholder="Masukkan password"
      />

      <div className="form-row-end">
        <button type="button" className="link-btn" onClick={() => onMode('forgot')}>
          Lupa Password?
        </button>
      </div>

      <SubmitButton loading={busy} loadingText="Memproses…">
        Masuk
      </SubmitButton>
      <Divider />
      <GoogleButton label="Masuk dengan Google" onClick={google} loading={googleBusy} disabled={busy || googleBusy} />

      <p className="switch-text">
        Belum punya akun?{' '}
        <button type="button" className="link-btn strong" onClick={() => onMode('register')}>
          Daftar sekarang
        </button>
      </p>
    </form>
  )
}

/* --------------------------- REGISTER -------------------------- */
function RegisterForm({ onMode }) {
  const { signUp, signInWithGoogle } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [done, setDone] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (fullName.trim().length < 2) next.fullName = 'Nama lengkap minimal 2 karakter.'
    if (!email.trim()) next.email = 'Email wajib diisi.'
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Format email tidak valid. Contoh: nama@email.com'
    if (password.length < MIN_PASSWORD) next.password = `Password minimal ${MIN_PASSWORD} karakter.`
    if (!confirm) next.confirm = 'Konfirmasi password wajib diisi.'
    else if (confirm !== password) next.confirm = 'Konfirmasi password tidak sama dengan password.'
    setErrors(next)
    setStatus(null)
    if (Object.keys(next).length) return

    setBusy(true)
    const { error, needsConfirmation } = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    })
    setBusy(false)

    if (error) {
      setStatus({ kind: 'error', text: translateAuthError(error) })
      return
    }
    if (needsConfirmation) {
      setDone({ email: email.trim() })
      setPassword('')
      setConfirm('')
    } else {
      setStatus({ kind: 'success', text: 'Akun berhasil dibuat. Mengarahkan ke dashboard…' })
    }
  }

  const google = async () => {
    setStatus(null)
    setGoogleBusy(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setGoogleBusy(false)
      setStatus({ kind: 'error', text: translateAuthError(error) })
    }
  }

  if (done) {
    return (
      <div className="auth-form auth-done" role="status">
        <div className="done-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </div>
        <h2>Periksa email Anda</h2>
        <p>
          Kami mengirim tautan konfirmasi ke <strong>{done.email}</strong>. Klik tautan tersebut untuk mengaktifkan akun,
          lalu masuk. Jika tidak ada, cek folder spam.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => onMode('login')}>
          Ke halaman masuk
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="auth-form">
      <header className="form-head">
        <h2>Buat akun baru</h2>
        <p>Gabung dengan NNORTE Coffee &amp; Hangout dan reservasi tempat dengan mudah.</p>
      </header>

      <Alert kind={status?.kind}>{status?.text}</Alert>

      <Field
        id="reg-name"
        label="Nama lengkap"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errors.fullName}
        autoComplete="name"
        placeholder="Nama Anda"
        inputRef={nameRef}
      />
      <Field
        id="reg-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
        placeholder="nama@email.com"
      />
      <PasswordField
        id="reg-password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        autoComplete="new-password"
        placeholder={`Minimal ${MIN_PASSWORD} karakter`}
      />
      <PasswordField
        id="reg-confirm"
        label="Konfirmasi password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
        autoComplete="new-password"
        placeholder="Ulangi password"
      />

      <SubmitButton loading={busy} loadingText="Mendaftarkan…">
        Daftar Sekarang
      </SubmitButton>
      <Divider />
      <GoogleButton label="Daftar dengan Google" onClick={google} loading={googleBusy} disabled={busy || googleBusy} />

      <p className="switch-text">
        Sudah punya akun?{' '}
        <button type="button" className="link-btn strong" onClick={() => onMode('login')}>
          Masuk di sini
        </button>
      </p>
    </form>
  )
}

/* ---------------------------- FORGOT --------------------------- */
function ForgotForm({ onMode }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    emailRef.current?.focus({ preventScroll: true })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setStatus(null)
    if (!email.trim()) return setError('Email wajib diisi.')
    if (!EMAIL_REGEX.test(email.trim())) return setError('Format email tidak valid. Contoh: nama@email.com')
    setError('')

    setBusy(true)
    const { error: err } = await resetPassword(email.trim())
    setBusy(false)
    if (err) setStatus({ kind: 'error', text: translateAuthError(err) })
    else
      setStatus({
        kind: 'success',
        text: 'Jika email terdaftar, tautan untuk mengatur ulang password sudah dikirim. Periksa kotak masuk dan folder spam.',
      })
  }

  return (
    <form onSubmit={submit} noValidate className="auth-form">
      <header className="form-head">
        <h2>Lupa password?</h2>
        <p>Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat password baru.</p>
      </header>

      <Alert kind={status?.kind}>{status?.text}</Alert>

      <Field
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        autoComplete="email"
        placeholder="nama@email.com"
        inputRef={emailRef}
      />

      <SubmitButton loading={busy} loadingText="Mengirim…">
        Kirim tautan reset
      </SubmitButton>

      <p className="switch-text">
        <button type="button" className="link-btn strong" onClick={() => onMode('login')}>
          ← Kembali ke halaman masuk
        </button>
      </p>
    </form>
  )
}

/* ------------------------- CONTAINER 3D ------------------------ */
// Transisi 3D: panel berputar 90° pada sumbu Y, konten diganti, lalu berputar kembali.
export default function AuthForm({ mode, onModeChange }) {
  const [shown, setShown] = useState(mode)
  const [phase, setPhase] = useState('idle') // idle | out | in
  const timers = useRef([])

  useEffect(() => {
    if (mode === shown) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(mode)
      return undefined
    }
    setPhase('out')
    const t1 = setTimeout(() => {
      setShown(mode)
      setPhase('in')
    }, 210)
    const t2 = setTimeout(() => setPhase('idle'), 460)
    timers.current = [t1, t2]
    return () => timers.current.forEach(clearTimeout)
  }, [mode, shown])

  const Form = shown === 'register' ? RegisterForm : shown === 'forgot' ? ForgotForm : LoginForm

  return (
    <div className="flip-perspective">
      <div className={`flip-card phase-${phase}`}>
        <Form key={shown} onMode={onModeChange} />
      </div>
    </div>
  )
}
