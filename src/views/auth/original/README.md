# Login original (dari proyek "login nnorte")

- `components/*`, `lib/authErrors.js`, `lib/useButtonTilt.js`: salinan asli (perubahan minimal: import tema/auth, Brand tanpa react-router).
- `login-original.css`: gabungan `styles.css` + `animations.css` asli, semua selector di-scope ke `.nn-auth-root`, keyframes diberi awalan `nnauth-` (dibuat otomatis, tidak diedit tangan).
- `lib/authAdapter.tsx`: menghubungkan UI ke `src/context/AuthContext.tsx` NNORTE (Supabase, role dari tabel `memberships`).
- `AuthPage.tsx` = `Auth.jsx` asli; `ResetPasswordPage.tsx` = `ResetPassword.jsx` asli (diakses lewat path `/reset-password`).
