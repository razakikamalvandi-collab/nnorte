import { describe, expect, it } from 'vitest';
import { normalizeAiMenuResult } from '../aiMenu';

const CATEGORIES = ['Makanan Utama', 'Minuman', 'Dessert'];

describe('normalizeAiMenuResult', () => {
  it('memetakan hasil AI valid dengan kategori yang cocok (huruf besar/kecil diabaikan)', () => {
    const r = normalizeAiMenuResult(
      {
        name: 'Nasi Ayam Bakar',
        category: 'MAKANAN UTAMA',
        description: 'Ayam bakar bumbu merah dengan nasi hangat.',
        ingredients: [{ name: 'Ayam', quantity: 0.2, unit: 'kg' }, { name: 'Beras', quantity: 150, unit: 'gram' }],
        allergens: ['Seafood', 'Telur'],
      },
      CATEGORIES,
    );
    expect(r.name).toBe('Nasi Ayam Bakar');
    expect(r.category).toBe('Makanan Utama');
    expect(r.ingredients).toEqual([
      { name: 'Ayam', quantity: '0.2', unit: 'kg' },
      { name: 'Beras', quantity: '150', unit: 'gram' },
    ]);
    expect(r.allergens).toBe('Seafood, Telur');
  });

  it('kategori yang tidak ada di daftar menjadi kosong', () => {
    const r = normalizeAiMenuResult({ name: 'Es Teh', category: 'Kopi', ingredients: [], allergens: [] }, CATEGORIES);
    expect(r.category).toBe('');
  });

  it('memotong field yang terlalu panjang dan membatasi jumlah bahan', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Bahan ${i}`, quantity: 1, unit: 'pcs' }));
    const r = normalizeAiMenuResult(
      { name: 'A'.repeat(150), category: 'Minuman', description: 'D'.repeat(900), ingredients: many, allergens: 'X' },
      CATEGORIES,
    );
    expect(r.name.length).toBe(100);
    expect(r.description.length).toBe(500);
    expect(r.ingredients.length).toBe(20);
    expect(r.allergens).toBe('X');
  });

  it('membuang bahan tanpa nama dan menjaga qty non-positif menjadi 1', () => {
    const r = normalizeAiMenuResult(
      {
        name: 'M',
        category: '',
        ingredients: [{ name: '', quantity: 5, unit: 'g' }, { name: 'Gula', quantity: 0, unit: 'gram' }, { name: 'Air', quantity: -2, unit: 'ml' }],
        allergens: [],
      },
      CATEGORIES,
    );
    expect(r.ingredients).toEqual([
      { name: 'Gula', quantity: '1', unit: 'gram' },
      { name: 'Air', quantity: '1', unit: 'ml' },
    ]);
    expect(r.allergens).toBe('');
  });

  it('allergens string dipakai langsung; input sampah menghasilkan draf kosong yang aman', () => {
    expect(normalizeAiMenuResult({ name: 'X', allergens: ' Telur , Kacang ' }, CATEGORIES).allergens).toBe('Telur, Kacang');
    const empty = normalizeAiMenuResult(null, CATEGORIES);
    expect(empty.name).toBe('');
    expect(empty.category).toBe('');
    expect(empty.description).toBe('');
    expect(empty.ingredients).toEqual([]);
    expect(empty.allergens).toBe('');
  });
});
