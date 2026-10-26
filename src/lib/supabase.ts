import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur. Buat file .env.local berdasarkan .env.example'
  )
}

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams()
const isCustomerView = params.has('qr') || params.get('customer') === '1'

/**
 * Klien utama untuk dashboard staf.
 * Di halaman pelanggan, klien ini tidak boleh mengambil alih hash OAuth
 * milik portal pelanggan.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: !isCustomerView,
  },
})

/**
 * Klien khusus portal pelanggan dengan sesi terpisah dari dashboard staf.
 * Login pelanggan tidak akan mengakhiri sesi staf, dan sebaliknya.
 */
export const customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'nnorte-customer-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isCustomerView,
  },
})
