import React from 'react';
import { Building2, CalendarDays } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useReportFilters } from '../../context/ReportFilterContext';
import { DATE_PRESET_LABEL, DatePreset, formatRangeId } from '../../lib/dates';
import { inputClass } from '../ui/Field';

const PRESETS: DatePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'single', 'custom'];

/**
 * Filter cabang + periode untuk halaman laporan. Owner dapat memilih "Semua Cabang"
 * atau satu cabang; peran lain terkunci ke cabangnya (dan ditegakkan RLS di server).
 */
export const ReportFilterBar: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { branches, currentUser } = useApp();
  const { branchId, setBranchId, preset, setPreset, range, draft, setDraft, error } = useReportFilters();
  const isOwner = currentUser?.role === 'owner';
  const lockedBranch = !isOwner ? branches.find((b) => b.id === currentUser?.branchId) : undefined;

  return (
    <div className="space-y-2 rounded-xl border border-nnorte-border bg-nnorte-surface p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
        <div className="min-w-0 xl:w-64">
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-nnorte-muted" htmlFor="rf-branch">
            <Building2 size={12} className="text-nnorte-blue-soft" aria-hidden="true" /> Cabang
          </label>
          {isOwner ? (
            <select
              id="rf-branch"
              value={branchId}
              disabled={disabled}
              onChange={(e) => setBranchId(e.target.value)}
              className={inputClass() + ' cursor-pointer'}
            >
              <option value="all">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div id="rf-branch" className={inputClass() + ' flex items-center justify-between'}>
              <span className="truncate">{lockedBranch?.name || 'Cabang Anda'}</span>
              <span className="ml-2 shrink-0 rounded border border-nnorte-border px-1.5 py-0.5 text-[10px] text-nnorte-muted">Terkunci</span>
            </div>
          )}
        </div>

        <div className="min-w-0 xl:w-56">
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-nnorte-muted" htmlFor="rf-preset">
            <CalendarDays size={12} className="text-nnorte-blue-soft" aria-hidden="true" /> Periode
          </label>
          <select
            id="rf-preset"
            value={preset}
            disabled={disabled}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            className={inputClass() + ' cursor-pointer'}
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {DATE_PRESET_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        {preset === 'single' && (
          <div className="min-w-0 xl:w-44">
            <label className="mb-1 block text-[11px] font-semibold text-nnorte-muted" htmlFor="rf-single">
              Tanggal
            </label>
            <input
              id="rf-single"
              type="date"
              value={draft.from}
              disabled={disabled}
              onChange={(e) => setDraft({ from: e.target.value, to: e.target.value })}
              className={inputClass(!!error)}
              aria-invalid={!!error}
            />
          </div>
        )}

        {preset === 'custom' && (
          <>
            <div className="min-w-0 xl:w-44">
              <label className="mb-1 block text-[11px] font-semibold text-nnorte-muted" htmlFor="rf-from">
                Dari tanggal
              </label>
              <input
                id="rf-from"
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className={inputClass(!!error)}
                aria-invalid={!!error}
              />
            </div>
            <div className="min-w-0 xl:w-44">
              <label className="mb-1 block text-[11px] font-semibold text-nnorte-muted" htmlFor="rf-to">
                Sampai tanggal
              </label>
              <input
                id="rf-to"
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className={inputClass(!!error)}
                aria-invalid={!!error}
              />
            </div>
          </>
        )}

        <p className="text-[11px] text-nnorte-muted sm:col-span-2 xl:ml-auto xl:self-end xl:pb-2" aria-live="polite">
          Menampilkan: <span className="font-semibold text-nnorte-text">{formatRangeId(range)}</span> (WIB)
        </p>
      </div>
      {error && (
        <p role="alert" className="text-[11px] font-medium text-nnorte-error">
          {error} Tampilan tetap memakai periode valid terakhir.
        </p>
      )}
    </div>
  );
};
