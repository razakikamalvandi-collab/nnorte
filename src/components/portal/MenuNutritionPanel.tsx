import { useMemo, useState } from "react";
import { calculateNutrition, type NutritionFacts } from "../../lib/nutrition";

interface Props {
  ingredients?: { name: string; quantity: number; unit: string }[] | null;
  allergens?: string[] | null;
  /** Bila ada nilai tersimpan dari admin, dipakai. Bila tidak, dihitung dari bahan. */
  nutrition?: NutritionFacts | null;
  otherDetails?: string | null;
}

type Tab = "komposisi" | "alergen" | "gizi";

export default function MenuNutritionPanel({ ingredients, allergens, nutrition, otherDetails }: Props) {
  const [tab, setTab] = useState<Tab>("komposisi");
  const list = ingredients ?? [];
  const algs = (allergens ?? []).filter((a) => a && a.toLowerCase() !== "tidak ada");

  const facts = useMemo<NutritionFacts | null>(() => {
    if (nutrition) return nutrition;
    if (list.length === 0) return null;
    const r = calculateNutrition(list);
    return r.totalWeight > 0 ? r : null;
  }, [nutrition, list]);

  const tabs: [Tab, string][] = [["komposisi", "Komposisi"], ["alergen", "Alergen"], ["gizi", "Gizi"]];

  return (
    <section aria-label="Informasi menu" className="rounded-xl border border-current/15">
      <div role="tablist" className="flex border-b border-current/15">
        {tabs.map(([k, label]) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 px-3 py-2 text-sm font-semibold ${tab === k ? "border-b-2 border-current" : "text-nnorte-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 text-sm" role="tabpanel">
        {tab === "komposisi" && (list.length ? (
          <ul className="space-y-1">
            {list.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span>{i.name}</span>
                <span className="text-nnorte-muted">{i.quantity} {i.unit}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-nnorte-muted">Komposisi belum diisi.</p>)}

        {tab === "alergen" && (algs.length ? (
          <div>
            <div className="flex flex-wrap gap-2">
              {algs.map((a) => <span key={a} className="rounded-full border border-current/25 px-3 py-1 text-xs font-semibold">{a}</span>)}
            </div>
            <p className="mt-2 text-xs text-nnorte-muted">Hubungi kasir bila Anda memiliki alergi berat.</p>
          </div>
        ) : <p className="text-nnorte-muted">Tidak ada alergen yang tercatat.</p>)}

        {tab === "gizi" && (facts ? (
          <div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
              {([["Kalori", facts.calories, "kkal"], ["Protein", facts.protein, "g"], ["Karbohidrat", facts.carbs, "g"],
                ["Lemak", facts.fat, "g"], ["Gula", facts.sugar, "g"], ["Serat", facts.fiber, "g"], ["Natrium", facts.sodium, "mg"]] as const)
                .map(([l, v, u]) => (
                  <div key={l} className="flex justify-between"><dt>{l}</dt><dd className="font-semibold">{v} {u}</dd></div>
                ))}
            </dl>
            <p className="mt-2 text-xs text-nnorte-muted">Nilai per porsi, berupa estimasi.</p>
            {otherDetails && <p className="mt-2">{otherDetails}</p>}
          </div>
        ) : <p className="text-nnorte-muted">Informasi gizi belum tersedia.</p>)}
      </div>
    </section>
  );
}
