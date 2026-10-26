import { Order } from '../types';
import { todayInBusinessTz } from './dates';

type SalesOrderFields = Pick<Order, 'status' | 'paymentStatus' | 'paidAt' | 'createdAt' | 'totalAmount'>;

/**
 * Definisi penjualan operasional (selaras dengan laporan): pesanan lunas dan tidak
 * dibatalkan. Pesanan belum lunas, refund, atau batal tidak dihitung.
 */
export function isSalesOrder(order: Pick<Order, 'status' | 'paymentStatus'>): boolean {
  return order.paymentStatus === 'paid' && order.status !== 'cancelled';
}

/** Tanggal operasional (Asia/Jakarta) saat pesanan lunas; fallback ke waktu dibuat. */
export function salesDate(order: Pick<Order, 'paidAt' | 'createdAt'>): string {
  return todayInBusinessTz(new Date(order.paidAt || order.createdAt));
}

/** Total nilai penjualan sah pada satu tanggal operasional. */
export function sumSalesOnDate(orders: SalesOrderFields[], date: string): number {
  return orders
    .filter((order) => isSalesOrder(order) && salesDate(order) === date)
    .reduce((sum, order) => sum + order.totalAmount, 0);
}
