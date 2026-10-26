/**
 * Pemuat Google Maps JavaScript API (Places API New). Key dari env VITE_GOOGLE_MAPS_API_KEY.
 * Tanpa key / gagal memuat -> `loadGoogleMaps()` menolak, UI beralih ke input alamat manual.
 */
// Tipe minimal agar tidak butuh @types/google.maps.
export interface LatLng { lat: number; lng: number }
export interface MapsLib {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapInstance;
}
export interface MapInstance { setCenter(p: LatLng): void; setZoom(z: number): void; addListener(ev: string, cb: (e: { latLng?: { lat(): number; lng(): number } }) => void): void }
export interface MarkerInstance { position: LatLng | null; map: MapInstance | null; addListener(ev: string, cb: () => void): void }
export interface PlacesLib {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(req: Record<string, unknown>): Promise<{ suggestions: Array<{ placePrediction: PlacePrediction | null }> }>;
  };
  AutocompleteSessionToken: new () => unknown;
}
export interface PlacePrediction {
  text: { text: string };
  placeId: string;
  toPlace(): PlaceObj;
}
export interface AddressComponent { longText: string | null; shortText: string | null; types: string[] }
export interface PlaceObj {
  id: string;
  formattedAddress?: string | null;
  location?: { lat(): number; lng(): number } | null;
  addressComponents?: AddressComponent[] | null;
  fetchFields(req: { fields: string[] }): Promise<unknown>;
}
interface GoogleNs {
  maps: {
    importLibrary(name: string): Promise<unknown>;
    marker?: unknown;
  };
}

export const MAPS_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
export const mapsConfigured = MAPS_KEY.length > 0;

let loader: Promise<GoogleNs> | null = null;

export function loadGoogleMaps(): Promise<GoogleNs> {
  if (!mapsConfigured) return Promise.reject(new Error('Kunci Google Maps belum dikonfigurasi.'));
  if (loader) return loader;
  loader = new Promise<GoogleNs>((resolve, reject) => {
    const w = window as unknown as { google?: GoogleNs; __nnMapsReady?: () => void };
    if (w.google?.maps?.importLibrary) return resolve(w.google);
    const timer = window.setTimeout(() => {
      loader = null;
      reject(new Error('Google Maps tidak merespons.'));
    }, 15000);
    w.__nnMapsReady = () => {
      window.clearTimeout(timer);
      if (w.google) resolve(w.google);
      else {
        loader = null;
        reject(new Error('Google Maps gagal dimuat.'));
      }
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&language=id&region=ID&callback=__nnMapsReady`;
    s.async = true;
    s.onerror = () => {
      window.clearTimeout(timer);
      loader = null;
      reject(new Error('Skrip Google Maps gagal dimuat (periksa key, billing, dan pembatasan domain).'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export async function importMaps(): Promise<MapsLib> {
  const g = await loadGoogleMaps();
  return (await g.maps.importLibrary('maps')) as MapsLib;
}
export async function importPlaces(): Promise<PlacesLib> {
  const g = await loadGoogleMaps();
  return (await g.maps.importLibrary('places')) as PlacesLib;
}
export async function importMarker(): Promise<{ AdvancedMarkerElement: new (o: Record<string, unknown>) => MarkerInstance }> {
  const g = await loadGoogleMaps();
  return (await g.maps.importLibrary('marker')) as { AdvancedMarkerElement: new (o: Record<string, unknown>) => MarkerInstance };
}

export interface PickedPlace {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

const pick = (comps: AddressComponent[], ...types: string[]) =>
  comps.find((c) => types.some((t) => c.types.includes(t)))?.longText ?? '';

export function placeToPicked(p: PlaceObj): PickedPlace | null {
  if (!p.location) return null;
  const comps = p.addressComponents ?? [];
  return {
    address: p.formattedAddress ?? '',
    city: pick(comps, 'administrative_area_level_2', 'locality').replace(/^(Kota|Kabupaten)\s+/i, ''),
    province: pick(comps, 'administrative_area_level_1'),
    postalCode: pick(comps, 'postal_code'),
    latitude: p.location.lat(),
    longitude: p.location.lng(),
    placeId: p.id,
  };
}
