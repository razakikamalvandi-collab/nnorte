/**
 * Pencarian & reverse geocoding alamat memakai Nominatim (OpenStreetMap).
 *
 * Kepatuhan kebijakan Nominatim:
 *  - Tidak ada autocomplete. Permintaan hanya dikirim saat pengguna menekan
 *    tombol "Cari" atau memilih titik pada peta.
 *  - Maksimal 1 permintaan per detik (antrean serial + jeda 1,1 detik).
 *  - Hasil di-cache 15 menit agar permintaan yang sama tidak diulang.
 *  - Atribusi OpenStreetMap ditampilkan pada peta dan di bawah pemilih lokasi.
 *
 * Tile peta memakai tile.openstreetmap.org standar: hanya tile yang terlihat
 * yang dimuat, tanpa pengunduhan massal.
 */

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 160;
const MAX_CACHE_ENTRIES = 100;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedPlace extends Coordinates {
  /** Nama tampilan untuk daftar hasil pencarian. */
  label: string;
  /** Alamat lengkap yang bisa diedit pengguna. */
  address: string;
  city: string;
  province: string;
  postalCode: string;
  placeId?: string;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Validasi latitude/longitude; menerima angka maupun string numerik. */
export function parseCoordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Bulatkan ke 6 desimal agar cocok dengan kolom numeric(9,6) di Supabase. */
export const roundCoordinates = ({ latitude, longitude }: Coordinates): Coordinates => ({
  latitude: Math.round(latitude * 1e6) / 1e6,
  longitude: Math.round(longitude * 1e6) / 1e6,
});

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

const abortError = (): DOMException => new DOMException('Permintaan dibatalkan.', 'AbortError');

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

interface NominatimPlace {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

interface NominatimError {
  error: string;
}

const firstNonEmpty = (...values: Array<string | undefined | null>): string =>
  values.find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim() ?? '';

const stripCityPrefix = (value: string): string => value.replace(/^(Kota|Kabupaten)\s+/i, '').trim();

function toPlace(raw: NominatimPlace): GeocodedPlace | null {
  const point = parseCoordinates(raw.lat, raw.lon);
  if (!point) return null;

  const address = raw.address ?? {};
  const city = stripCityPrefix(
    firstNonEmpty(address.city, address.town, address.village, address.municipality, address.county),
  );
  const province = firstNonEmpty(address.state);
  const postalCode = firstNonEmpty(address.postcode);
  const street = [address.road, address.house_number].filter(Boolean).join(' ');
  const locality = firstNonEmpty(address.neighbourhood, address.suburb);
  const fallbackAddress = [raw.name, street, locality, city, province, postalCode].filter(Boolean).join(', ');
  const displayName = firstNonEmpty(raw.display_name) || fallbackAddress;

  const placeId =
    raw.osm_type && raw.osm_id != null
      ? `osm:${raw.osm_type}/${raw.osm_id}`
      : raw.place_id != null
        ? `nominatim:${raw.place_id}`
        : undefined;

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    label: displayName,
    address: displayName,
    city,
    province,
    postalCode,
    placeId,
  };
}

// ---------------------------------------------------------------------------
// Antrean + cache agar tidak melampaui batas 1 permintaan/detik Nominatim.
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;
let requestQueue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readCache<T>(key: string): { hit: boolean; value?: T } {
  const entry = cache.get(key);
  if (!entry) return { hit: false };
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value as T };
}

function writeCache(key: string, value: unknown): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function enqueue<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = requestQueue.then(async () => {
    if (signal?.aborted) throw abortError();
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal?.aborted) throw abortError();
    lastRequestAt = Date.now();
    return task();
  });
  requestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; finish: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Waktu permintaan habis.', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    finish: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function fetchJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const timeout = withTimeout(signal);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
  } catch (error) {
    if (isTimeoutError(error)) throw new Error('Layanan alamat tidak merespons. Coba lagi.');
    if (isAbortError(error)) throw error;
    throw new Error('Tidak dapat menghubungi layanan alamat. Periksa koneksi internet Anda.');
  } finally {
    timeout.finish();
  }

  if (response.status === 429 || response.status === 403) {
    throw new Error('Layanan alamat sedang membatasi permintaan. Tunggu beberapa saat lalu coba lagi.');
  }
  if (!response.ok) {
    throw new Error(`Layanan alamat gagal (HTTP ${response.status}). Coba lagi.`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('Respons layanan alamat tidak valid.');
  }
}

// ---------------------------------------------------------------------------
// API publik
// ---------------------------------------------------------------------------

/**
 * Cari lokasi berdasarkan kata kunci. Dipanggil hanya dari tombol "Cari"
 * (bukan dari setiap ketikan) agar sesuai kebijakan Nominatim.
 */
export async function searchPlaces(
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<GeocodedPlace[]> {
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < 3) return [];
  if (q.length > MAX_QUERY_LENGTH) {
    throw new Error(`Pencarian maksimal ${MAX_QUERY_LENGTH} karakter.`);
  }

  const key = `search:${q.toLocaleLowerCase('id-ID')}`;
  const cached = readCache<GeocodedPlace[]>(key);
  if (cached.hit) return cached.value ?? [];

  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('countrycodes', 'id');
  url.searchParams.set('accept-language', 'id');

  const rows = await enqueue(() => fetchJson<NominatimPlace[]>(url, options.signal), options.signal);
  const places = (Array.isArray(rows) ? rows : [])
    .map(toPlace)
    .filter((place): place is GeocodedPlace => place !== null);

  writeCache(key, places);
  return places;
}

/**
 * Ambil alamat dari koordinat. Dipanggil setelah pengguna memilih titik
 * (klik/geser penanda/lokasi perangkat), bukan saat halaman dibuka.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { signal?: AbortSignal } = {},
): Promise<GeocodedPlace | null> {
  const point = parseCoordinates(latitude, longitude);
  if (!point) throw new Error('Koordinat titik tidak valid.');

  const key = `reverse:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
  const cached = readCache<GeocodedPlace | null>(key);
  if (cached.hit) return cached.value ?? null;

  const url = new URL(`${NOMINATIM_URL}/reverse`);
  url.searchParams.set('lat', String(point.latitude));
  url.searchParams.set('lon', String(point.longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', 'id');

  const raw = await enqueue(
    () => fetchJson<NominatimPlace | NominatimError>(url, options.signal),
    options.signal,
  );

  if (!raw || 'error' in raw) {
    writeCache(key, null);
    return null;
  }

  const place = toPlace(raw);
  writeCache(key, place);
  return place;
}

/** Hanya untuk pengujian: kosongkan cache dan antrean modul. */
export function resetGeocodingStateForTests(): void {
  cache.clear();
  lastRequestAt = 0;
  requestQueue = Promise.resolve();
}
