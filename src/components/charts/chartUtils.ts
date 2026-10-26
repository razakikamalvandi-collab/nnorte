import { useEffect, useRef, useState } from 'react';

/** Lebar elemen (px) yang diperbarui saat ukuran berubah, supaya grafik responsif tanpa teks mengecil. */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Angka "enak dibaca" untuk langkah sumbu. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const frac = rough / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

export interface Axis {
  min: number;
  max: number;
  ticks: number[];
}

/** Sumbu Y yang selalu memuat 0; mendukung nilai negatif (grafik laba/rugi). */
export function niceAxis(minValue: number, maxValue: number, target = 4): Axis {
  const lo = Math.min(0, minValue);
  const hi = Math.max(0, maxValue);
  if (lo === 0 && hi === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const step = niceStep((hi - lo) / target);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

/** Indeks label sumbu X yang ditampilkan (maks ~maxLabels, selalu menyertakan awal & akhir bila muat). */
export function labelIndexes(count: number, maxLabels: number): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  if (count <= maxLabels) {
    for (let i = 0; i < count; i++) out.add(i);
    return out;
  }
  const step = Math.ceil((count - 1) / (maxLabels - 1));
  for (let i = 0; i < count; i += step) out.add(i);
  out.add(count - 1);
  // hindari dua label bertumpuk di ujung
  const last = count - 1;
  const prev = [...out].filter((i) => i !== last).sort((a, b) => b - a)[0];
  if (prev !== undefined && last - prev < step / 2) out.delete(prev);
  return out;
}
