/**
 * Util tanggal untuk laporan. Semua tanggal operasional memakai zona waktu bisnis
 * Asia/Jakarta dan dipertukarkan sebagai string "YYYY-MM-DD" (bukan Date) supaya
 * tidak bergeser akibat konversi UTC.
 */
export const BUSINESS_TZ = 'Asia/Jakarta';

export interface DateRange {
  from: string; // YYYY-MM-DD, inklusif
  to: string; // YYYY-MM-DD, inklusif
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'single'
  | 'custom';

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Hari ini',
  yesterday: 'Kemarin',
  last7: '7 hari terakhir',
  last30: '30 hari terakhir',
  thisMonth: 'Bulan ini',
  lastMonth: 'Bulan sebelumnya',
  single: 'Tanggal tunggal',
  custom: 'Rentang kustom',
};

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Tanggal hari ini di Asia/Jakarta. `now` dapat diinjeksi untuk pengujian. */
export function todayInBusinessTz(now: Date = new Date()): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toUtcDate(iso: string): Date {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Tanggal tidak valid: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Selisih hari (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / 86_400_000);
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + '01';
}

export function endOfMonth(iso: string): string {
  const d = toUtcDate(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUtcDate(d);
}

export function rangeForPreset(preset: Exclude<DatePreset, 'single' | 'custom'>, today: string): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { from: startOfMonth(today), to: today };
    case 'lastMonth': {
      const lastDayPrev = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(lastDayPrev), to: lastDayPrev };
    }
  }
}

/** Semua tanggal dalam rentang (inklusif). Hari tanpa transaksi tetap muncul. */
export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  const n = diffDays(range.from, range.to);
  for (let i = 0; i <= n; i++) out.push(addDays(range.from, i));
  return out;
}

export const MAX_RANGE_DAYS = 366;

/** Mengembalikan pesan error bahasa Indonesia, atau null bila valid. */
export function validateRange(range: DateRange): string | null {
  if (!isValidIsoDate(range.from) || !isValidIsoDate(range.to)) return 'Tanggal belum lengkap atau tidak valid.';
  if (range.to < range.from) return 'Tanggal akhir tidak boleh sebelum tanggal awal.';
  if (diffDays(range.from, range.to) + 1 > MAX_RANGE_DAYS) return `Rentang maksimal ${MAX_RANGE_DAYS} hari.`;
  return null;
}

/** Periode pembanding: rentang sama panjang tepat sebelum `range`. */
export function previousRange(range: DateRange): DateRange {
  const len = diffDays(range.from, range.to) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "22 Okt 2026" */
export function formatDateId(iso: string): string {
  const m = ISO_RE.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]} ${m[1]}`;
}

/** "22 Okt" (tanpa tahun) untuk sumbu grafik. */
export function formatDayShort(iso: string): string {
  const m = ISO_RE.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]}`;
}

export function formatRangeId(range: DateRange): string {
  return range.from === range.to ? formatDateId(range.from) : `${formatDateId(range.from)} – ${formatDateId(range.to)}`;
}
