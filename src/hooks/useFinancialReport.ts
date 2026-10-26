import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useReportFilters } from '../context/ReportFilterContext';
import { FinancialSummary, RawReport, buildSummary, fetchReportData } from '../lib/finance';

/**
 * Mengambil data laporan dari RPC (RLS berlaku) untuk cabang + periode aktif.
 * Aman terhadap race: hanya respons permintaan terbaru yang dipakai.
 */
export function useFinancialReport() {
  const { branches, currentUser } = useApp();
  const { branchId, range, error: rangeError } = useReportFilters();
  const [raw, setRaw] = useState<RawReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Non-owner selalu terkunci ke cabangnya sendiri (otorisasi sebenarnya di RLS).
  const effectiveBranch = currentUser && currentUser.role !== 'owner' && currentUser.branchId ? currentUser.branchId : branchId;

  const load = useCallback(async () => {
    if (!currentUser || rangeError) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportData(effectiveBranch, range);
      if (id !== requestId.current) return;
      setRaw(data);
    } catch (e) {
      if (id !== requestId.current) return;
      setRaw(null);
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [currentUser, effectiveBranch, range, rangeError]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary: FinancialSummary | null = useMemo(
    () => (raw ? buildSummary(raw, branches, effectiveBranch, range) : null),
    [raw, branches, effectiveBranch, range]
  );

  return { summary, raw, loading, error, reload: load, branchId: effectiveBranch, range };
}
