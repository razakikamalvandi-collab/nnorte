<#
.SYNOPSIS
    Memperbaiki latar plasma (gradient merah-biru) pada halaman login NNORTE.

.DESCRIPTION
    Gejala yang diperbaiki (build lama / mode terang):
      - Tombol tema menampilkan ikon BULAN (mode terang aktif) tapi seluruh
        background halaman tetap HITAM, gradasi merah-biru tidak terlihat.
      - Penyebabnya 2 hal:
          1. Build lama tidak punya aturan background halaman untuk mode terang,
             jadi body tetap memakai warna gelap #0B0B0D.
          2. Mode terang memakai `mix-blend-mode: multiply` pada canvas WebGL
             plasma full-screen -> di Chromium/Brave background ikut jadi hitam.
      - Plasma juga berada di z-index 80 sehingga menutupi/mengabutkan kartu.

    Perbaikan (di-append ke CSS global, aman terhadap perbedaan isi file):
      1. Mode terang: background halaman jadi terang + color-scheme light
      2. body jadi stacking context (isolation: isolate) agar plasma bisa di
         belakang konten
      3. plasma turun ke z-index -1 -> jadi latar belakang, bukan menutupi kartu
      4. blend "multiply" di mode terang diganti "normal"
      5. fallback gradient CSS (merah-biru) supaya tetap terlihat walau WebGL
         gagal / canvas tidak ter-render
      6. opacity canvas dinaikkan supaya gradasi jelas di kedua tema

.PARAMETER ProjectRoot
    Folder project yang dicari CSS-nya. Default: folder kerja saat ini.

.PARAMETER Rollback
    Kembalikan file CSS dari backup terbaru (menghapus patch).

.PARAMETER DryRun
    Hanya menampilkan diagnosis + rencana, tidak mengubah file.

.EXAMPLE
    .\fix-plasma-background.ps1
    .\fix-plasma-background.ps1 -ProjectRoot "C:\path\to\project"
    .\fix-plasma-background.ps1 -Rollback
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = (Get-Location).Path,
  [switch]$Rollback,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Marker = 'NNORTE-PLASMA-FIX-v3'

$Patch = @'

/* ===== NNORTE-PLASMA-FIX-v3 =====
   1. Mode terang: background halaman harus terang (build lama tidak punya aturan ini) */
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='light'] body { background-color: #f4f4f5 !important; color: #18181b; }

/* 2. body jadi stacking context -> plasma bisa berada di belakang konten */
body { isolation: isolate; }

/* 3. Plasma jadi latar belakang, bukan menutupi kartu login.
      Includes a pure-CSS gradient fallback so the background stays visible
      even if the WebGL canvas fails to render. */
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

/* 5. Gradien plasma dibuat terlihat jelas di kedua tema */
.nnorte-fluid-plasma__canvas { opacity: 0.6 !important; }
:root[data-theme='light'] .nnorte-fluid-plasma__canvas { opacity: 0.6 !important; filter: saturate(1.25); }
:root[data-theme='light'] .nnorte-fluid-plasma::before,
:root[data-theme='light'] .nnorte-fluid-plasma::after { opacity: 0.1 !important; }
/* ===== END NNORTE-PLASMA-FIX-v3 ===== */
'@

# Pola untuk membuang blok patch versi lama (v1/v2/v3) sebelum menempelkan yang baru
$BlockPattern = '(?s)/\* ={5} NNORTE-PLASMA-FIX-[^*]*?\*/.*?/\* ={5} END NNORTE-PLASMA-FIX-[^*]*?\*/\s*'

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    OK  $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    !!  $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "    XX  $text" -ForegroundColor Red }

if (-not (Test-Path $ProjectRoot)) {
  Write-Err "Folder tidak ditemukan: $ProjectRoot"
  exit 1
}
$ProjectRoot = (Resolve-Path $ProjectRoot).Path
Write-Step "Project root : $ProjectRoot"

# ---------------------------------------------------------------------------
# Cari file CSS global yang mengatur .nnorte-fluid-plasma
# ---------------------------------------------------------------------------
$exclude = 'node_modules|\\dist\\|\\build\\|\\.next\\|\\.git\\|\\coverage\\|\\.vite\\'

$cssFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Include *.css -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $exclude } |
  Sort-Object FullName

if (-not $cssFiles) {
  Write-Err "Tidak ada file .css di $ProjectRoot"
  exit 1
}

$targets = @($cssFiles | Where-Object {
  Select-String -Path $_.FullName -Pattern 'nnorte-fluid-plasma' -Quiet -ErrorAction SilentlyContinue
})

if (-not $targets) {
  Write-Err "Tidak ditemukan CSS yang mengandung '.nnorte-fluid-plasma'."
  Write-Warn "Cari manual dengan:"
  Write-Host "     Get-ChildItem -Path '$ProjectRoot' -Recurse -Include *.css -File | Select-String 'nnorte-fluid-plasma'"
  exit 1
}

Write-Step "File CSS yang controlling plasma ($($targets.Count)):"
$targets | ForEach-Object { Write-Host "    - $($_.FullName)" }

# ---------------------------------------------------------------------------
# Diagnosis: tampilkan aturan plasma & blend mode yang sekarang
# ---------------------------------------------------------------------------
Write-Step "Diagnosis (aturan plasma & mix-blend-mode yang aktif sekarang):"
foreach ($file in $targets) {
  Write-Host "    --- $($file.Name) ---"
  Select-String -Path $file.FullName -Pattern 'nnorte-fluid-plasma|mix-blend-mode|z-index' -Context 0,2 |
    Select-Object -First 40 | ForEach-Object {
      $line = $_.Line.Trim()
      if ($line) { Write-Host "      L$($_.LineNumber): $line" -ForegroundColor DarkGray }
    }
}

# Cek apakah mode terang punya aturan background halaman (biasanya hilang di build lama)
$hasLightBody = $false
foreach ($file in $targets) {
  if (Select-String -Path $file.FullName -Pattern "\[data-theme='light'\]\s*body" -Quiet -ErrorAction SilentlyContinue) {
    $hasLightBody = $true
  }
}
if (-not $hasLightBody) {
  Write-Warn "Tidak ada aturan background halaman untuk mode terang -> itu penyebab halaman hitam."
  Write-Host "        Patch v3 akan menambahkannya." -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------
if ($Rollback) {
  Write-Step "Rollback: mencari backup..."
  $backups = Get-ChildItem -Path $ProjectRoot -Recurse -Include *.css.bak-* -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $exclude } | Sort-Object LastWriteTime -Descending
  if (-not $backups) {
    Write-Err "Tidak ada file backup (.css.bak-*) ditemukan."
    exit 1
  }
  $latest = $backups[0]
  $target = $latest.FullName -replace '\.bak-\d{8}-\d{6}$', ''
  if ($DryRun) {
    Write-Warn "[DryRun] Akan mengembalikan: $target  <-  $($latest.Name)"
    exit 0
  }
  Copy-Item $latest.FullName $target -Force
  Write-Ok "Dikembalikan: $target  (dari $($latest.Name))"
  Write-Host "    Hard-refresh browser (Ctrl+Shift+R) untuk melihat hasil." -ForegroundColor Cyan
  exit 0
}

# ---------------------------------------------------------------------------
# Apply patch
# ---------------------------------------------------------------------------
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$changed = 0

foreach ($file in $targets) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  $hadOld = [regex]::IsMatch($content, $BlockPattern)

  if ($content -like "*$Marker*" -and -not $hadOld) {
    Write-Warn "SKIP (patch v3 sudah ada): $($file.FullName)"
    continue
  }

  if ($DryRun) {
    if ($hadOld) { Write-Warn "[DryRun] Akan GANTI blok patch lama di: $($file.FullName)" }
    else { Write-Warn "[DryRun] Akan patch: $($file.FullName)" }
    continue
  }

  $backup = "$($file.FullName).bak-$timestamp"
  Copy-Item $file.FullName $backup -Force
  Write-Ok "Backup: $backup"

  # Buang blok patch versi lama supaya tidak menumpuk
  $cleaned = [regex]::Replace($content, $BlockPattern, '')
  if ($cleaned -ne $content) { Write-Ok "Blok patch versi lama dibuang" }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file.FullName, $cleaned.TrimEnd() + "`r`n" + $Patch, $utf8NoBom)
  Write-Ok "Patched: $($file.FullName)"
  $changed++
}

if ($DryRun) {
  Write-Step "Dry run selesai, tidak ada file yang diubah."
  exit 0
}

if ($changed -eq 0) {
  Write-Warn "Tidak ada file yang berubah (semua sudah ter-patch)."
} else {
  Write-Step "Selesai: $changed file dipatch (versi $Marker)."
}

Write-Host ""
Write-Host "Langkah berikutnya:" -ForegroundColor Cyan
Write-Host "  1. Hard-refresh browser  ->  Ctrl+Shift+R  (penting, cache CSS)"
Write-Host "  2. Klik tombol tema kanan atas untuk cek mode terang & gelap"
Write-Host "  3. Mode terang = ikon bulan, latar harus terang + gradasi merah-biru"
Write-Host ""
Write-Host "Rollback:  .\fix-plasma-background.ps1 -Rollback" -ForegroundColor DarkGray
