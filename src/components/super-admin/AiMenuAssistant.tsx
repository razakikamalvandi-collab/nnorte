
import { useEffect, useMemo, useState, type ButtonHTMLAttributes } from "react";
import {
  buildDescription,
  calculateNutrition,
  detectAllergens,
  suggestIngredients,
  toFormPatch,
  type IngredientInput,
  type NutritionFacts,
} from "../../lib/nutrition";

export interface AiMenuResult {
  name: string;
  category: string;
  description: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  allergens: string;
  nutrition: NutritionFacts;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (result: AiMenuResult) => void;
  initialName?: string;
  initialCategory?: string;
  categories?: string[];
}

interface Row extends IngredientInput {
  id: number;
}

let rowSeq = 1;

const newRow = (r?: Partial<IngredientInput>): Row => ({
  id: rowSeq++,
  name: r?.name ?? "",
  quantity: r?.quantity ?? 100,
  unit: r?.unit ?? "gram",
});

const field =
  "w-full rounded-lg border border-current/15 bg-current/5 px-3 py-2 text-sm outline-none focus:border-current/40";

function Primary({
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      className={`rounded-lg bg-current px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
        p.className ?? ""
      }`}
    >
      <span className="text-nnorte-surface">{children}</span>
    </button>
  );
}

function Ghost({
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      className={`rounded-lg border border-current/20 px-4 py-2 text-sm font-medium disabled:opacity-40 ${
        p.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

export default function AiMenuAssistant({
  open,
  onClose,
  onApply,
  initialName = "",
  initialCategory = "",
  categories = [],
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(
    initialCategory || categories[0] || "",
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [description, setDescription] = useState("");
  const [allergenText, setAllergenText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Membuat pratinjau foto dan membersihkan URL saat foto berubah.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Reset isi asisten setiap kali dialog dibuka.
  useEffect(() => {
    if (!open) return;

    setStep(1);
    setName(initialName);
    setCategory(initialCategory || categories[0] || "");
    setPhoto(null);
    setPhotoError(null);
    setRows([]);
    setDescription("");
    setAllergenText("");
    setError(null);
    // Reset hanya ketika dialog dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const clean = useMemo(
    () => rows.filter((r) => r.name.trim()),
    [rows],
  );

  const nutrition = useMemo(
    () => calculateNutrition(clean),
    [clean],
  );

  if (!open) return null;

  const selectPhoto = (file?: File) => {
    setPhotoError(null);

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("File harus berupa gambar.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Gunakan foto JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Ukuran foto maksimal 5 MB.");
      return;
    }

    setPhoto(file);
    setError(null);
  };

  const start = () => {
    if (!name.trim()) {
      setError("Isi nama menu terlebih dahulu.");
      return;
    }

    if (!photo) {
      setError("Unggah foto makanan atau minuman terlebih dahulu.");
      return;
    }

    setError(null);

    // Saran bahan masih memakai aturan dari nutrition.ts.
    // Foto saat ini menjadi referensi visual, belum dianalisis oleh model AI.
    const suggestions = suggestIngredients(name.trim());

    setRows(
      suggestions.length
        ? suggestions.map(newRow)
        : [newRow()],
    );

    setStep(2);
  };

  const toResult = () => {
    if (clean.length === 0) {
      setError("Tambahkan minimal satu bahan.");
      return;
    }

    const bad = clean.find(
      (r) =>
        !Number.isFinite(r.quantity) ||
        !(r.quantity > 0) ||
        !r.unit.trim(),
    );

    if (bad) {
      setError(
        `Takaran "${bad.name}" belum valid. Jumlah harus lebih dari 0 dan satuan wajib diisi.`,
      );
      return;
    }

    const duplicates = new Set<string>();

    for (const row of clean) {
      const key = row.name.trim().toLowerCase();

      if (duplicates.has(key)) {
        setError(`Bahan "${row.name}" tercantum lebih dari sekali.`);
        return;
      }

      duplicates.add(key);
    }

    setError(null);

    const allergens = detectAllergens(
      clean.map((r) => r.name),
    );

    setAllergenText(allergens.join(", "));

    setDescription(
      buildDescription({
        name: name.trim(),
        category,
        ingredients: clean.map((r) => r.name.trim()),
        allergens,
        nutrition,
      }),
    );

    setStep(3);
  };

  const apply = () => {
    const allergens = allergenText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const patch = toFormPatch({
      description: description.trim(),
      ingredients: clean,
      allergens,
    });

    const {
      unknown: _unknown,
      skipped: _skipped,
      totalWeight: _totalWeight,
      ...facts
    } = nutrition;

    onApply({
      name: name.trim(),
      category,
      ...patch,
      nutrition: facts,
    });

    onClose();
  };

  const update = (
    id: number,
    patch: Partial<IngredientInput>,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Asisten Menu NNORTE"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-nnorte-surface p-5 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              Asisten Menu NNORTE
            </h2>
            <p className="text-xs text-nnorte-muted">
              Langkah {step} dari 3 · Bantu susun informasi menu
              dengan saran bahan dan estimasi gizi.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg px-2 py-1 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* LANGKAH 1: NAMA DAN FOTO */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold">
                Kenali menu yang ingin dibuat
              </h3>
              <p className="mt-1 text-sm text-nnorte-muted">
                Masukkan nama dan foto makanan atau minuman
                sebagai referensi.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Nama menu
              <input
                autoFocus
                className={`${field} mt-1`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Contoh: Ayam Rica-Rica"
                maxLength={120}
              />
            </label>

            <div>
              <label
                htmlFor="nnorte-menu-photo"
                className="mb-2 block text-sm font-medium"
              >
                Foto makanan atau minuman
              </label>

              <input
                id="nnorte-menu-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  selectPhoto(e.target.files?.[0]);
                  // Memungkinkan pengguna memilih file yang sama lagi.
                  e.currentTarget.value = "";
                }}
              />

              {photoPreview ? (
                <div className="overflow-hidden rounded-xl border border-current/15">
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt={`Pratinjau menu ${name || "baru"}`}
                      className="max-h-72 w-full bg-current/5 object-contain"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoError(null);
                      }}
                      className="absolute right-3 top-3 rounded-lg bg-black/75 px-3 py-2 text-sm font-medium text-white"
                    >
                      Hapus foto
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {photo?.name}
                      </p>
                      <p className="text-xs text-nnorte-muted">
                        {photo
                          ? `${(photo.size / 1024).toFixed(0)} KB`
                          : ""}
                      </p>
                    </div>

                    <label
                      htmlFor="nnorte-menu-photo"
                      className="cursor-pointer rounded-lg border border-current/20 px-3 py-2 text-sm font-medium"
                    >
                      Ganti
                    </label>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="nnorte-menu-photo"
                  className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-current/25 bg-current/[0.03] px-5 py-8 text-center transition hover:bg-current/[0.07]"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-current/5">
                    <svg
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                      />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>

                  <span className="text-sm font-semibold">
                    Pilih foto menu
                  </span>

                  <span className="mt-1 text-xs text-nnorte-muted">
                    Klik untuk memilih foto dari komputer
                  </span>

                  <span className="mt-3 text-xs text-nnorte-muted">
                    JPG, PNG, WEBP · Maksimal 5 MB
                  </span>
                </label>
              )}

              {photoError && (
                <p role="alert" className="mt-2 text-sm text-red-500">
                  {photoError}
                </p>
              )}
            </div>

            <label className="block text-sm font-medium">
              Kategori menu
              {categories.length > 0 ? (
                <select
                  className={`${field} mt-1 bg-nnorte-input text-nnorte-text`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((item) => (
                    <option key={item} value={item} className="bg-nnorte-surface text-nnorte-text">
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={`${field} mt-1`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Makanan Utama"
                />
              )}
            </label>

            <div className="rounded-lg border border-current/10 p-3 text-xs text-nnorte-muted">
              <strong className="text-current">
                Informasi:
              </strong>{" "}
              Foto akan menjadi referensi visual. Pada versi ini,
              saran bahan masih dihasilkan berdasarkan nama menu,
              bukan dari analisis AI terhadap gambar.
            </div>
          </div>
        )}

        {/* LANGKAH 2: BAHAN DAN GIZI */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Foto menu"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="text-xs text-nnorte-muted">
                  Menu yang sedang dibuat
                </p>
                <h3 className="font-semibold">{name}</h3>
                {category && (
                  <p className="text-xs text-nnorte-muted">
                    {category}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-nnorte-muted">
              Periksa bahan dan takaran untuk satu porsi.
              Gunakan satuan yang sama dengan satuan stok
              cabang, misalnya gram atau ml.
            </p>

            <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2rem] gap-2 text-xs text-nnorte-muted">
              <span>Nama bahan</span>
              <span>Jumlah</span>
              <span>Satuan</span>
              <span />
            </div>

            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2rem] gap-2"
              >
                <input
                  className={field}
                  aria-label="Nama bahan"
                  placeholder="Nama bahan"
                  value={row.name}
                  onChange={(e) =>
                    update(row.id, { name: e.target.value })
                  }
                />

                <input
                  className={field}
                  aria-label="Jumlah"
                  type="number"
                  min="0"
                  step="0.001"
                  value={row.quantity}
                  onChange={(e) =>
                    update(row.id, {
                      quantity:
                        e.target.value === ""
                          ? 0
                          : Number(e.target.value),
                    })
                  }
                />

                <input
                  className={field}
                  aria-label="Satuan"
                  value={row.unit}
                  onChange={(e) =>
                    update(row.id, { unit: e.target.value })
                  }
                  placeholder="gram"
                />

                <button
                  type="button"
                  aria-label={`Hapus bahan ${row.name || "kosong"}`}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.id !== row.id),
                    )
                  }
                  className="rounded-lg text-lg"
                >
                  ×
                </button>
              </div>
            ))}

            <Ghost
              onClick={() => setRows((current) => [...current, newRow()])}
            >
              + Tambah bahan
            </Ghost>

            <div className="rounded-xl border border-current/15 p-3">
              <div className="mb-3 font-semibold">
                Estimasi gizi per porsi ({nutrition.totalWeight} g)
              </div>

              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                {(
                  [
                    ["Kalori", nutrition.calories, "kkal"],
                    ["Protein", nutrition.protein, "g"],
                    ["Karbo", nutrition.carbs, "g"],
                    ["Lemak", nutrition.fat, "g"],
                    ["Gula", nutrition.sugar, "g"],
                    ["Natrium", nutrition.sodium, "mg"],
                  ] as const
                ).map(([label, value, unit]) => (
                  <div key={label}>
                    <div className="font-bold">{value}</div>
                    <div className="text-[11px] text-nnorte-muted">
                      {label} ({unit})
                    </div>
                  </div>
                ))}
              </div>

              {nutrition.unknown.length > 0 && (
                <p className="mt-3 text-xs text-nnorte-muted">
                  Bahan yang belum dikenali:{" "}
                  {nutrition.unknown.join(", ")}. Nilai gizi mungkin
                  belum akurat.
                </p>
              )}

              {nutrition.skipped.length > 0 && (
                <p className="mt-1 text-xs text-nnorte-muted">
                  Tidak dihitung karena satuan bukan gram/ml:{" "}
                  {nutrition.skipped.join(", ")}.
                </p>
              )}
            </div>

            <p className="text-xs text-nnorte-muted">
              Pastikan jumlah bahan sesuai resep sebenarnya.
              Estimasi gizi bukan hasil pengujian laboratorium.
            </p>
          </div>
        )}

        {/* LANGKAH 3: DESKRIPSI DAN ALERGEN */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Foto menu"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold">{name}</h3>
                <p className="text-xs text-nnorte-muted">
                  Periksa hasil sebelum menerapkannya.
                </p>
              </div>
            </div>

            <label className="block text-sm font-medium">
              Deskripsi menu
              <textarea
                className={`${field} mt-1 min-h-24`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi makanan atau minuman..."
              />
            </label>

            <label className="block text-sm font-medium">
              Alergen (pisahkan dengan koma)
              <input
                className={`${field} mt-1`}
                value={allergenText}
                onChange={(e) => setAllergenText(e.target.value)}
                placeholder="Contoh: susu, telur, kedelai"
              />
            </label>

            <div className="rounded-lg border border-current/10 p-3 text-xs text-nnorte-muted">
              Alergen yang disarankan hanya berdasarkan bahan
              yang dikenali sistem. Periksa resep dan risiko
              kontaminasi silang sebelum menampilkan informasi
              kepada pelanggan.
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-500">
            ⚠ {error}
          </p>
        )}

        {/* Tombol navigasi */}
        <div className="mt-6 flex justify-between gap-2">
          <Ghost
            onClick={() => {
              setError(null);

              if (step === 1) {
                onClose();
              } else {
                setStep((current) =>
                  (current - 1) as 1 | 2 | 3,
                );
              }
            }}
          >
            {step === 1 ? "Batal" : "Kembali"}
          </Ghost>

          {step === 1 && (
            <Primary onClick={start}>
              Buat saran bahan →
            </Primary>
          )}

          {step === 2 && (
            <Primary onClick={toResult}>
              Lanjut →
            </Primary>
          )}

          {step === 3 && (
            <Primary onClick={apply}>
              Terapkan ke Form
            </Primary>
          )}
        </div>
      </div>
    </div>
  );
}
