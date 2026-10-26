import { Order } from '../types';

const STATUS: Record<string, string> = {
  pending: 'Menunggu', kitchen_queue: 'Antrean Dapur', cooking: 'Sedang Dimasak',
  ready_to_serve: 'Siap Disajikan', completed: 'Selesai', cancelled: 'Dibatalkan',
};
const PAY: Record<string, string> = { paid: 'Lunas', unpaid: 'Belum Lunas', refunded: 'Dikembalikan' };

/** Ekspor daftar pesanan yang sedang ditampilkan (filter yang sama dengan layar). */
export async function exportOrdersXlsx(orders: Order[], label: string): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NNORTE';
  const ws = wb.addWorksheet('Pesanan');
  ws.columns = [
    { header: 'No. Pesanan', key: 'no', width: 20 },
    { header: 'Cabang', key: 'branch', width: 24 },
    { header: 'Waktu', key: 'time', width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Pelanggan', key: 'cust', width: 22 },
    { header: 'Meja', key: 'table', width: 10 },
    { header: 'Item', key: 'items', width: 8 },
    { header: 'Subtotal', key: 'sub', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Pajak', key: 'tax', width: 12, style: { numFmt: '#,##0' } },
    { header: 'Service', key: 'svc', width: 12, style: { numFmt: '#,##0' } },
    { header: 'Total', key: 'total', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Pembayaran', key: 'pay', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const o of orders) {
    ws.addRow({
      no: o.orderNumber, branch: o.branchName, time: new Date(o.createdAt), cust: o.customerName,
      table: o.tableNumber || 'Takeaway', items: o.items.reduce((s, i) => s + i.quantity, 0),
      sub: o.subtotal, tax: o.tax, svc: o.serviceCharge, total: o.totalAmount,
      status: STATUS[o.status] ?? o.status, pay: PAY[o.paymentStatus] ?? o.paymentStatus,
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  const name = `NNORTE_Pesanan_${label.replace(/[^A-Za-z0-9]+/g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}
