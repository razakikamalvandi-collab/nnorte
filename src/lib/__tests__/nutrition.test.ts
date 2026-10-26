import { describe, expect, it } from "vitest";
import {
  buildDescription, calculateNutrition, detectAllergens, findIngredient,
  suggestIngredients, toFormPatch, toGrams,
} from "../nutrition";

describe("toGrams", () => {
  it("mengonversi satuan umum", () => {
    expect(toGrams(0.2, "kg")).toBe(200);
    expect(toGrams(150, "gram")).toBe(150);
    expect(toGrams(1, "L")).toBe(1000);
  });
  it("mengembalikan null untuk pcs / angka tidak valid", () => {
    expect(toGrams(1, "pcs")).toBeNull();
    expect(toGrams(0, "gram")).toBeNull();
    expect(toGrams(NaN, "gram")).toBeNull();
  });
});

describe("findIngredient", () => {
  it("memilih kata kunci terpanjang", () => {
    expect(findIngredient("Nasi Merah Organik")?.per100.calories).toBe(111);
    expect(findIngredient("Nasi putih")?.per100.calories).toBe(130);
  });
  it("tidak salah cocok 'es' di dalam kata lain", () => {
    expect(findIngredient("Kentang")?.per100.calories).toBe(77);
  });
  it("null bila tidak dikenal", () => {
    expect(findIngredient("Xyzzy")).toBeNull();
  });
});

describe("calculateNutrition", () => {
  it("menghitung 150 g ayam", () => {
    const r = calculateNutrition([{ name: "Ayam panggang", quantity: 150, unit: "gram" }]);
    expect(r.calories).toBe(248);
    expect(r.protein).toBe(46.5);
    expect(r.totalWeight).toBe(150);
  });
  it("mencatat bahan tak dikenal dan satuan pcs", () => {
    const r = calculateNutrition([
      { name: "Bahan aneh", quantity: 100, unit: "gram" },
      { name: "Telur", quantity: 2, unit: "pcs" },
    ]);
    expect(r.unknown).toEqual(["Bahan aneh"]);
    expect(r.skipped).toEqual(["Telur"]);
    expect(r.totalWeight).toBe(100);
  });
  it("daftar kosong menghasilkan nol", () => {
    expect(calculateNutrition([]).calories).toBe(0);
  });
});

describe("alergen & saran", () => {
  it("mendeteksi alergen unik", () => {
    expect(detectAllergens(["Keju parmesan", "Greek yogurt", "Crouton"])).toEqual(["Gandum", "Susu"]);
  });
  it("memberi saran bahan dari nama menu", () => {
    expect(suggestIngredients("Grilled Chicken Rice Bowl")).toHaveLength(4);
    expect(suggestIngredients("Menu Tak Dikenal")).toEqual([]);
  });
  it("membuat deskripsi dan patch form", () => {
    const d = buildDescription({
      name: "Caesar Salad", category: "Makanan Utama",
      ingredients: ["Selada", "Crouton"], allergens: ["Gandum"],
      nutrition: { calories: 1, protein: 5, carbs: 1, fat: 1, sugar: 1, fiber: 1, sodium: 1 },
    });
    expect(d).toContain("Caesar Salad");
    expect(d).toContain("gandum");
    const p = toFormPatch({ description: d, ingredients: [{ name: " Selada ", quantity: 180, unit: "gram" }], allergens: ["Gandum", "Susu"] });
    expect(p.ingredients).toEqual([{ name: "Selada", quantity: "180", unit: "gram" }]);
    expect(p.allergens).toBe("Gandum, Susu");
  });
});
