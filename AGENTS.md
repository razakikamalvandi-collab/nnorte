# Project Guide

React 19 + Vite 8 + Tailwind CSS v4 restaurant operations dashboard.

## Development

- Install dependencies with `npm install`.
- Start the local server with `npm run dev`.
- Create a production build with `npm run build` and serve it locally with `npm run preview`.
- The port can be set through the `PORT` environment variable.

## Main files

- `src/main.tsx` mounts the application and imports global styles.
- `src/App.tsx` maps roles to the main application screens.
- `src/context/AppContext.tsx` memuat data dari Supabase (RLS) dan operasi tulis (mengembalikan `OpResult`).
- `src/lib/` : `finance.ts` (laporan), `dates.ts` (tanggal WIB), `exporters.ts` (PDF/Excel), `portalApi.ts` (RPC publik), `geocoding.ts` (Nominatim/OpenStreetMap), `googleMaps.ts` (legacy, tidak dipakai), `menuImages.ts`, `expenses.ts`, `adminUsers.ts`.
- `src/context/ThemeContext.tsx` owns the light/dark theme and mounts the background.
- `src/types/index.ts` defines application data types.
- `src/index.css` contains Tailwind CSS v4 imports, theme tokens, and global styles.
- `src/components/common/ThemeToggle.tsx` renders the sun/moon theme switch.
- `src/components/common/FluidPlasmaBackground.tsx` renders the plasma backdrop and watermark plaque.
- `supabase/migrations/` contains the PostgreSQL schema migrations.

## Themes

- Two brand palettes:
  - **Blackstone `#212529`** - the dark theme (surfaces, borders, body text).
  - **Whiteout `#E9ECEF`** - the light theme (cards, page highlights).
- `ThemeProvider` stores the choice in `localStorage` under `nnorte_theme` and writes it to
  `data-theme` on `<html>` (`light` or `dark`). `color-scheme` follows the same attribute.
- `src/index.css` declares the palette as `@theme inline` custom properties (`--c-*`), so the
  Tailwind utilities (`bg-nnorte-surface`, `text-nnorte-muted`, ...) resolve at runtime and
  re-resolve when `data-theme` changes. Never hard-code hex colours in JSX - use the
  `nnorte-*` tokens so both themes stay in sync.
- The theme switch lives in the dashboard header, on the login page and in the customer
  portal header, so every surface can be flipped.

## Backgrounds

- The backdrop sits behind the content (`z-index: -1`): a plasma shader canvas plus a
  recessed "NNORTE" watermark plaque (`.nnorte-fluid-plasma__title`).
- The canvas is hidden in light mode - the old white-page fluid simulation read as harsh
  red/blue marble and was removed.
- The plaque is embossed with `text-shadow` and an inset shadow so it reads as recessed.

## Styling and code

Use Tailwind utility classes in JSX and global rules or theme tokens in `src/index.css`. Keep CSS imports first. Use double quotes when strings contain apostrophes. Keep JSX balanced and components default-exported where appropriate.

## Data and security

Semua data berasal dari Supabase; tidak ada data demo/mock di frontend. Jangan menaruh service-role key atau password di kode frontend; operasi admin Auth hanya lewat Edge Function `supabase/functions/admin-users`. Aturan akses ada di migrasi (RLS + RPC). Kode cabang dibuat trigger database dan tidak boleh dikirim dari frontend. Pesanan belum lunas/dibatalkan/refund tidak dihitung sebagai pendapatan; tanggal laporan memakai zona Asia/Jakarta sebagai string `YYYY-MM-DD`.
