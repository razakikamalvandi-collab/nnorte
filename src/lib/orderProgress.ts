import type { SceneStatus } from './orderFactoryScene';

/**
 * Status database NNORTE (enum order_status + payment_status) -> tahap scene 3D.
 * Database tidak punya status "serving", jadi tahap "Diantar / diambil" dilewati.
 * Posisi kartu murni mengikuti status yang tersimpan di database (tanpa timer).
 */
export function toSceneStatus(status: string, paymentStatus: string): SceneStatus {
  switch (status) {
    case 'cancelled': return 'cancelled';
    case 'completed': return 'completed';
    case 'ready_to_serve': return 'ready';
    case 'cooking': return 'preparing';
    case 'kitchen_queue': return 'received';
    default: return paymentStatus === 'paid' ? 'received' : 'pending_payment';
  }
}

/** Kategori menu -> jenis item (untuk teks detail: "diracik barista" vs "dimasak dapur"). */
export function isDrinkCategory(category?: string | null): 'food' | 'drink' {
  return /minum|kopi|coffee|teh\b|tea\b|jus|juice|drink|beverage|susu|milk|smoothie|es\b|black/i.test(category ?? '') ? 'drink' : 'food';
}
