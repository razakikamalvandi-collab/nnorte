import { FinancialSummary, PaymentMethodRow } from './finance';
import { formatDateId, formatRangeId, DateRange } from './dates';
import { formatRupiah } from '../utils/formatters';

/**
 * Ekspor laporan keuangan. Data berasal dari FinancialSummary yang sama dengan dashboard
 * (cabang, periode, dan aturan hitung identik). Library dimuat dinamis saat tombol ditekan
 * agar tidak membebani bundel awal.
 */
export interface ReportExportInput {
  summary: FinancialSummary;
  branchLabel: string;
  restaurantName: string;
  methods: PaymentMethodRow[];
  generatedBy: string;
  generatedAt?: Date;
}

const METHOD_LABEL: Record<string, string> = {
  qris: 'QRIS',
  cash: 'Tunai',
  credit_card: 'Kartu Kredit',
  debit_card: 'Kartu Debit',
  bank_transfer: 'Transfer Bank',
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cabang';

export function reportFileName(ext: 'pdf' | 'xlsx', branchLabel: string, range: DateRange): string {
  const period = range.from === range.to ? range.from : `${range.from}_sd_${range.to}`;
  return `NNORTE_Laporan-Keuangan_${slug(branchLabel)}_${period}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const wibStamp = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d) + ' WIB';

/** Intl memakai NBSP pada "Rp 1.000"; font PDF standar tidak memetakannya dengan baik. */
const pdfRp = (v: number) => formatRupiah(v).replace(/ /g, ' ');

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function exportReportPdf(input: ReportExportInput): Promise<string> {
  const { summary, branchLabel, restaurantName, methods, generatedBy } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const red: [number, number, number] = [200, 16, 46];
  let y = 46;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...red);
  doc.text(restaurantName.toUpperCase(), margin, y);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.setFont('helvetica', 'normal');
  doc.text('Coffee & Hangout - Restaurant Management System', margin, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text('Laporan Keuangan', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Cabang: ${branchLabel}`, pageW - margin, y + 13, { align: 'right' });
  y += 34;
  doc.setDrawColor(...red);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  doc.setTextColor(40);
  doc.setFontSize(9.5);
  doc.text(`Periode: ${formatRangeId(summary.range)} (zona waktu WIB)`, margin, y);
  doc.text(`Dibuat: ${wibStamp(generatedAt)} oleh ${generatedBy}`, margin, y + 13);
  y += 26;

  const t = summary.totals;

  if (!summary.hasSales && !summary.hasExpenses) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text('Tidak ada transaksi atau pengeluaran tercatat pada periode ini.', margin, y + 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Laporan ini valid namun kosong. Ubah cabang atau periode untuk melihat data lain.', margin, y + 40);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Ringkasan', 'Nilai']],
      body: [
        ['Total pendapatan (tanpa PB1)', pdfRp(t.revenue)],
        ['Total pengeluaran tercatat', summary.hasExpenses ? pdfRp(t.expenses) : 'Belum ada pengeluaran tercatat'],
        [t.net >= 0 ? 'Laba bersih operasional' : 'Rugi bersih operasional', pdfRp(t.net)],
        ['Jumlah transaksi', t.txCount.toLocaleString('id-ID')],
        ['Rata-rata nilai transaksi', t.avgTicket === null ? '-' : pdfRp(t.avgTicket)],
        ['Penjualan bruto (termasuk pajak)', pdfRp(t.gross)],
        ['PB1 (dititipkan, bukan pendapatan)', pdfRp(t.tax)],
        ['Service charge (termasuk pendapatan)', pdfRp(t.service)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: red },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });

    if (summary.byBranch.length > 1) {
      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
        head: [['Cabang', 'Transaksi', 'Pendapatan', 'Pengeluaran', 'Laba bersih']],
        body: summary.byBranch.map((b) => [b.name, b.totals.txCount.toLocaleString('id-ID'), pdfRp(b.totals.revenue), pdfRp(b.totals.expenses), pdfRp(b.totals.net)]),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: red },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: margin, right: margin },
      });
    }

    if (methods.length > 0) {
      const total = methods.reduce((s, m) => s + m.amount, 0);
      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
        head: [['Metode pembayaran', 'Transaksi', 'Nilai pembayaran', 'Porsi']],
        body: methods.map((m) => [METHOD_LABEL[m.method] || m.method, m.txCount.toLocaleString('id-ID'), pdfRp(m.amount), total > 0 ? `${((m.amount / total) * 100).toFixed(1).replace('.', ',')}%` : '-']),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: red },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: margin, right: margin },
      });
    }

    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16,
      head: [['Tanggal', 'Transaksi', 'Pendapatan', 'Pengeluaran', 'Laba / rugi']],
      body: [
        ...summary.daily.map((d) => [formatDateId(d.date), d.txCount.toLocaleString('id-ID'), pdfRp(d.revenue), pdfRp(d.expenses), pdfRp(d.net)]),
        ['TOTAL', t.txCount.toLocaleString('id-ID'), pdfRp(t.revenue), pdfRp(t.expenses), pdfRp(t.net)],
      ],
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: red },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === summary.daily.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [233, 236, 239];
        }
      },
      showHead: 'everyPage',
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    doc.setFontSize(8);
    doc.setTextColor(110);
    const note = doc.splitTextToSize(
      'Catatan: transaksi sah = pesanan lunas dan tidak dibatalkan (tanggal = waktu pembayaran, WIB). Pendapatan = total tagihan dikurangi PB1. Laba bersih hanya memperhitungkan pengeluaran yang tercatat di sistem.',
      pageW - margin * 2
    );
    doc.text(note, margin, Math.min(finalY, doc.internal.pageSize.getHeight() - 50));
  }

  // Footer + penomoran halaman
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${restaurantName} - Laporan Keuangan - ${branchLabel}`, margin, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Halaman ${i} dari ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  const filename = reportFileName('pdf', branchLabel, summary.range);
  downloadBlob(doc.output('blob'), filename);
  return filename;
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const toExcelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export async function exportReportXlsx(input: ReportExportInput): Promise<string> {
  const { summary, branchLabel, restaurantName, methods, generatedBy } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = restaurantName;
  wb.created = generatedAt;

  const RP = '"Rp" #,##0';
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } } as const;
  const styleHeader = (row: import('exceljs').Row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = headerFill;
    row.alignment = { vertical: 'middle' };
  };
  const t = summary.totals;

  // --- Ringkasan
  const s1 = wb.addWorksheet('Ringkasan');
  s1.columns = [{ width: 38 }, { width: 28 }];
  s1.addRow([`${restaurantName} - Laporan Keuangan`]).font = { bold: true, size: 14 };
  s1.addRow(['Cabang', branchLabel]);
  s1.addRow(['Periode', formatRangeId(summary.range)]);
  s1.addRow(['Zona waktu', 'Asia/Jakarta (WIB)']);
  s1.addRow(['Dibuat', wibStamp(generatedAt)]);
  s1.addRow(['Dibuat oleh', generatedBy]);
  s1.addRow([]);
  styleHeader(s1.addRow(['Indikator', 'Nilai']));
  const kpi: [string, number | string, string?][] = [
    ['Total pendapatan (tanpa PB1)', t.revenue, RP],
    ['Total pengeluaran tercatat', summary.hasExpenses ? t.expenses : 'Belum ada pengeluaran tercatat', RP],
    [t.net >= 0 ? 'Laba bersih operasional' : 'Rugi bersih operasional', t.net, RP],
    ['Jumlah transaksi', t.txCount, '#,##0'],
    ['Rata-rata nilai transaksi', t.avgTicket === null ? 'Belum ada transaksi' : t.avgTicket, RP],
    ['Penjualan bruto (termasuk pajak)', t.gross, RP],
    ['PB1 (dititipkan)', t.tax, RP],
    ['Service charge', t.service, RP],
  ];
  for (const [label, value, fmt] of kpi) {
    const r = s1.addRow([label, value]);
    if (typeof value === 'number' && fmt) r.getCell(2).numFmt = fmt;
    r.getCell(2).alignment = { horizontal: 'right' };
  }
  if (!summary.hasSales && !summary.hasExpenses) {
    s1.addRow([]);
    s1.addRow(['Tidak ada transaksi atau pengeluaran tercatat pada periode ini.']).font = { italic: true };
  }
  s1.addRow([]);
  const noteRow = s1.addRow([
    'Transaksi sah = pesanan lunas & tidak dibatalkan (tanggal = waktu pembayaran). Pendapatan = total tagihan - PB1. Laba hanya memperhitungkan pengeluaran tercatat.',
  ]);
  noteRow.font = { italic: true, color: { argb: 'FF666666' } };

  // --- Rincian harian (per tanggal per cabang)
  const s2 = wb.addWorksheet('Rincian Harian', { views: [{ state: 'frozen', ySplit: 1 }] });
  s2.columns = [
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Cabang', key: 'branch', width: 32 },
    { header: 'Transaksi', key: 'tx', width: 12 },
    { header: 'Pendapatan', key: 'rev', width: 18 },
    { header: 'Pengeluaran', key: 'exp', width: 18 },
    { header: 'Laba / Rugi', key: 'net', width: 18 },
  ];
  styleHeader(s2.getRow(1));
  let first = 2;
  for (const b of summary.byBranch) {
    for (const p of b.points) {
      const r = s2.addRow({ date: toExcelDate(p.date), branch: b.name, tx: p.txCount, rev: p.revenue, exp: p.expenses, net: p.net });
      r.getCell('date').numFmt = 'dd/mm/yyyy';
      for (const k of ['rev', 'exp', 'net']) r.getCell(k).numFmt = RP;
    }
  }
  const last = s2.rowCount;
  if (last >= first) {
    const total = s2.addRow({ date: 'TOTAL', tx: { formula: `SUM(C${first}:C${last})`, result: t.txCount }, rev: { formula: `SUM(D${first}:D${last})`, result: t.revenue }, exp: { formula: `SUM(E${first}:E${last})`, result: t.expenses }, net: { formula: `SUM(F${first}:F${last})`, result: t.net } });
    total.font = { bold: true };
    for (const k of ['rev', 'exp', 'net']) total.getCell(k).numFmt = RP;
  }
  s2.autoFilter = { from: 'A1', to: 'F1' };

  // --- Per cabang
  const s3 = wb.addWorksheet('Per Cabang');
  s3.columns = [
    { header: 'Cabang', key: 'name', width: 32 },
    { header: 'Transaksi', key: 'tx', width: 12 },
    { header: 'Pendapatan', key: 'rev', width: 18 },
    { header: 'Pengeluaran', key: 'exp', width: 18 },
    { header: 'Laba / Rugi', key: 'net', width: 18 },
  ];
  styleHeader(s3.getRow(1));
  for (const b of summary.byBranch) {
    const r = s3.addRow({ name: b.name, tx: b.totals.txCount, rev: b.totals.revenue, exp: b.totals.expenses, net: b.totals.net });
    for (const k of ['rev', 'exp', 'net']) r.getCell(k).numFmt = RP;
  }

  // --- Metode pembayaran
  const s4 = wb.addWorksheet('Metode Pembayaran');
  s4.columns = [
    { header: 'Metode', key: 'm', width: 22 },
    { header: 'Transaksi', key: 'tx', width: 12 },
    { header: 'Nilai pembayaran (termasuk pajak)', key: 'amt', width: 34 },
  ];
  styleHeader(s4.getRow(1));
  for (const m of methods) {
    const r = s4.addRow({ m: METHOD_LABEL[m.method] || m.method, tx: m.txCount, amt: m.amount });
    r.getCell('amt').numFmt = RP;
  }
  if (methods.length === 0) s4.addRow({ m: 'Tidak ada pembayaran pada periode ini' });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = reportFileName('xlsx', branchLabel, summary.range);
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  return filename;
}
