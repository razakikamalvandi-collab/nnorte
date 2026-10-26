import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { Save, CheckCircle2 } from "lucide-react";
import { Field, inputClass } from "../../components/ui/Field";

export const PengaturanGlobal: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [formData, setFormData] = useState(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
          Pengaturan Global NNORTE
        </h1>
        <p className="text-xs text-nnorte-muted mt-1">
          Identitas merek, mata uang Rupiah, tarif pajak PB1 restoran, dan preferensi sistem
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-nnorte-surface border border-nnorte-border rounded-xl p-6 space-y-5 text-xs">
        {savedSuccess && (
          <div className="p-3 rounded-lg bg-nnorte-success/10 border border-nnorte-success/30 text-nnorte-success flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Pengaturan global berhasil disimpan dan disinkronkan ke seluruh sistem!</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <Field label="Nama Brand / Restoran">
              <input
                type="text"
                value={formData.restaurantName}
                onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Tagline Merek">
              <input
                type="text"
                value={formData.brandTagline}
                onChange={(e) => setFormData({ ...formData, brandTagline: e.target.value })}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Mata Uang Utama">
              <input type="text" value={formData.currency} disabled className={inputClass(false, true)} />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Tarif Pajak Restoran (PB1 %)">
              <input
                type="number"
                value={formData.taxPercentage}
                onChange={(e) => setFormData({ ...formData, taxPercentage: Number(e.target.value) })}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Service Charge (%)">
              <input
                type="number"
                value={formData.serviceChargePercentage}
                onChange={(e) => setFormData({ ...formData, serviceChargePercentage: Number(e.target.value) })}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Email Kontak Resmi">
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Telepon Pusat">
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className={inputClass()}
              />
            </Field>
          </div>
        </div>

        <div className="pt-4 border-t border-nnorte-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-nnorte-muted">
            Perubahan konfigurasi akan tercatat pada Audit Log Keamanan.
          </span>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-nnorte-red hover:bg-nnorte-red-hover text-nnorte-on-brand font-semibold transition-all shadow-md cursor-pointer sm:w-auto"
          >
            <Save size={15} />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  );
};




