import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DatePreset,
  DateRange,
  rangeForPreset,
  todayInBusinessTz,
  validateRange,
} from '../lib/dates';

/**
 * Filter laporan bersama (Dashboard, Laporan Keuangan, Analitik): cabang + periode.
 * Disimpan di context supaya tetap sama saat berpindah halaman, dan semua KPI/grafik/
 * ekspor memakai periode yang identik.
 */
interface ReportFilterState {
  branchId: string; // 'all' | uuid cabang
  setBranchId: (id: string) => void;
  preset: DatePreset;
  setPreset: (p: DatePreset) => void;
  /** Rentang yang dipakai untuk query: selalu valid. */
  range: DateRange;
  /** Isian mentah untuk input tanggal (boleh belum valid). */
  draft: DateRange;
  setDraft: (r: DateRange) => void;
  /** Pesan validasi untuk isian kustom, atau null. */
  error: string | null;
  today: string;
}

const Ctx = createContext<ReportFilterState | undefined>(undefined);

/** Tanggal hari ini (Asia/Jakarta) yang ikut berganti saat lewat tengah malam. */
function useToday(): string {
  const [today, setToday] = useState(() => todayInBusinessTz());
  useEffect(() => {
    const t = window.setInterval(() => setToday((prev) => {
      const now = todayInBusinessTz();
      return now === prev ? prev : now;
    }), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

export const ReportFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const today = useToday();
  const [branchId, setBranchIdState] = useState('all');
  const [preset, setPresetState] = useState<DatePreset>('last30');
  const [draft, setDraftState] = useState<DateRange>(() => rangeForPreset('last30', todayInBusinessTz()));
  const [custom, setCustom] = useState<DateRange>(() => rangeForPreset('last30', todayInBusinessTz()));

  const setBranchId = useCallback((id: string) => setBranchIdState(id), []);

  const setPreset = useCallback(
    (p: DatePreset) => {
      setPresetState(p);
      if (p === 'single') {
        // Mulai dari hari ini, atau tanggal akhir kustom yang sedang aktif.
        const day = custom.to || today;
        const r = { from: day, to: day };
        setDraftState(r);
        setCustom(r);
      } else if (p === 'custom') {
        setDraftState(custom);
      } else {
        const r = rangeForPreset(p, today);
        setDraftState(r);
      }
    },
    [custom, today]
  );

  const setDraft = useCallback(
    (r: DateRange) => {
      setDraftState(r);
      const effective = preset === 'single' ? { from: r.from, to: r.from } : r;
      if (validateRange(effective) === null) setCustom(effective);
    },
    [preset]
  );

  const range = useMemo<DateRange>(() => {
    if (preset === 'custom' || preset === 'single') return custom;
    return rangeForPreset(preset, today);
  }, [preset, custom, today]);

  const error = useMemo(() => {
    if (preset !== 'custom' && preset !== 'single') return null;
    const effective = preset === 'single' ? { from: draft.from, to: draft.from } : draft;
    return validateRange(effective);
  }, [preset, draft]);

  const value = useMemo<ReportFilterState>(
    () => ({ branchId, setBranchId, preset, setPreset, range, draft, setDraft, error, today }),
    [branchId, setBranchId, preset, setPreset, range, draft, setDraft, error, today]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useReportFilters = (): ReportFilterState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReportFilters must be used within ReportFilterProvider');
  return ctx;
};
