import { describe, expect, it } from 'vitest';
import { BRANCH_PALETTE, buildSummary, formatPct, pctChange, resolveBranchColors, sumTotals, DailyRow } from '../finance';
import { Branch } from '../../types';

const branch = (id: string, code: string, extra: Partial<Branch> = {}): Branch => ({
  id,
  code,
  name: `Cabang ${id}`,
  tagline: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  operatingHours: '',
  status: 'active',
  totalTables: 0,
  is24Hours: false,
  ...extra,
});

const row = (date: string, branchId: string, revenue: number, tx: number, expenses = 0): DailyRow => ({
  date,
  branchId,
  gross: revenue * 1.1,
  tax: revenue * 0.1,
  service: 0,
  revenue,
  txCount: tx,
  expenses,
});

describe('warna cabang', () => {
  it('urut berdasarkan kode: merah, hijau, kuning (bukan berdasarkan nilai penjualan)', () => {
    const colors = resolveBranchColors([branch('b', 'NN-BDG-01'), branch('a', 'NN-AAA-01'), branch('c', 'NN-ZZZ-01')]);
    expect(colors.get('a')).toBe(BRANCH_PALETTE[0]);
    expect(colors.get('b')).toBe(BRANCH_PALETTE[1]);
    expect(colors.get('c')).toBe(BRANCH_PALETTE[2]);
  });
  it('warna konfigurasi dihormati dan tidak dipakai dua kali', () => {
    const colors = resolveBranchColors([
      branch('a', 'NN-AAA-01', { chartColor: '#22c55e' }),
      branch('b', 'NN-BBB-01'),
      branch('c', 'NN-CCC-01'),
    ]);
    expect(colors.get('a')).toBe('#22c55e');
    expect(new Set(colors.values()).size).toBe(3);
  });
  it('cabang banyak tetap mendapat warna', () => {
    const many = Array.from({ length: 10 }, (_, i) => branch(String(i), `NN-X-${String(i).padStart(2, '0')}`));
    expect(resolveBranchColors(many).size).toBe(10);
  });
});

describe('agregasi laporan', () => {
  const branches = [branch('a', 'NN-AAA-01'), branch('b', 'NN-BBB-01')];
  const range = { from: '2026-10-20', to: '2026-10-22' };

  it('menjumlahkan semua cabang dan mengisi hari kosong dengan 0', () => {
    const s = buildSummary(
      { rows: [row('2026-10-20', 'a', 100, 2), row('2026-10-22', 'b', 300, 3, 50)], previousRows: null, previous: null },
      branches,
      'all',
      range
    );
    expect(s.totals.revenue).toBe(400);
    expect(s.totals.txCount).toBe(5);
    expect(s.totals.expenses).toBe(50);
    expect(s.totals.net).toBe(350);
    expect(s.totals.avgTicket).toBe(80);
    expect(s.daily.map((d) => d.revenue)).toEqual([100, 0, 300]);
    expect(s.daily.map((d) => d.net)).toEqual([100, 0, 250]);
    expect(s.byBranch).toHaveLength(2);
    expect(s.hasSales).toBe(true);
    expect(s.hasExpenses).toBe(true);
  });

  it('filter cabang tunggal tidak menyertakan cabang lain', () => {
    const s = buildSummary(
      { rows: [row('2026-10-20', 'a', 100, 2), row('2026-10-22', 'b', 300, 3)], previousRows: null, previous: null },
      branches,
      'b',
      range
    );
    expect(s.totals.revenue).toBe(300);
    expect(s.byBranch.map((b) => b.branchId)).toEqual(['b']);
  });

  it('tanpa transaksi: avgTicket null dan hasSales false (bukan angka palsu)', () => {
    const s = buildSummary({ rows: [], previousRows: [], previous: null }, branches, 'all', range);
    expect(s.totals.avgTicket).toBeNull();
    expect(s.hasSales).toBe(false);
    expect(s.hasExpenses).toBe(false);
    expect(s.daily).toHaveLength(3);
  });

  it('laba bisa negatif ketika pengeluaran melebihi pendapatan', () => {
    expect(sumTotals([row('2026-10-20', 'a', 100, 1, 250)]).net).toBe(-150);
  });
});

describe('perubahan persen', () => {
  it('null bila pembanding 0', () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
    expect(formatPct(null)).toBeUndefined();
  });
  it('menghitung dan memformat', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(formatPct(12.34)).toBe('+12,3%');
    expect(formatPct(-5)).toBe('-5,0%');
  });
});
