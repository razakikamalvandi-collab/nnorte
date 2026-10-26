import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, Wallet, DollarSign, Receipt } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useReportFilters } from '../../context/ReportFilterContext';
import { useFinancialReport } from '../../hooks/useFinancialReport';
import { StatCard } from '../../components/common/StatCard';
import { ReportFilterBar } from '../../components/common/ReportFilterBar';
import { ReportExportButtons } from '../../components/common/ReportExportButtons';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { NetProfitChart, PaymentMethodChart } from '../../components/charts/FinancialCharts';
import { EXPENSE_CATEGORY_LABEL, createExpense, deleteExpense, listExpenses } from '../../lib/expenses';
import { formatDateId, todayInBusinessTz } from '../../lib/dates';
import { formatRupiah } from '../../utils/formatters';
import { Expense, ExpenseCategory } from '../../types';

export const LaporanKeuangan: React.FC = () => {
  const { branches, currentUser, restaurantId, addToast, addAuditLog } = useApp();
  const { branchId } = useReportFilters();
  const { summary, raw, loading, error, reload, range } = useFinancialReport();
  const canWrite = currentUser?.role === 'owner' || currentUser?.role === 'branch_admin';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLoading, setExpLoading] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ branchId: '', date: todayInBusinessTz(), category: 'bahan_baku' as ExpenseCategory, description: '', amount: '' });

  const effBranch = currentUser && currentUser.role !== 'owner' && currentUser.branchId ? currentUser.branchId : branchId;

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    setExpError(null);
    try {
      setExpenses(await listExpenses(effBranch, range.from, range.to));
    } catch (e) {
      setExpError(e instanceof Error ? e.message : 'Gagal memuat pengeluaran.');
    } finally {
      setExpLoading(false);
    }
  }, [effBranch, range.from, range.to]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const openForm = () => {
    setForm({
      branchId: effBranch !== 'all' ? effBranch : branches[0]?.id ?? '',
      date: todayInBusinessTz(),
      category: 'bahan_baku',
      description: '',
      amount: '',
    });
    setFormError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !restaurantId) return;
    const amount = Number(form.amount);
    if (!form.branchId) return setFormError('Pilih cabang.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError('Tanggal tidak valid.');
    if (!Number.isFinite(amount) || amount <= 0) return setFormError('Nominal harus lebih dari 0.');
    setSaving(true);
    setFormError(null);
    try {
      await createExpense(restaurantId, { branchId: form.branchId, date: form.date, category: form.category, description: form.description, amount });
      void addAuditLog('CATAT_PENGELUARAN', `${form.category} ${formatRupiah(amount)} ${form.date}`);
      addToast('success', 'Pengeluaran dicatat.');
      setOpen(false);
      await Promise.all([loadExpenses(), reload()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (x: Expense) => {
    if (!window.confirm(`Hapus pengeluaran ${formatRupiah(x.amount)} (${EXPENSE_CATEGORY_LABEL[x.category]})?`)) return;
    try {
      await deleteExpense(x.id);
      void addAuditLog('HAPUS_PENGELUARAN', `${x.category} ${formatRupiah(x.amount)} ${x.date}`);
      addToast('success', 'Pengeluaran dihapus.');
      await Promise.all([loadExpenses(), reload()]);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal menghapus.');
    }
  };

  const t = summary?.totals;
  const byCategory = expenses.reduce<Partial<Record<ExpenseCategory, number>>>((acc, x) => {
    acc[x.category] = (acc[x.category] ?? 0) + x.amount;
    return acc;
  }, {});
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Laporan Keuangan</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Laba rugi dari transaksi lunas dan pengeluaran yang tercatat</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button variant="secondary" icon={<Plus size={14} />} onClick={openForm} disabled={branches.length === 0}>
              Catat Pengeluaran
            </Button>
          )}
          <ReportExportButtons summary={summary} raw={raw} loading={loading} />
        </div>
      </div>

      <ReportFilterBar />

      {error && <ErrorState message={error} onRetry={() => void reload()} />}
      {loading && !summary && <Skeleton className="h-40" />}

      {summary && t && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} title="Pendapatan" value={formatRupiah(t.revenue)} icon={DollarSign} subtext="Tanpa PB1" />
            <StatCard index={1} title="Pengeluaran" value={summary.hasExpenses ? formatRupiah(t.expenses) : '—'} icon={Wallet} subtext={summary.hasExpenses ? undefined : 'Belum ada yang tercatat'} />
            <StatCard index={2} title={t.net < 0 ? 'Rugi Bersih' : 'Laba Bersih'} value={formatRupiah(t.net)} icon={TrendingUp} badge={summary.hasExpenses ? undefined : 'Belum dikurangi biaya'} />
            <StatCard index={3} title="Margin" value={summary.hasExpenses && t.revenue > 0 ? `${((t.net / t.revenue) * 100).toFixed(1).replace('.', ',')}%` : '—'} icon={Receipt} subtext={`${t.txCount.toLocaleString('id-ID')} transaksi`} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Laba / Rugi Bersih Harian</h2>
              {summary.hasSales || summary.hasExpenses ? (
                <NetProfitChart daily={summary.daily} />
              ) : (
                <EmptyState compact icon={Receipt} title="Belum ada transaksi pada periode ini." />
              )}
            </section>
            <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Metode Pembayaran</h2>
              {raw && raw.methods.length > 0 ? <PaymentMethodChart methods={raw.methods} /> : <EmptyState compact icon={Receipt} title="Belum ada pembayaran" />}
            </section>
          </div>
        </div>
      )}

      <section className="nn-rise overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-nnorte-border p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-bold text-nnorte-text">Pengeluaran Tercatat</h2>
            <p className="text-xs text-nnorte-muted">{formatDateId(range.from)} – {formatDateId(range.to)}</p>
          </div>
          {Object.keys(byCategory).length > 0 && (
            <ul className="flex flex-wrap gap-1.5 text-[10px]">
              {(Object.entries(byCategory) as [ExpenseCategory, number][]).map(([c, v]) => (
                <li key={c} className="rounded-full border border-nnorte-border bg-nnorte-surface-2 px-2 py-0.5 text-nnorte-muted">
                  {EXPENSE_CATEGORY_LABEL[c]}: <b className="text-nnorte-text">{formatRupiah(v)}</b>
                </li>
              ))}
            </ul>
          )}
        </header>
        {expError ? (
          <div className="p-4"><ErrorState message={expError} onRetry={() => void loadExpenses()} /></div>
        ) : expLoading && expenses.length === 0 ? (
          <div className="p-4"><Skeleton className="h-24" /></div>
        ) : expenses.length === 0 ? (
          <div className="p-4">
            <EmptyState compact icon={Wallet} title="Belum ada pengeluaran pada periode ini." description={canWrite ? 'Gunakan "Catat Pengeluaran" agar laba bersih dapat dihitung.' : undefined} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-nnorte-text">
              <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Keterangan</th>
                  <th className="px-4 py-3 text-right font-semibold">Nominal</th>
                  {canWrite && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-nnorte-border">
                {expenses.map((x) => (
                  <tr key={x.id} className="hover:bg-nnorte-surface-2/60">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateId(x.date)}</td>
                    <td className="px-4 py-3 text-nnorte-muted">{branchName(x.branchId)}</td>
                    <td className="px-4 py-3">{EXPENSE_CATEGORY_LABEL[x.category]}</td>
                    <td className="px-4 py-3 text-nnorte-muted">{x.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatRupiah(x.amount)}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <button type="button" aria-label="Hapus pengeluaran" onClick={() => void remove(x)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border text-nnorte-error hover:bg-nnorte-error/10">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={open}
        onClose={() => !saving && setOpen(false)}
        title="Catat Pengeluaran"
        subtitle="Dipakai untuk menghitung laba bersih"
        busy={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
            <Button type="submit" form="expense-form" loading={saving} loadingText="Menyimpan…">Simpan</Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{formError}</p>}
          <Field label="Cabang" required>
            <select className={inputClass()} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} disabled={currentUser?.role !== 'owner'}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Tanggal" required>
            <input type="date" className={inputClass()} value={form.date} max={todayInBusinessTz()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Kategori" required>
            <select className={inputClass()} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {(Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Nominal (Rp)" required>
            <input type="number" inputMode="numeric" min={1} step={1} className={inputClass()} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="250000" />
          </Field>
          <Field label="Keterangan">
            <input type="text" maxLength={300} className={inputClass()} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opsional" />
          </Field>
        </form>
      </Modal>
    </div>
  );
};
