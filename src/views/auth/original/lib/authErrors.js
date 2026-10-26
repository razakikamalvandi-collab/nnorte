// Menerjemahkan pesan error Supabase Auth menjadi bahasa Indonesia yang mudah dipahami.
export function translateAuthError(error) {
  if (!error) return ''
  const raw = String(error.message || error.error_description || error).toLowerCase()
  const code = String(error.code || '').toLowerCase()

  if (raw === 'not_configured') {
    return 'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.local lalu jalankan ulang aplikasi.'
  }
  if (raw.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'Email atau password salah. Periksa kembali lalu coba lagi.'
  }
  if (raw.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Email Anda belum dikonfirmasi. Buka kotak masuk email dan klik tautan konfirmasi dari NNORTE.'
  }
  if (raw.includes('user already registered') || code === 'user_already_exists' || code === 'email_exists') {
    return 'Email ini sudah terdaftar. Silakan masuk atau gunakan fitur Lupa Password.'
  }
  if (raw.includes('password should be at least') || code === 'weak_password') {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.'
  }
  if (raw.includes('same password') || code === 'same_password') {
    return 'Password baru harus berbeda dari password lama.'
  }
  if (raw.includes('rate limit') || raw.includes('too many') || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
  }
  if (raw.includes('signups not allowed') || code === 'signup_disabled') {
    return 'Pendaftaran akun baru sedang dinonaktifkan.'
  }
  if (raw.includes('provider is not enabled') || code === 'validation_failed') {
    return 'Login dengan Google belum diaktifkan di Supabase. Aktifkan provider Google di Authentication → Providers.'
  }
  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('load failed')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan pastikan VITE_SUPABASE_URL benar.'
  }
  if (raw.includes('jwt') || raw.includes('session') || raw.includes('expired')) {
    return 'Sesi atau tautan sudah kedaluwarsa. Silakan ulangi prosesnya.'
  }
  if (raw.includes('invalid email') || code === 'email_address_invalid') {
    return 'Format email tidak valid.'
  }
  return 'Terjadi kesalahan. Silakan coba lagi beberapa saat lagi.'
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
