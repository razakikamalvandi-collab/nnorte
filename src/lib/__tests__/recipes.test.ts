import { describe, expect, it } from "vitest";
import { toRecipeIngredients, validateRecipeRows, type RecipeDraft } from "../recipes";

const row = (name: string, quantity: string, unit: string): RecipeDraft => ({ name, quantity, unit });

describe("validateRecipeRows", () => {
  it("menerima baris valid dan mengabaikan baris kosong", () => {
    expect(
      validateRecipeRows([
        row("", "", ""),
        row(" Kentang ", "0.2", " kg "),
        row("Ayam", "1", "pcs"),
      ]),
    ).toBeNull();
  });

  it("menerima daftar kosong", () => {
    expect(validateRecipeRows([])).toBeNull();
  });

  it("menolak nama bahan kosong", () => {
    expect(validateRecipeRows([row("  ", "1", "kg")])).toContain("Nama bahan");
  });

  it("menolak jumlah nol, negatif, atau bukan angka", () => {
    expect(validateRecipeRows([row("Kentang", "0", "kg")])).toContain("Jumlah bahan");
    expect(validateRecipeRows([row("Kentang", "-1", "kg")])).toContain("Jumlah bahan");
    expect(validateRecipeRows([row("Kentang", "abc", "kg")])).toContain("Jumlah bahan");
  });

  it("menolak satuan kosong", () => {
    expect(validateRecipeRows([row("Kentang", "0.2", "  ")])).toContain("Satuan bahan");
  });

  it("menolak bahan duplikat tanpa membedakan huruf besar/kecil", () => {
    expect(
      validateRecipeRows([row("Kentang", "0.2", "kg"), row(" kentang ", "0.1", "kg")]),
    ).toContain("Kentang");
  });
});

describe("toRecipeIngredients", () => {
  it("membersihkan nama/satuan, mengubah jumlah menjadi angka, dan membuang baris kosong", () => {
    expect(
      toRecipeIngredients([
        row("", "", ""),
        row(" Kentang ", "0.2", " kg "),
        row("Ayam", "2", "pcs"),
      ]),
    ).toEqual([
      { name: "Kentang", quantity: 0.2, unit: "kg" },
      { name: "Ayam", quantity: 2, unit: "pcs" },
    ]);
  });
});
