export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function getOrderStatusBadge(status: string): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'pending':
      return { label: 'Menunggu', bg: 'bg-nnorte-warning/10', text: 'text-nnorte-warning', border: 'border-nnorte-warning/30' };
    case 'kitchen_queue':
      return { label: 'Antrean Dapur', bg: 'bg-nnorte-blue/10', text: 'text-nnorte-blue-soft', border: 'border-nnorte-blue/30' };
    case 'cooking':
      return { label: 'Sedang Dimasak', bg: 'bg-nnorte-warning/10', text: 'text-nnorte-warning', border: 'border-nnorte-warning/30' };
    case 'ready_to_serve':
      return { label: 'Siap Disajikan', bg: 'bg-nnorte-success/10', text: 'text-nnorte-success', border: 'border-nnorte-success/30' };
    case 'completed':
      return { label: 'Selesai', bg: 'bg-nnorte-surface-2', text: 'text-nnorte-muted', border: 'border-nnorte-border' };
    case 'cancelled':
      return { label: 'Dibatalkan', bg: 'bg-nnorte-error/10', text: 'text-nnorte-error', border: 'border-nnorte-error/30' };
    default:
      return { label: status, bg: 'bg-nnorte-surface-2', text: 'text-nnorte-muted', border: 'border-nnorte-border' };
  }
}

export function getPaymentStatusBadge(status: string): { label: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'paid':
      return { label: 'Lunas', bg: 'bg-nnorte-success/10', text: 'text-nnorte-success', border: 'border-nnorte-success/30' };
    case 'unpaid':
      return { label: 'Belum Lunas', bg: 'bg-nnorte-error/10', text: 'text-nnorte-error', border: 'border-nnorte-error/30' };
    case 'refunded':
      return { label: 'Dikembalikan', bg: 'bg-nnorte-surface-2', text: 'text-nnorte-muted', border: 'border-nnorte-border' };
    default:
      return { label: status, bg: 'bg-nnorte-surface-2', text: 'text-nnorte-muted', border: 'border-nnorte-border' };
  }
}

/** Rupiah ringkas untuk sumbu grafik: Rp1,5 jt, Rp250 rb. */
export function formatRupiahCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const fmt = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sign}Rp${fmt(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp${fmt(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp${fmt(abs / 1_000)} rb`;
  return `${sign}Rp${Math.round(abs)}`;
}
