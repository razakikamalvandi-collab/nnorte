import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { FinancialSummary, RawReport } from '../../lib/finance';
import { exportReportPdf, exportReportXlsx } from '../../lib/exporters';

/**
 * Tombol Ekspor PDF/Excel. Memakai summary yang sama dengan layar (cabang, periode, aturan hitung),
 * mencegah klik ganda, dan melaporkan hasil/kegagalan sebenarnya.
 */
export const ReportExportButtons: React.FC<{
  summary: FinancialSummary | null;
  raw: RawReport | null;
  loading: boolean;
}> = ({ summary, raw, loading }) => {
  const { branches, settings, currentUser, addToast, addAuditLog } = useApp();
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const disabled = !summary || !raw || loading || busy !== null;

  const run = async (kind: 'pdf' | 'xlsx') => {
    if (!summary || !raw || busy) return;
    setBusy(kind);
    try {
      const branchLabel =
        summary.byBranch.length === 1 && summary.byBranch[0] && branches.length !== 1
          ? summary.byBranch[0].name
          : branches.length === summary.byBranch.length
            ? 'Semua Cabang'
            : summary.byBranch.map((b) => b.name).join(', ');
      const input = {
        summary,
        branchLabel,
        restaurantName: settings.restaurantName || 'NNORTE',
        methods: raw.methods,
        generatedBy: currentUser?.name || 'Pengguna',
      };
      const filename = kind === 'pdf' ? await exportReportPdf(input) : await exportReportXlsx(input);
      addToast('success', `Laporan diunduh: ${filename}`);
      void addAuditLog('EKSPOR_LAPORAN', `${kind.toUpperCase()} ${branchLabel} ${summary.range.from}..${summary.range.to}`);
    } catch (e) {
      console.error(e);
      addToast('error', `Ekspor ${kind === 'pdf' ? 'PDF' : 'Excel'} gagal: ${e instanceof Error ? e.message : 'kesalahan tidak dikenal'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" icon={<Download size={14} className="text-nnorte-blue-soft" />} loading={busy === 'pdf'} loadingText="Membuat PDF…" disabled={disabled} onClick={() => run('pdf')}>
        Ekspor PDF
      </Button>
      <Button variant="accent" icon={<FileSpreadsheet size={14} />} loading={busy === 'xlsx'} loadingText="Membuat Excel…" disabled={disabled} onClick={() => run('xlsx')}>
        Ekspor Excel
      </Button>
    </div>
  );
};
