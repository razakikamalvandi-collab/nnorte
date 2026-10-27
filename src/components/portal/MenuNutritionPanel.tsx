import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { calculateNutrition, type NutritionFacts } from "../../lib/nutrition";
import type { PortalMenuReviews } from "../../lib/portalApi";

interface Props {
  ingredients?: { name: string; quantity: number; unit: string }[] | null;
  allergens?: string[] | null;
  nutrition?: NutritionFacts | null;
  otherDetails?: string | null;
  reviews?: PortalMenuReviews | null;
  reviewsLoading?: boolean;
  reviewsError?: string | null;
}

type Tab = "komposisi" | "alergen" | "detail" | "ulasan";

export default function MenuNutritionPanel({ ingredients, allergens, nutrition, otherDetails, reviews, reviewsLoading = false, reviewsError }: Props) {
  const [tab, setTab] = useState<Tab>("komposisi");
  const list = ingredients ?? [];
  const algs = (allergens ?? []).filter((allergen) => allergen && allergen.toLowerCase() !== "tidak ada");
  const facts = useMemo<NutritionFacts | null>(() => {
    if (nutrition) return nutrition;
    if (list.length === 0) return null;
    const result = calculateNutrition(list);
    return result.totalWeight > 0 ? result : null;
  }, [nutrition, list]);

  const tabs: [Tab, string][] = [
    ["komposisi", "Komposisi Bahan"],
    ["alergen", "Alergen"],
    ["detail", "Detail Lainnya"],
    ["ulasan", "Ulasan"],
  ];

  return (
    <div className="space-y-4">
      <section aria-labelledby="menu-nutrition-title">
        <h3 id="menu-nutrition-title" className="mb-2 text-sm font-bold text-nnorte-text">Informasi Nutrisi</h3>
        {facts ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ["Energi", facts.calories, "kkal"],
              ["Protein", facts.protein, "g"],
              ["Karbohidrat", facts.carbs, "g"],
              ["Gula", facts.sugar, "g"],
              ["Serat", facts.fiber, "g"],
              ["Natrium", facts.sodium, "mg"],
            ] as const).map(([label, value, unit]) => (
              <div key={label} className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border border-nnorte-border bg-nnorte-surface-2 px-2 py-2 text-center">
                <dt className="order-2 mt-0.5 text-[10px] text-nnorte-muted">{unit === "kkal" ? "kkal Energi" : label}</dt>
                <dd className="order-1 text-lg font-black leading-tight text-nnorte-text">{value}{unit === "kkal" ? "" : ` ${unit}`}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3 text-xs text-nnorte-muted">Informasi nutrisi belum tersedia untuk menu ini.</p>
        )}
        <p className="mt-1.5 text-[10px] text-nnorte-muted">Per porsi, berupa estimasi dari komposisi yang tercatat.</p>
      </section>

      <section aria-label="Informasi menu" className="rounded-xl border border-current/15">
        <div role="tablist" className="flex border-b border-current/15">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 whitespace-nowrap px-2 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${tab === key ? "border-b-2 border-nnorte-red text-nnorte-red" : "text-nnorte-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-3 text-sm" role="tabpanel">
          {tab === "komposisi" && (list.length ? (
            <ul className="space-y-1">
              {list.map((ingredient) => (
                <li key={ingredient.name} className="flex justify-between gap-3">
                  <span>{ingredient.name}</span>
                  <span className="text-nnorte-muted">{ingredient.quantity} {ingredient.unit}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-nnorte-muted">Komposisi belum diisi.</p>)}

          {tab === "alergen" && (algs.length ? (
            <div>
              <div className="flex flex-wrap gap-2">
                {algs.map((allergen) => <span key={allergen} className="rounded-full border border-current/25 px-3 py-1 text-xs font-semibold">{allergen}</span>)}
              </div>
              <p className="mt-2 text-xs text-nnorte-muted">Hubungi kasir bila Anda memiliki alergi berat.</p>
            </div>
          ) : <p className="text-nnorte-muted">Tidak ada alergen yang tercatat.</p>)}

          {tab === "detail" && <p className="text-nnorte-muted">{otherDetails || "Belum ada detail tambahan untuk menu ini."}</p>}

          {tab === "ulasan" && (
            <div className="space-y-3">
              {reviewsLoading ? <p className="text-nnorte-muted">Memuat ulasan pelanggan…</p> : reviewsError ? (
                <p role="alert" className="text-nnorte-error">{reviewsError}</p>
              ) : reviews && reviews.count > 0 ? (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-nnorte-surface-2 p-3">
                    <div className="flex items-center gap-1 text-nnorte-warning" aria-label={`Rating rata-rata ${reviews.averageRating} dari 5`}>
                      <Star size={17} className="fill-current" aria-hidden="true" />
                      <span className="font-bold text-nnorte-text">{reviews.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-nnorte-muted">dari {reviews.count} rating pesanan</span>
                  </div>
                  {reviews.reviews.length > 0 ? reviews.reviews.map((entry, index) => (
                    <article key={`${entry.createdAt}-${index}`} className="rounded-xl border border-nnorte-border bg-nnorte-surface p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-nnorte-warning" aria-label={`${entry.rating} dari 5 bintang`}>
                          {Array.from({ length: 5 }, (_, star) => <Star key={star} size={12} className={star < entry.rating ? "fill-current" : ""} aria-hidden="true" />)}
                        </div>
                        <time className="text-[10px] text-nnorte-muted" dateTime={entry.createdAt}>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("id-ID") : "Pelanggan"}</time>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-nnorte-text">{entry.review}</p>
                    </article>
                  )) : <p className="text-xs text-nnorte-muted">Belum ada komentar tertulis untuk menu ini.</p>}
                </>
              ) : <p className="text-nnorte-muted">Belum ada ulasan untuk menu ini.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
