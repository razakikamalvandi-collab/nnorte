export interface OrderTimelinePhase {
  key: string;
  label: string;
  description: string;
}

export interface OrderTimelineState {
  phases: OrderTimelinePhase[];
  activeIndex: number;
  completed: boolean;
  cancelled: boolean;
}

const PHASES: OrderTimelinePhase[] = [
  {
    key: 'pending',
    label: 'Pesanan Diterima',
    description: 'Dapur menerima rincian pesanan Anda.',
  },
  {
    key: 'kitchen_queue',
    label: 'Antrean Dapur',
    description: 'Pesanan menunggu giliran dimasak.',
  },
  {
    key: 'cooking',
    label: 'Sedang Dimasak',
    description: 'Chef sedang menyiapkan pesanan Anda.',
  },
  {
    key: 'ready_to_serve',
    label: 'Siap Disajikan',
    description: 'Pesanan siap disajikan atau diambil di kasir.',
  },
  {
    key: 'completed',
    label: 'Selesai',
    description: 'Pesanan telah selesai. Terima kasih!',
  },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  kitchen_queue: 1,
  cooking: 2,
  ready_to_serve: 3,
  completed: 4,
};

/** Timeline pelanggan; status tak dikenal dianggap masih di tahap pertama. */
export function getOrderTimeline(status: string): OrderTimelineState {
  if (status === 'cancelled') {
    return { phases: PHASES, activeIndex: -1, completed: false, cancelled: true };
  }

  const activeIndex = STATUS_INDEX[status] ?? 0;
  return {
    phases: PHASES,
    activeIndex,
    completed: activeIndex === 4,
    cancelled: false,
  };
}
