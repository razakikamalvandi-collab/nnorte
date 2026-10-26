import { supabase } from './supabase';

export interface AiMenuResult {
  name: string;
  category: string;
  description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  allergens: string;
}

const clamp = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Sanitasi hasil AI menjadi draf menu yang aman dipakai form:
 * kategori dipaksa ke daftar klien, bahan dibatasi 20, qty selalu string positif.
 */
export function normalizeAiMenuResult(raw: unknown, categories: string[]): AiMenuResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = clamp(r.name, 100);
  const wanted = clamp(r.category, 60).toLowerCase();
  const category = categories.find((c) => c.toLowerCase() === wanted) ?? '';
  const description = clamp(r.description, 500);
  const rows = Array.isArray(r.ingredients) ? r.ingredients.slice(0, 20) : [];
  const ingredients = rows
    .map((row) => {
      const x = (row ?? {}) as Record<string, unknown>;
      const qty = typeof x.quantity === 'number' && Number.isFinite(x.quantity) && x.quantity > 0 ? x.quantity : 1;
      return { name: clamp(x.name, 100), quantity: String(qty), unit: clamp(x.unit, 30) };
    })
    .filter((row) => row.name.length > 0);
  const allergens = Array.isArray(r.allergens)
    ? r.allergens.map((a) => clamp(a, 40)).filter(Boolean).join(', ')
    : clamp(r.allergens, 300)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
  return { name, category, description, ingredients, allergens };
}

export async function generateMenuDraft(
  input: { prompt: string; categories: string[] },
): Promise<{ ok: true; data: AiMenuResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('ai-menu-assistant', {
    body: { prompt: input.prompt, categories: input.categories },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = (await ctx.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* pakai pesan default */
      }
    } else if (/Failed to send|fetch/i.test(msg)) {
      msg = 'Layanan asisten AI belum dapat dijangkau. Pastikan Edge Function "ai-menu-assistant" sudah di-deploy.';
    }
    return { ok: false, error: msg };
  }
  const res = data as { ok?: boolean; error?: string; menu?: unknown };
  if (!res?.ok) return { ok: false, error: res?.error ?? 'Permintaan ditolak.' };
  return { ok: true, data: normalizeAiMenuResult(res.menu, input.categories) };
}
