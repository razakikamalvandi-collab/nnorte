import { describe, expect, it } from 'vitest';
import { Order, OrderStatus, PaymentStatus } from '../../types';
import { isSalesOrder, salesDate, sumSalesOnDate } from '../sales';

let seq = 0;

const order = (overrides: Partial<Order> = {}): Order => {
  seq += 1;
  return {
    id: `order-${seq}`,
    orderNumber: `NN-${String(seq).padStart(4, '0')}`,
    branchId: 'branch-a',
    branchName: 'Cabang A',
    customerName: 'Pelanggan',
    orderType: 'dine_in',
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    serviceCharge: 0,
    totalAmount: 0,
    status: 'completed' as OrderStatus,
    paymentStatus: 'paid' as PaymentStatus,
    createdAt: '2026-10-22T03:00:00.000Z',
    updatedAt: '2026-10-22T03:00:00.000Z',
    ...overrides,
  };
};

describe('penjualan sah', () => {
  it('hanya menghitung pesanan lunas, tidak dibatalkan, pada tanggal yang diminta', () => {
    const orders = [
      order({ totalAmount: 100_000, paidAt: '2026-10-22T03:00:00.000Z' }),
      order({ totalAmount: 50_000, paidAt: '2026-10-22T04:00:00.000Z' }),
      order({ totalAmount: 70_000, paidAt: '2026-10-21T03:00:00.000Z' }),
      order({ totalAmount: 30_000, paymentStatus: 'unpaid', paidAt: undefined }),
      order({ totalAmount: 25_000, paymentStatus: 'refunded', paidAt: '2026-10-22T05:00:00.000Z' }),
      order({ totalAmount: 40_000, status: 'cancelled', paidAt: '2026-10-22T06:00:00.000Z' }),
    ];

    expect(sumSalesOnDate(orders, '2026-10-22')).toBe(150_000);
  });

  it('mengelompokkan tanggal memakai zona Asia/Jakarta, bukan UTC', () => {
    const beforeMidnight = order({ paidAt: '2026-10-21T16:59:00.000Z' });
    const afterMidnight = order({ paidAt: '2026-10-21T17:00:00.000Z' });

    expect(salesDate(beforeMidnight)).toBe('2026-10-21');
    expect(salesDate(afterMidnight)).toBe('2026-10-22');
  });

  it('memakai waktu dibuat bila paidAt tidak tersedia', () => {
    const paidWithoutPaidAt = order({ paidAt: undefined, createdAt: '2026-10-22T03:00:00.000Z' });
    expect(salesDate(paidWithoutPaidAt)).toBe('2026-10-22');
  });

  it('membedakan pesanan sah dari pesanan yang tidak dihitung', () => {
    expect(isSalesOrder(order({ paymentStatus: 'paid' }))).toBe(true);
    expect(isSalesOrder(order({ paymentStatus: 'unpaid' }))).toBe(false);
    expect(isSalesOrder(order({ paymentStatus: 'refunded' }))).toBe(false);
    expect(isSalesOrder(order({ status: 'cancelled' }))).toBe(false);
  });

  it('tanpa pesanan menghasilkan nol, bukan angka demo', () => {
    expect(sumSalesOnDate([], '2026-10-22')).toBe(0);
  });
});
