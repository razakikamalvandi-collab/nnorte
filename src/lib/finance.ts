import { supabase } from './supabase';
import { Branch, PaymentMethod } from '../types';
import { DateRange, addDays, diffDays, eachDay, previousRange } from './dates';

/**
 * Definisi metrik (identik dengan migrasi 202610220001 dan dipakai dashboard, laporan, PDF, Excel):
 *  - transaksi sah : orders.payment_status = 'paid' dan status <> 'cancelled' (tanggal = paid_at, Asia/Jakarta)
 *  - pendapatan    : total_amount - tax_amount (PB1 bukan pendapatan)
 *  - pengeluaran   : baris tabel expenses pada tanggal tsb
 *  - laba bersih   : pendapatan - pengeluaran tercatat
 */

export interface DailyRow {
  date: string;
  branchId: string;
  gross: number;
  tax: number;
  service: number;
  revenue: number;
  txCount: number;
  expenses: number;
}

export interface PaymentMethodRow {
  method: PaymentMethod;
  txCount: number;
  amount: number;
}

export interface TopMenuRow {
  menuId: string | null;
  name: string;
  category: string | null;
  image: string | null;
  qty: number;
  sales: number;
}

export interface RawReport {
  rows: DailyRow[];
  previousRows: DailyRow[] | null;
  previous: DateRange | null;
  methods: PaymentMethodRow[];
  topMenus: TopMenuRow[];
}

type DailyDb = {
  report_date: string;
  branch_id: string;
  gross_amount: number | string;
  tax_amount: number | string;
  service_amount: number | string;
  revenue: number | string;
  tx_count: number | string;
  expense_amount: number | string;
};

const num = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

export function mapDailyRow(r: DailyDb): DailyRow {
  return {
    date: r.report_date,
    branchId: r.branch_id,
    gross: num(r.gross_amount),
    tax: num(r.tax_amount),
    service: num(r.service_amount),
    revenue: num(r.revenue),
    txCount: num(r.tx_count),
    expenses: num(r.expense_amount),
  };
}

/** Periode pembanding hanya dihitung bila total rentang (saat ini + sebelumnya) masih dalam batas server (2 tahun). */
const MAX_COMPARE_DAYS = 365;

export async function fetchReportData(branchId: string, range: DateRange): Promise<RawReport> {
  const branchParam = branchId === 'all' ? null : branchId;
  const len = diffDays(range.from, range.to) + 1;
  const previous = len <= MAX_COMPARE_DAYS ? previousRange(range) : null;
  const queryFrom = previous ? previous.from : range.from;

  const [dailyRes, methodRes, topRes] = await Promise.all([
    supabase.rpc('report_daily', { p_branch: branchParam, p_from: queryFrom, p_to: range.to }),
    supabase.rpc('report_payment_methods', { p_branch: branchParam, p_from: range.from, p_to: range.to }),
    supabase.rpc('report_top_menus', { p_branch: branchParam, p_from: range.from, p_to: range.to, p_limit: 5 }),
  ]);

  const firstError = dailyRes.error || methodRes.error || topRes.error;
  if (firstError) throw new Error(firstError.message);

  const allRows = ((dailyRes.data || []) as DailyDb[]).map(mapDailyRow);
  const rows = allRows.filter((r) => r.date >= range.from && r.date <= range.to);
  const previousRows = previous ? allRows.filter((r) => r.date >= previous.from && r.date <= previous.to) : null;

  return {
    rows,
    previousRows,
    previous,
    methods: ((methodRes.data || []) as { method: PaymentMethod; tx_count: number | string; amount: number | string }[]).map(
      (m) => ({ method: m.method, txCount: num(m.tx_count), amount: num(m.amount) })
    ),
    topMenus: (
      (topRes.data || []) as {
        menu_item_id: string | null;
        menu_name: string;
        category: string | null;
        image_url: string | null;
        qty_sold: number | string;
        sales_amount: number | string;
      }[]
    ).map((t) => ({
      menuId: t.menu_item_id,
      name: t.menu_name,
      category: t.category,
      image: t.image_url,
      qty: num(t.qty_sold),
      sales: num(t.sales_amount),
    })),
  };
}

// ---------------------------------------------------------------------------
// Warna cabang
// ---------------------------------------------------------------------------

/** Urutan default: merah, hijau, kuning, lalu warna tambahan yang berbeda. */
export const BRANCH_PALETTE = [
  '#e31d36', // merah
  '#22c55e', // hijau
  '#eab308', // kuning
  '#3b82f6', // biru
  '#a855f7', // ungu
  '#f97316', // oranye
  '#14b8a6', // teal
  '#ec4899', // pink
];

export const BRANCH_COLOR_NAMES: Record<string, string> = {
  '#e31d36': 'Merah',
  '#22c55e': 'Hijau',
  '#eab308': 'Kuning',
  '#3b82f6': 'Biru',
  '#a855f7': 'Ungu',
  '#f97316': 'Oranye',
  '#14b8a6': 'Teal',
  '#ec4899': 'Pink',
};

/**
 * Warna tiap cabang ditentukan konfigurasi (Branch.chartColor). Cabang tanpa warna
 * mendapat warna palet berikutnya yang belum dipakai, berdasarkan urutan KODE cabang
 * (stabil, bukan urutan nilai penjualan) sehingga warna tidak berpindah-pindah.
 */
export function resolveBranchColors(branches: Branch[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const b of branches) {
    if (b.chartColor) {
      result.set(b.id, b.chartColor.toLowerCase());
      used.add(b.chartColor.toLowerCase());
    }
  }
  const sorted = [...branches].sort((a, b) => a.code.localeCompare(b.code));
  let cursor = 0;
  for (const b of sorted) {
    if (result.has(b.id)) continue;
    while (cursor < BRANCH_PALETTE.length && used.has(BRANCH_PALETTE[cursor])) cursor++;
    const color = BRANCH_PALETTE[cursor % BRANCH_PALETTE.length];
    result.set(b.id, color);
    used.add(color);
    cursor++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Agregasi
// ---------------------------------------------------------------------------

export interface Totals {
  gross: number;
  tax: number;
  service: number;
  revenue: number;
  expenses: number;
  net: number;
  txCount: number;
  /** null bila belum ada transaksi (hindari pembagian nol / angka palsu). */
  avgTicket: number | null;
}

export interface DailyPoint {
  date: string;
  revenue: number;
  expenses: number;
  net: number;
  txCount: number;
}

export interface BranchSeries {
  branchId: string;
  name: string;
  color: string;
  points: DailyPoint[];
  totals: Totals;
}

export interface FinancialSummary {
  range: DateRange;
  previous: DateRange | null;
  totals: Totals;
  previousTotals: Totals | null;
  daily: DailyPoint[];
  byBranch: BranchSeries[];
  /** Ada minimal satu transaksi sah pada periode. */
  hasSales: boolean;
  /** Ada minimal satu pengeluaran tercatat pada periode. */
  hasExpenses: boolean;
}

export function sumTotals(rows: DailyRow[]): Totals {
  let gross = 0;
  let tax = 0;
  let service = 0;
  let revenue = 0;
  let expenses = 0;
  let txCount = 0;
  for (const r of rows) {
    gross += r.gross;
    tax += r.tax;
    service += r.service;
    revenue += r.revenue;
    expenses += r.expenses;
    txCount += r.txCount;
  }
  return {
    gross,
    tax,
    service,
    revenue,
    expenses,
    net: revenue - expenses,
    txCount,
    avgTicket: txCount > 0 ? Math.round(revenue / txCount) : null,
  };
}

function seriesPoints(days: string[], rows: DailyRow[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const d of days) byDate.set(d, { date: d, revenue: 0, expenses: 0, net: 0, txCount: 0 });
  for (const r of rows) {
    const p = byDate.get(r.date);
    if (!p) continue;
    p.revenue += r.revenue;
    p.expenses += r.expenses;
    p.txCount += r.txCount;
  }
  for (const p of byDate.values()) p.net = p.revenue - p.expenses;
  return days.map((d) => byDate.get(d)!);
}

export function buildSummary(raw: Pick<RawReport, 'rows' | 'previousRows' | 'previous'>, branches: Branch[], branchFilter: string, range: DateRange): FinancialSummary {
  const days = eachDay(range);
  const colors = resolveBranchColors(branches);
  const scoped = branchFilter === 'all' ? branches : branches.filter((b) => b.id === branchFilter);
  const scopedIds = new Set(scoped.map((b) => b.id));
  const rows = raw.rows.filter((r) => scopedIds.has(r.branchId));
  const previousRows = raw.previousRows ? raw.previousRows.filter((r) => scopedIds.has(r.branchId)) : null;

  const totals = sumTotals(rows);
  const byBranch: BranchSeries[] = scoped.map((b) => {
    const own = rows.filter((r) => r.branchId === b.id);
    return {
      branchId: b.id,
      name: b.name,
      color: colors.get(b.id) || BRANCH_PALETTE[0],
      points: seriesPoints(days, own),
      totals: sumTotals(own),
    };
  });

  return {
    range,
    previous: raw.previous,
    totals,
    previousTotals: previousRows ? sumTotals(previousRows) : null,
    daily: seriesPoints(days, rows),
    byBranch,
    hasSales: totals.txCount > 0,
    hasExpenses: totals.expenses > 0,
  };
}

/** Perubahan persen terhadap periode lalu; null bila pembanding 0 (tidak bermakna). */
export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPct(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}

export { addDays };
