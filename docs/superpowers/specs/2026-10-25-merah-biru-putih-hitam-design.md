# Desain: Identitas Merah • Biru • Putih / Merah • Biru • Hitam

Tanggal: 2026-10-25
Status: menunggu persetujuan

## Maksud

Tampilan dashboard NNORTE sekarang netral (abu-abu Blackstone / Whiteout) dengan merah
sebagai satu-satunya aksen. Biru ada di token tetapi hampir tidak terlihat. Perubahan ini
menjadikan tiga warna sebagai identitas visual:

- **Terang:** merah • biru • putih
- **Gelap:** merah • biru • hitam

Yang berubah hanya tampilan. Tidak ada perubahan data, alur, routing, RLS, isi ekspor,
teks, atau ilustrasi 3D.

## Tujuan

- Kanvas putih bersih (terang) dan hitam pekat (gelap), bukan abu-abu netral.
- Merah tetap warna aksi utama: menu aktif, tombol submit, peringatan.
- Biru menjadi aksen kedua yang benar-benar terlihat: aksi ekspor, ikon data, fokus input,
  garis grafik, kilau empty state.
- Kedua tema tetap terbaca dan konsisten dengan footer/login yang sudah memakai palet ini.

## Bukan tujuan

- Tidak mengubah tata letak, urutan menu, komponen fungsional, atau copy.
- Tidak mengubah skema warna semantik status (sukses kuning/merah/hijau tetap).
- Tidak menyentuh `Cafe3D`, `LoginDesign.css`, `footer.css`, atau berkas ekspor PDF/Excel.
- Tidak menambah library animasi atau dependensi.

## Pendekatan

1. **Ganti token saja.** Cepat dan berisiko rendah, tetapi biru tetap tidak terasa karena
   hanya dipakai satu ikon toast. Ditolak.
2. **Token baru + pembagian peran warna (dipilih).** Merah = aksi/brand, biru = aksi
   sekunder & data, putih/hitam = kanvas. Diterapkan ke shell (sidebar, header), tombol,
   input, kartu statistik, empty state, dan grafik. Sesuai mockup pengguna.
3. **Tata letak tri-warna penuh** (panel sidebar biru, ikon nav bergantian, permukaan
   bergradien). Identitas kuat, tetapi ramai dan menjauh dari mockup. Ditolak.

## Palet

### Terang — Merah • Biru • Putih

| Token | Nilai | Peran |
|---|---|---|
| `--c-bg` | `#f7f8f9` | kanvas workspace |
| `--c-sidebar` | `#f4f5f6` | sidebar |
| `--c-surface` | `#ffffff` | kartu, panel, input |
| `--c-surface-2` | `#f1f3f5` | panel inset, empty state, hover |
| `--c-input` | `#ffffff` | latar input/select |
| `--c-border` | `#e4e7eb` | garis |
| `--c-text` | `#111318` | teks utama |
| `--c-muted` | `#5f6672` | teks sekunder |
| `--c-red` | `#dc2626` | aksi utama, menu aktif |
| `--c-red-hover` | `#b91c1c` | hover merah |
| `--c-blue` | `#2563eb` | aksi ekspor, ikon data, fokus |
| `--c-blue-hover` | `#1d4ed8` | hover biru |
| `--c-blue-soft` | `#1d4ed8` | teks/ikon biru |

### Gelap — Merah • Biru • Hitam

| Token | Nilai | Peran |
|---|---|---|
| `--c-bg` | `#0a0a0a` | kanvas hitam matte |
| `--c-sidebar` | `#101012` | sidebar |
| `--c-surface` | `#121214` | kartu/panel |
| `--c-surface-2` | `#1a1a1e` | panel inset, empty state |
| `--c-input` | `#1a1a1e` | latar input/select |
| `--c-border` | `#2a2a31` | garis |
| `--c-text` | `#f5f5f7` | teks utama |
| `--c-muted` | `#a1a1aa` | teks sekunder |
| `--c-red` | `#dc2626` | aksi utama, menu aktif |
| `--c-red-hover` | `#b91c1c` | hover tombol merah |
| `--c-red-glow` | `rgba(239,68,68,.42)` | glow kapsul aktif |
| `--c-blue` | `#1d4ed8` | tombol ekspor |
| `--c-blue-hover` | `#2563eb` | hover biru |
| `--c-blue-soft` | `#60a5fa` | ikon/teks biru (electric) |
| `--c-blue-glow` | `rgba(59,130,246,.45)` | glow ikon/fokus |

Catatan: kapsul aktif gelap memakai `#dc2626` dengan glow `#ef4444`, bukan isi `#ef4444`,
supaya teks putih 12px tetap lolos kontras AA (4.8:1 vs 3.8:1). Secara visual tetap
"crimson menyala".

## Keputusan per permukaan

- **Sidebar** — kanvas putih/`#101012`; item aktif kapsul merah solid + glow halus (gelap);
  ikon nonaktif muted; kartu pengguna memakai `surface-2`. Garis rambut merah→biru 2px di
  bawah blok brand sebagai penanda tri-warna.
- **Header** — memakai warna kanvas (`--c-bg`) agar menyatu dengan workspace; breadcrumb muted
  + judul tebal; pil cabang memakai `surface`; badge notifikasi merah; tombol tema netral
  dengan fokus biru.
- **Tombol** — varian baru `accent` (biru solid) untuk "Ekspor Rekap", "Ekspor Excel";
  "Ekspor PDF" sekunder dengan ikon biru. Tombol submit/buat tetap merah.
- **Input & select** — `surface` dengan border netral; fokus biru (bukan merah); error tetap merah.
- **Kartu statistik** — chip ikon biru lembut, hover border biru; angka tetap teks utama.
- **Empty state** — panel `surface-2`, cincin ikon dua warna (merah luar, biru dalam) + glow.
- **Grafik** — deret utama merah, deret pembanding/pendukung biru; warna metode pembayaran
  tetap semantik.
- **Scrollbar/fokus global** — thumb netral, hover merah; `focus-visible` merah tetap.

## Yang diserahkan ke pelaksana

- Nilai tepat bayangan/opasitas glow, urutan kelas Tailwind, dan penamaan varian tombol.
- Penyesuaian kecil kontras bila ada pasangan warna yang gagal saat diperiksa.

## Catatan implementasi

- `--c-input` ditambahkan agar input tetap putih di kanvas putih dan tetap lebih terang dari
  kartu di tema gelap.
- `--c-blue-soft` ditambahkan karena `#1d4ed8` terlalu gelap untuk ikon/teks di atas hitam;
  tombol tetap memakai `--c-blue`, sedangkan ikon dan label memakai `--c-blue-soft`.
- `--c-subtle` dinaikkan kontrasnya (`#6b7280` terang / `#8f8f99` gelap) agar placeholder dan
  label kecil tetap terbaca.
- Header memakai `--c-bg`, bukan warna sidebar, supaya bilah atas menyatu dengan kanvas
  seperti pada mockup.
- Referensi `var(--color-nnorte-*)` yang tidak pernah dipancarkan `@theme inline` diganti
  `var(--c-*)`; tanpa ini label grafik dan beberapa aksen kehilangan warna.
- Chip status, badge peran, dan fokus input yang masih memakai warna tailwind gelap
  dipindahkan ke token agar tetap terbaca di tema terang.

## Verifikasi

- `npm run build` dan `npm run test` lulus.
- Cek manual kedua tema di halaman Pesanan Cabang, Dashboard Cabang, dan Login.
- Tidak ada perubahan pada query Supabase, tipe, atau berkas ekspor.
