import { describe, expect, it } from 'vitest';
import { getOrderTimeline } from '../orderTimeline';

describe('getOrderTimeline', () => {
  it('memetakan setiap status pesanan ke fase yang benar', () => {
    expect(getOrderTimeline('pending').activeIndex).toBe(0);
    expect(getOrderTimeline('kitchen_queue').activeIndex).toBe(1);
    expect(getOrderTimeline('cooking').activeIndex).toBe(2);
    expect(getOrderTimeline('ready_to_serve').activeIndex).toBe(3);
    expect(getOrderTimeline('completed').activeIndex).toBe(4);
  });

  it('menandai pesanan selesai dan dibatalkan', () => {
    expect(getOrderTimeline('completed').completed).toBe(true);
    expect(getOrderTimeline('cancelled').cancelled).toBe(true);
    expect(getOrderTimeline('cancelled').activeIndex).toBe(-1);
  });

  it('mengembalikan lima fase berurutan', () => {
    const { phases } = getOrderTimeline('pending');
    expect(phases.map((phase) => phase.label)).toEqual([
      'Pesanan Diterima',
      'Antrean Dapur',
      'Sedang Dimasak',
      'Siap Disajikan',
      'Selesai',
    ]);
  });

  it('memakai fase pertama untuk status yang tidak dikenal', () => {
    const state = getOrderTimeline('status-baru');
    expect(state.activeIndex).toBe(0);
    expect(state.cancelled).toBe(false);
    expect(state.completed).toBe(false);
  });
});
