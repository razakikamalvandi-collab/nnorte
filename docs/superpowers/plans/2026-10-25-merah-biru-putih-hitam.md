# Implementasi: Identitas Merah • Biru • Putih / Merah • Biru • Hitam

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti tema netral NNORTE menjadi tri-warna merah–biru–putih (terang) dan merah–biru–hitam (gelap) tanpa mengubah perilaku aplikasi.

**Architecture:** Semua warna mengalir dari custom property `--c-*` di `src/index.css` yang dipetakan ke utility `nnorte-*` lewat `@theme inline`. Perubahan palet dilakukan sekali di token, lalu peran tiap warna (merah = aksi utama, biru = aksi sekunder/data, putih/hitam = kanvas) diterapkan pada kelas presentasi di shell, tombol, dan state.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-25-merah-biru-putih-hitam-design.md`

## Global Constraints

- Hanya tampilan: dilarang mengubah query Supabase, tipe data, routing, teks, urutan menu, isi ekspor PDF/Excel, `Cafe3D`, `LoginDesign.css`, `footer.css`.
- Jangan menulis hex baru di JSX; pakai token `nnorte-*` atau `var(--c-*)`.
- Warna semantik status (`success`, `warning`, `error`) dan warna cabang dari database tidak diubah.
- Kontras teks putih di atas merah minimal 4,5:1 → isi kapsul aktif memakai `#dc2626`, glow memakai `#ef4444`.
- Tidak ada commit: repo belum punya commit awal dan permintaan hanya menyentuh desain.

## Review Focus

- Input fokus harus tetap terlihat di kedua tema (biru di atas putih dan di atas hitam).
- Kapsul menu aktif harus terbaca saat sidebar digulir dan pada layar sentuh.
- Empty state harus tetap jelas saat data kosong, bukan menyatu dengan kanvas.
- Tombol nonaktif (disabled) tetap terbaca, tidak tenggelam di permukaan gelap.
- Perpindahan tema tidak boleh menyisakan warna abu-abu lama di komponen yang memakai token.

---

### Task 1: Token palet dan aturan dasar

**Files:**
- Modify: `src/index.css:1-146`, `src/index.css:371-400`

**Interfaces:**
- Produces: nilai baru untuk `--c-bg`, `--c-sidebar`, `--c-surface`, `--c-surface-2`, `--c-border`, `--c-text`, `--c-text-soft`, `--c-muted`, `--c-subtle`, `--c-red`, `--c-red-hover`, `--c-red-dark`, `--c-red-soft`, `--c-red-glow`, `--c-brand-soft`, `--c-blue`, `--c-blue-hover`, `--c-blue-dark`, `--c-blue-glow`, `--c-success`, `--c-warning`, `--c-error`, `--plaque-*`.

- [ ] **Step 1: Ganti komentar header dan blok tema gelap**

Nilai `:root` (gelap):

```css
--c-bg: #0a0a0a;
--c-sidebar: #101012;
--c-surface: #121214;
--c-surface-2: #1a1a1e;
--c-border: #2a2a31;
--c-text: #f5f5f7;
--c-text-soft: #d4d4d8;
--c-muted: #a1a1aa;
--c-subtle: #71717a;
--c-on-brand: #ffffff;
--c-red: #dc2626;
--c-red-hover: #ef4444;
--c-red-dark: #991b1b;
--c-red-soft: #ff8a98;
--c-red-glow: rgba(239, 68, 68, 0.42);
--c-brand-soft: rgba(220, 38, 38, 0.16);
--c-blue: #1d4ed8;
--c-blue-hover: #2563eb;
--c-blue-dark: #1e3a8a;
--c-blue-glow: rgba(59, 130, 246, 0.45);
--c-success: #22c55e;
--c-warning: #f59e0b;
--c-error: #f87171;
--plaque-ink: rgba(245, 245, 247, 0.05);
--plaque-edge: rgba(255, 255, 255, 0.07);
--plaque-shadow: rgba(0, 0, 0, 0.7);
--plaque-highlight: rgba(255, 255, 255, 0.08);
```

- [ ] **Step 2: Ganti blok tema terang**

Nilai `:root[data-theme='light']`:

```css
--c-bg: #f7f8f9;
--c-sidebar: #f4f5f6;
--c-surface: #ffffff;
--c-surface-2: #f1f3f5;
--c-border: #e4e7eb;
--c-text: #111318;
--c-text-soft: #3f3f46;
--c-muted: #5f6672;
--c-subtle: #9aa1ad;
--c-on-brand: #ffffff;
--c-red: #dc2626;
--c-red-hover: #b91c1c;
--c-red-dark: #991b1b;
--c-red-soft: #f87171;
--c-red-glow: rgba(220, 38, 38, 0.18);
--c-brand-soft: rgba(220, 38, 38, 0.08);
--c-blue: #2563eb;
--c-blue-hover: #1d4ed8;
--c-blue-dark: #1e40af;
--c-blue-glow: rgba(37, 99, 235, 0.22);
--c-success: #15803d;
--c-warning: #b45309;
--c-error: #b91c1c;
--plaque-ink: rgba(17, 19, 24, 0.04);
--plaque-edge: rgba(17, 19, 24, 0.09);
--plaque-shadow: rgba(17, 19, 24, 0.12);
--plaque-highlight: rgba(255, 255, 255, 0.8);
```

- [ ] **Step 3: Ubah fokus input dan hover kartu**

Di `.theme-input:focus` ganti `border-color`/`box-shadow` dari `--c-red` ke `--c-blue`.
Di `.card:hover` ganti `border-color: var(--c-red)` menjadi
`border-color: color-mix(in srgb, var(--c-blue) 40%, var(--c-border));`.

- [ ] **Step 4: Verifikasi**

Run: `npm run typecheck`
Expected: PASS tanpa error.

---

### Task 2: Shell — Sidebar dan Header

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:114-209`
- Modify: `src/components/layout/Header.tsx:22-75`

**Interfaces:**
- Consumes: token dari Task 1.
- Produces: tidak ada API baru; hanya kelas presentasi.

- [ ] **Step 1: Sidebar — garis tri-warna dan kapsul aktif**

- Blok brand (`div` berisi logo) diberi `relative`; tambahkan anak terakhir:
  `<span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-nnorte-red to-nnorte-blue opacity-70" />`.
- Tombol nav: tambahkan `group`, ganti kelas aktif menjadi
  `bg-nnorte-red text-nnorte-on-brand font-semibold shadow-[0_6px_18px_-8px_var(--c-red-glow)]`.
- Hapus `<span>` batang merah di dalam tombol aktif.
- Ikon nonaktif: `text-nnorte-blue/70 group-hover:text-nnorte-blue`.
- Ikon Portal Pelanggan: `text-nnorte-blue`.
- Kartu pengguna: `bg-nnorte-surface-2`.

- [ ] **Step 2: Header — aksen biru pada konteks dan utilitas**

- Ikon `Building2` pil cabang: `text-nnorte-blue`.
- Badge "Terkunci": `border-nnorte-blue/30 bg-nnorte-blue/10 text-nnorte-blue-hover`.
- Tombol hamburger dan lonceng: tambah `hover:border-nnorte-blue/40`.
- Badge notifikasi tetap `bg-nnorte-red`.

- [ ] **Step 3: Verifikasi**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 3: Tombol dan aksi ekspor

**Files:**
- Modify: `src/components/ui/Button.tsx:4-20`
- Modify: `src/components/common/ReportExportButtons.tsx:49-57`
- Modify: `src/views/super-admin/SemuaPesanan.tsx:60,69,74,82`

**Interfaces:**
- Produces: `Variant` bertipe `'primary' | 'accent' | 'secondary' | 'danger' | 'ghost'`.

- [ ] **Step 1: Tambah varian `accent`**

`type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';`

```ts
accent: 'bg-nnorte-blue text-nnorte-on-brand hover:bg-nnorte-blue-hover shadow-md border border-transparent',
secondary: 'bg-nnorte-surface-2 text-nnorte-text border border-nnorte-border hover:border-nnorte-blue',
```

- [ ] **Step 2: Terapkan pada ekspor**

- `ReportExportButtons`: tombol PDF ikon `text-nnorte-blue`; tombol Excel `variant="accent"`.
- `SemuaPesanan`: tombol "Ekspor Rekap" `variant="accent"` dengan ikon `className="text-nnorte-on-brand"`; ikon `Search` dan `Filter` menjadi `text-nnorte-blue`.

- [ ] **Step 3: Verifikasi**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 4: Kartu statistik, empty state, input, toggle tema

**Files:**
- Modify: `src/components/common/StatCard.tsx:29-40`
- Modify: `src/components/ui/States.tsx:14-27`
- Modify: `src/components/ui/Field.tsx:11-14`
- Modify: `src/components/common/ThemeToggle.tsx:23-27`

**Interfaces:**
- Consumes: token dari Task 1; `Button` dari Task 3.

- [ ] **Step 1: StatCard**

- Kontainer: `hover:border-nnorte-blue/40` (ganti hover merah).
- Chip ikon: `bg-nnorte-blue/10 border-nnorte-blue/25 text-nnorte-blue-hover`.

- [ ] **Step 2: EmptyState dengan cincin dua warna**

```tsx
<div className="mb-3 rounded-full bg-[conic-gradient(from_140deg,var(--c-red),var(--c-blue),var(--c-red))] p-[1.5px] shadow-[0_0_24px_-6px_var(--c-blue-glow)]">
  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-nnorte-surface text-nnorte-blue-hover">
    <Icon size={22} aria-hidden="true" />
  </div>
</div>
```

Kontainer empty state: `bg-nnorte-surface-2` (ganti `bg-nnorte-surface`).

- [ ] **Step 3: Input dan toggle**

- `inputClass`: fokus `focus:border-nnorte-blue` (error tetap `focus:border-nnorte-error`).
- `ThemeToggle`: `focus-visible:ring-nnorte-blue`, hover border `hover:border-nnorte-blue/40`.

- [ ] **Step 4: Verifikasi**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 5: Verifikasi menyeluruh

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Unit test**

Run: `npm run test`
Expected: semua suite lulus.

- [ ] **Step 3: Build produksi**

Run: `npm run build`
Expected: build selesai tanpa error; hanya peringatan chunk size yang sudah ada.

- [ ] **Step 4: Pemeriksaan manual**

Jalankan `npm run dev`, buka halaman login dan "Pesanan Cabang", lalu aktifkan tema terang dan gelap. Periksa: kanvas putih/hitam, kapsul aktif merah, tombol ekspor biru, fokus input biru, empty state berkilau merah–biru, tidak ada sisa abu-abu lama.
