# Fix Plasma Background (mode terang halaman jadi hitam)

## Gejala

Di halaman login, saat mode **terang** aktif (tombol kanan atas menampilkan ikon **bulan**),
seluruh background halaman tetap **hitam** sehingga gradasi merah-biru plasma tidak terlihat.
Kartu login tetap terang, jadi kelihatan seperti "halaman kosong".

Mode **gelap** (ikon matahari) tidak bermasalah.

## Penyebab (2 hal, keduanya harus diperbaiki)

1. **Build lama tidak punya aturan background halaman untuk mode terang.**
   Hanya ada `body { background-color: #0B0B0D }` (warna gelap), jadi saat tema
   terang aktif, halaman tetap gelap.
2. **Mode terang memakai `mix-blend-mode: multiply`** pada canvas WebGL plasma
   full-screen. Di Chromium/Brave, blend `multiply` terhadap piksel transparan
   (hitam) membuat background ikut menjadi hitam.
3. Plasma berada di `z-index: 80` sehingga menutupi/mengabutkan kartu login.

## Cara pakai

1. Copy file `fix-plasma-background.ps1` ke mesin yang menjalankan dev server
   (mis. mesin yang melayani `192.168.1.7:5173`).
2. Buka PowerShell di folder project tersebut, lalu jalankan:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\fix-plasma-background.ps1
   ```

   Kalau tidak tahu folder project-nya:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\fix-plasma-background.ps1 -ProjectRoot "C:\path\to\project"
   ```

3. Hard-refresh browser: **Ctrl+Shift+R** (cache CSS sering menahan perubahan).
4. Klik tombol tema untuk cek mode terang & gelap.
   - ikon **bulan** = mode terang → latar harus terang + gradasi merah-biru
   - ikon **matahari** = mode gelap → gradasi merah-biru di atas latar gelap

Opsi lain:

```powershell
# Lihat diagnosis tanpa mengubah file
.\scripts\fix-plasma-background.ps1 -DryRun

# Kembalikan ke kondisi sebelum patch
.\scripts\fix-plasma-background.ps1 -Rollback
```

## Yang dilakukan script

- Mencari file CSS global yang mengandung `.nnorte-fluid-plasma` (otomatis, recursive).
- Mencetak diagnosis aturan plasma & `mix-blend-mode` yang sedang aktif.
- Memberi tahu kalau aturan background halaman untuk mode terang tidak ada
  (indikator utama halaman hitam).
- Backup otomatis: `index.css.bak-<yyyyMMdd-HHmmss>`.
- MemBuang blok patch versi lama (v1/v2) lalu menempelkan blok v3, jadi aman
  dijalankan berulang kali tanpa menumpuk.

```css
/* ===== NNORTE-PLASMA-FIX-v3 ===== */
/* 1. Mode terang: background halaman harus terang */
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='light'] body { background-color: #f4f4f5 !important; color: #18181b; }

/* 2. body jadi stacking context -> plasma bisa berada di belakang konten */
body { isolation: isolate; }

/* 3. Plasma jadi latar belakang + fallback gradient CSS (tetap terlihat
      walau WebGL gagal render) */
.nnorte-fluid-plasma {
  z-index: -1 !important;
  mix-blend-mode: normal !important;
  background:
    radial-gradient(ellipse 58% 68% at 16% 46%, rgba(227, 29, 54, 0.38), transparent 70%),
    radial-gradient(ellipse 58% 68% at 84% 54%, rgba(26, 74, 255, 0.34), transparent 70%),
    radial-gradient(ellipse 62% 72% at 50% 50%, rgba(124, 58, 237, 0.2), transparent 76%);
}

/* 4. Mode terang: hapus blend "multiply" (penyebab layar jadi hitam) */
:root[data-theme='light'] .nnorte-fluid-plasma {
  mix-blend-mode: normal !important;
  background:
    radial-gradient(ellipse 58% 68% at 16% 46%, rgba(227, 29, 54, 0.3), transparent 70%),
    radial-gradient(ellipse 58% 68% at 84% 54%, rgba(26, 74, 255, 0.26), transparent 70%),
    radial-gradient(ellipse 62% 72% at 50% 50%, rgba(124, 58, 237, 0.14), transparent 76%);
}

/* 5. Gradien plasma terlihat jelas di kedua tema */
.nnorte-fluid-plasma__canvas { opacity: 0.6 !important; }
:root[data-theme='light'] .nnorte-fluid-plasma__canvas { opacity: 0.6 !important; filter: saturate(1.25); }
:root[data-theme='light'] .nnorte-fluid-plasma::before,
:root[data-theme='light'] .nnorte-fluid-plasma::after { opacity: 0.1 !important; }
/* ===== END NNORTE-PLASMA-FIX-v3 ===== */
```

## Troubleshooting

**Tabel/kartu di halaman lain jadi tidak bisa diklik** → `isolation: isolate` pada body
membuat `position: fixed` di dalam body ikut terisolasi. Hapus aturan itu; ganti dengan
`body { position: relative; z-index: 0; }` (efek hampir sama).

**Plasma tidak terlihat sama sekali** → kemungkinan besar canvas WebGL gagal render.
Cek DevTools Console, cari pesan `WebGL not supported` / `Fluid plasma unavailable`.
Gradient fallback CSS di atas sudah menutupi kasus ini, jadi halaman tetap punya
warna – tapi kalau tetap kosong, cek juga apakah ada elemen lain full-screen
menutupi (mis. `bg-black`).

**Mau patch dari command line tanpa file** (copy-paste ke PowerShell di mesin remote):

```powershell
$css = 'C:\path\to\project\src\index.css'
Copy-Item $css "$css.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$patch = @'

/* ===== NNORTE-PLASMA-FIX-v3 ===== */
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='light'] body { background-color: #f4f4f5 !important; color: #18181b; }
body { isolation: isolate; }
.nnorte-fluid-plasma {
  z-index: -1 !important;
  mix-blend-mode: normal !important;
  background:
    radial-gradient(ellipse 58% 68% at 16% 46%, rgba(227, 29, 54, 0.38), transparent 70%),
    radial-gradient(ellipse 58% 68% at 84% 54%, rgba(26, 74, 255, 0.34), transparent 70%),
    radial-gradient(ellipse 62% 72% at 50% 50%, rgba(124, 58, 237, 0.2), transparent 76%);
}
:root[data-theme='light'] .nnorte-fluid-plasma {
  mix-blend-mode: normal !important;
  background:
    radial-gradient(ellipse 58% 68% at 16% 46%, rgba(227, 29, 54, 0.3), transparent 70%),
    radial-gradient(ellipse 58% 68% at 84% 54%, rgba(26, 74, 255, 0.26), transparent 70%),
    radial-gradient(ellipse 62% 72% at 50% 50%, rgba(124, 58, 237, 0.14), transparent 76%);
}
.nnorte-fluid-plasma__canvas { opacity: 0.6 !important; }
:root[data-theme='light'] .nnorte-fluid-plasma__canvas { opacity: 0.6 !important; filter: saturate(1.25); }
:root[data-theme='light'] .nnorte-fluid-plasma::before,
:root[data-theme='light'] .nnorte-fluid-plasma::after { opacity: 0.1 !important; }
/* ===== END NNORTE-PLASMA-FIX-v3 ===== */
'@
[System.IO.File]::AppendAllText($css, $patch, (New-Object System.Text.UTF8Encoding($false)))
```

> Catatan: snippet ini menempelkan blok apa adanya. Kalau blok versi lama (v1/v2)
> sudah ada sebelumnya, hapus manual blok tersebut agar tidak ada aturan yang
> saling bertabrakan. Versi `fix-plasma-background.ps1` sudah menangani ini otomatis.
