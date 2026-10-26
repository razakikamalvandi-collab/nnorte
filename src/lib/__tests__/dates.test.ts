import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  eachDay,
  endOfMonth,
  formatDateId,
  formatRangeId,
  isValidIsoDate,
  previousRange,
  rangeForPreset,
  todayInBusinessTz,
  validateRange,
} from '../dates';

describe('todayInBusinessTz', () => {
  it('memakai tanggal Asia/Jakarta, bukan UTC', () => {
    // 21 Okt 2026 18:30 UTC = 22 Okt 2026 01:30 WIB
    expect(todayInBusinessTz(new Date('2026-10-21T18:30:00Z'))).toBe('2026-10-22');
    // 22 Okt 2026 16:59 UTC = 22 Okt 23:59 WIB
    expect(todayInBusinessTz(new Date('2026-10-22T16:59:00Z'))).toBe('2026-10-22');
    // 22 Okt 2026 17:00 UTC = 23 Okt 00:00 WIB
    expect(todayInBusinessTz(new Date('2026-10-22T17:00:00Z'))).toBe('2026-10-23');
  });
});

describe('aritmetika tanggal', () => {
  it('addDays melewati batas bulan, tahun, dan kabisat', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays & eachDay inklusif', () => {
    expect(diffDays('2026-10-01', '2026-10-07')).toBe(6);
    expect(eachDay({ from: '2026-10-30', to: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(eachDay({ from: '2026-10-22', to: '2026-10-22' })).toEqual(['2026-10-22']);
  });
  it('endOfMonth', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-05')).toBe('2026-12-31');
  });
});

describe('preset', () => {
  const today = '2026-10-22';
  it('hari ini, kemarin, 7 & 30 hari', () => {
    expect(rangeForPreset('today', today)).toEqual({ from: '2026-10-22', to: '2026-10-22' });
    expect(rangeForPreset('yesterday', today)).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    expect(rangeForPreset('last7', today)).toEqual({ from: '2026-10-16', to: '2026-10-22' });
    expect(rangeForPreset('last30', today)).toEqual({ from: '2026-09-23', to: '2026-10-22' });
  });
  it('bulan ini & bulan sebelumnya', () => {
    expect(rangeForPreset('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-22' });
    expect(rangeForPreset('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeForPreset('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(rangeForPreset('lastMonth', '2026-03-05')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('validasi', () => {
  it('menolak tanggal tidak valid atau terbalik', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-10-22')).toBe(true);
    expect(validateRange({ from: '2026-10-22', to: '2026-10-21' })).toMatch(/sebelum/);
    expect(validateRange({ from: '', to: '2026-10-21' })).toMatch(/tidak valid/);
    expect(validateRange({ from: '2024-01-01', to: '2026-10-21' })).toMatch(/maksimal/);
    expect(validateRange({ from: '2026-10-01', to: '2026-10-22' })).toBeNull();
    expect(validateRange({ from: '2026-10-22', to: '2026-10-22' })).toBeNull();
  });
  it('previousRange sama panjang tepat sebelumnya', () => {
    expect(previousRange({ from: '2026-10-16', to: '2026-10-22' })).toEqual({ from: '2026-10-09', to: '2026-10-15' });
    expect(previousRange({ from: '2026-10-22', to: '2026-10-22' })).toEqual({ from: '2026-10-21', to: '2026-10-21' });
  });
});

describe('format', () => {
  it('format tanggal Indonesia', () => {
    expect(formatDateId('2026-10-05')).toBe('5 Okt 2026');
    expect(formatRangeId({ from: '2026-10-05', to: '2026-10-05' })).toBe('5 Okt 2026');
    expect(formatRangeId({ from: '2026-10-05', to: '2026-10-22' })).toBe('5 Okt 2026 – 22 Okt 2026');
  });
});
