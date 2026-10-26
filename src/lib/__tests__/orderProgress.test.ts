import { describe, expect, it } from 'vitest';
import { isDrinkCategory, toSceneStatus } from '../orderProgress';

describe('toSceneStatus', () => {
  it('memetakan status pesanan yang sudah selesai atau dibatalkan', () => {
    expect(toSceneStatus('completed', 'paid')).toBe('completed');
    expect(toSceneStatus('cancelled', 'paid')).toBe('cancelled');
  });

  it('memetakan status dapur sesuai tahap scene', () => {
    expect(toSceneStatus('kitchen_queue', 'paid')).toBe('received');
    expect(toSceneStatus('cooking', 'paid')).toBe('preparing');
    expect(toSceneStatus('ready_to_serve', 'paid')).toBe('ready');
  });

  it('membedakan pesanan pending yang sudah dan belum dibayar', () => {
    expect(toSceneStatus('pending', 'unpaid')).toBe('pending_payment');
    expect(toSceneStatus('pending', 'paid')).toBe('received');
  });

  it('memakai status pembayaran untuk status yang tidak dikenal', () => {
    expect(toSceneStatus('status-baru', 'unpaid')).toBe('pending_payment');
    expect(toSceneStatus('status-baru', 'paid')).toBe('received');
  });
});

describe('isDrinkCategory', () => {
  it('mengenali kategori minuman', () => {
    expect(isDrinkCategory('Kopi')).toBe('drink');
    expect(isDrinkCategory('Minuman Dingin')).toBe('drink');
    expect(isDrinkCategory('Tea')).toBe('drink');
    expect(isDrinkCategory('Jus Buah')).toBe('drink');
  });

  it('menganggap kategori lain sebagai makanan', () => {
    expect(isDrinkCategory('Makanan Utama')).toBe('food');
    expect(isDrinkCategory('Dessert')).toBe('food');
    expect(isDrinkCategory(null)).toBe('food');
    expect(isDrinkCategory(undefined)).toBe('food');
  });
});
