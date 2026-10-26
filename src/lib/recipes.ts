import type { MenuIngredient } from "../types";

/** Baris editor resep: angka disimpan sebagai string agar input form tidak kehilangan desimal. */
export interface RecipeDraft {
  name: string;
  quantity: string;
  unit: string;
}

const hasData = (row: RecipeDraft) =>
  row.name.trim().length > 0 || row.quantity.trim().length > 0 || row.unit.trim().length > 0;

/**
 * Memvalidasi seluruh baris resep. Baris yang benar-benar kosong diabaikan.
 * Mengembalikan pesan error pertama atau null bila valid.
 */
export function validateRecipeRows(rows: RecipeDraft[]): string | null {
  const used = new Map<string, string>();

  for (const row of rows) {
    if (!hasData(row)) continue;

    const name = row.name.trim();
    const unit = row.unit.trim();
    const quantity = Number(row.quantity);

    if (!name) return "Nama bahan wajib diisi.";
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Jumlah bahan harus berupa angka lebih dari 0.";
    }
    if (!unit) return "Satuan bahan wajib diisi.";

    const key = name.toLocaleLowerCase("id-ID");
    const previous = used.get(key);
    if (previous) return `Bahan "${previous}" tercantum lebih dari sekali.`;
    used.set(key, name);
  }

  return null;
}

/** Membersihkan baris kosong dan mengubah jumlah menjadi angka. Validasi dilakukan lebih dulu. */
export function toRecipeIngredients(rows: RecipeDraft[]): MenuIngredient[] {
  return rows
    .filter(hasData)
    .map((row) => ({
      name: row.name.trim(),
      quantity: Number(row.quantity),
      unit: row.unit.trim(),
    }));
}
