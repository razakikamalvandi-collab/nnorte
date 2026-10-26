import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Crosshair, Loader2, LocateFixed, MapPin, Search, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { inputClass } from '../ui/Field';
import {
  Coordinates,
  GeocodedPlace,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  isAbortError,
  parseCoordinates,
  reverseGeocode,
  roundCoordinates,
  searchPlaces,
} from '../../lib/geocoding';

interface Props {
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  onPick: (p: Partial<GeocodedPlace> & { latitude: number; longitude: number }) => void;
  /** Menghapus titik lokasi dari form (alamat manual tetap dipertahankan). */
  onClear?: () => void;
}

const DEFAULT_CENTER: L.LatLngTuple = [-2.5, 118]; // tengah Indonesia
const DEFAULT_ZOOM = 5;
const POINT_ZOOM = 16;

const markerIcon = L.divIcon({
  className: 'nnorte-map-pin',
  html:
    '<svg viewBox="0 0 32 44" width="32" height="44" aria-hidden="true" focusable="false">' +
    '<path d="M16 1C7.7 1 1 7.7 1 16c0 11.2 15 27 15 27s15-15.8 15-27C31 7.7 24.3 1 16 1z" ' +
    'fill="currentColor" stroke="#ffffff" stroke-width="2"/>' +
    '<circle cx="16" cy="16" r="5.5" fill="#ffffff"/></svg>',
  iconSize: [32, 44],
  iconAnchor: [16, 44],
});

const createBranchMarker = (
  map: L.Map,
  point: Coordinates,
  onDrag: (latitude: number, longitude: number) => void,
): L.Marker => {
  const marker = L.marker([point.latitude, point.longitude], {
    draggable: true,
    icon: markerIcon,
    title: 'Lokasi cabang',
    alt: 'Penanda lokasi cabang',
    autoPan: true,
    riseOnHover: true,
  });
  marker.on('dragend', () => {
    const position = marker.getLatLng();
    onDrag(position.lat, position.lng);
  });
  marker.addTo(map);
  return marker;
};

/**
 * Pemilih lokasi cabang: peta OpenStreetMap (Leaflet), pencarian alamat
 * eksplisit (tanpa autocomplete), klik/geser penanda, lokasi perangkat,
 * reverse geocoding, dan tampilan koordinat.
 */
export const PlacePicker: React.FC<Props> = ({
  latitude,
  longitude,
  address,
  city,
  province,
  postalCode,
  onPick,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const coords = useMemo(() => parseCoordinates(latitude, longitude), [latitude, longitude]);
  const coordsRef = useRef<Coordinates | null>(coords);

  // Nilai terbaru dari form, dipakai oleh callback async tanpa closure basi.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const addressRef = useRef(address ?? '');
  addressRef.current = address ?? '';
  const cityRef = useRef(city ?? '');
  cityRef.current = city ?? '';
  const provinceRef = useRef(province ?? '');
  provinceRef.current = province ?? '';
  const postalRef = useRef(postalCode ?? '');
  postalRef.current = postalCode ?? '';

  // Alamat yang terakhir diisi otomatis. Selama form masih sama dengan nilai
  // ini, reverse geocoding boleh menimpanya; jika pengguna sudah mengeditnya
  // secara manual, alamat tidak akan ditimpa.
  const autoFillRef = useRef({
    address: address ?? '',
    city: city ?? '',
    province: province ?? '',
    postalCode: postalCode ?? '',
  });

  const searchAbortRef = useRef<AbortController | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const reverseSeqRef = useRef(0);
  const applyPointRef = useRef<(latitude: number, longitude: number, options?: { fly?: boolean; reverse?: boolean }) => void>(
    () => undefined,
  );
  const reverseLookupRef = useRef<(point: Coordinates) => void>(() => undefined);
  const mountedRef = useRef(true);
  const geoSeqRef = useRef(0);

  const handleMarkerDrag = useCallback((lat: number, lng: number) => {
    applyPointRef.current(lat, lng, { reverse: true });
  }, []);

  const ensureMarker = useCallback((point: Coordinates) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([point.latitude, point.longitude]);
      return;
    }
    markerRef.current = createBranchMarker(map, point, handleMarkerDrag);
  }, [handleMarkerDrag]);

  // Inisialisasi peta sekali. Aman untuk React StrictMode: cleanup menghapus
  // peta dan ref, sehingga efek kedua membuat instance baru.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initial = coordsRef.current;
    const map = L.map(container, {
      center: initial ? [initial.latitude, initial.longitude] : DEFAULT_CENTER,
      zoom: initial ? POINT_ZOOM : DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    });

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      minZoom: 3,
      maxZoom: 19,
    }).addTo(map);

    if (initial) {
      markerRef.current = createBranchMarker(map, initial, (lat, lng) =>
        applyPointRef.current(lat, lng, { reverse: true }),
      );
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      applyPointRef.current(event.latlng.lat, event.latlng.lng, { reverse: true });
    };
    map.on('click', handleMapClick);

    let observer: ResizeObserver | null = null;
    let resizeFrame = 0;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const size = map.getSize();
        // Hindari loop: invalidateSize hanya jika ukuran container benar-benar
        // berbeda dari ukuran yang diketahui Leaflet.
        if (width === size.x && height === size.y) return;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
      });
      observer.observe(container);
    }
    // Modal baru selesai beranimasi; pastikan ukuran peta dihitung ulang.
    const resizeTimer = window.setTimeout(() => map.invalidateSize({ animate: false }), 280);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      window.clearTimeout(resizeTimer);
      cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sinkronkan penanda bila koordinat berubah dari luar (mis. form diedit).
  useEffect(() => {
    coordsRef.current = coords;
    const map = mapRef.current;
    if (!map) return;
    if (coords) {
      ensureMarker(coords);
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [coords, ensureMarker]);

  // Tandai komponen hidup/mati; batalkan permintaan yang masih berjalan.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      searchAbortRef.current?.abort();
      reverseAbortRef.current?.abort();
    };
  }, []);

  reverseLookupRef.current = (point) => {
    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    const seq = ++reverseSeqRef.current;

    setReverseLoading(true);
    setReverseError(null);

    void (async () => {
      try {
        const place = await reverseGeocode(point.latitude, point.longitude, { signal: controller.signal });
        if (!mountedRef.current || seq !== reverseSeqRef.current || controller.signal.aborted) return;

        if (!place) {
          setReverseError('Alamat untuk titik ini tidak ditemukan. Isi alamat secara manual.');
          return;
        }

        const patch: Partial<GeocodedPlace> & { latitude: number; longitude: number } = {
          latitude: point.latitude,
          longitude: point.longitude,
        };
        const auto = autoFillRef.current;

        if (!addressRef.current.trim() || addressRef.current.trim() === auto.address.trim()) {
          patch.address = place.address;
          auto.address = place.address;
        }
        if (place.city && (!cityRef.current.trim() || cityRef.current.trim() === auto.city.trim())) {
          patch.city = place.city;
          auto.city = place.city;
        }
        if (place.province && (!provinceRef.current.trim() || provinceRef.current.trim() === auto.province.trim())) {
          patch.province = place.province;
          auto.province = place.province;
        }
        if (place.postalCode && (!postalRef.current.trim() || postalRef.current.trim() === auto.postalCode.trim())) {
          patch.postalCode = place.postalCode;
          auto.postalCode = place.postalCode;
        }
        if (place.placeId) patch.placeId = place.placeId;

        onPickRef.current(patch);
      } catch (error) {
        if (!mountedRef.current || isAbortError(error) || seq !== reverseSeqRef.current) return;
        setReverseError(error instanceof Error ? error.message : 'Gagal mengisi alamat otomatis.');
      } finally {
        if (mountedRef.current && seq === reverseSeqRef.current && !controller.signal.aborted) {
          setReverseLoading(false);
        }
      }
    })();
  };

  applyPointRef.current = (lat, lng, options = {}) => {
    // Pilihan manual membatalkan permintaan lokasi perangkat yang masih tertunda.
    geoSeqRef.current += 1;
    setLocating(false);

    // Menandai titik secara langsung membatalkan pencarian yang masih berjalan.
    searchAbortRef.current?.abort();
    setSearching(false);
    setResults([]);
    setSearchError(null);

    const rawPoint = parseCoordinates(lat, lng);
    if (!rawPoint) {
      setReverseError('Koordinat tidak valid. Pilih titik pada peta.');
      return;
    }

    const point = roundCoordinates(rawPoint);
    coordsRef.current = point;
    ensureMarker(point);

    if (options.fly) {
      mapRef.current?.flyTo([point.latitude, point.longitude], POINT_ZOOM, { duration: 0.6 });
    }

    setReverseError(null);
    setGeoError(null);
    onPickRef.current({ latitude: point.latitude, longitude: point.longitude });

    if (options.reverse !== false) reverseLookupRef.current(point);
  };

  const commitPlace = (place: GeocodedPlace) => {
    // Pilihan eksplisit dari daftar hasil mengalahkan reverse geocoding dan
    // permintaan lokasi perangkat yang mungkin masih berjalan.
    geoSeqRef.current += 1;
    setLocating(false);
    reverseAbortRef.current?.abort();
    reverseSeqRef.current += 1;
    setReverseLoading(false);

    const point = roundCoordinates(place);
    coordsRef.current = point;
    ensureMarker(point);
    mapRef.current?.flyTo([point.latitude, point.longitude], 17, { duration: 0.6 });

    autoFillRef.current = {
      address: place.address,
      city: place.city || cityRef.current,
      province: place.province || provinceRef.current,
      postalCode: place.postalCode || postalRef.current,
    };

    setResults([]);
    setSearchError(null);
    setReverseError(null);
    setGeoError(null);
    setQuery(place.label);

    onPickRef.current({
      latitude: point.latitude,
      longitude: point.longitude,
      address: place.address,
      city: place.city,
      province: place.province,
      postalCode: place.postalCode,
      placeId: place.placeId,
    });
  };

  const runSearch = async () => {
    searchAbortRef.current?.abort();
    const q = query.trim();
    if (q.length < 3) {
      setSearching(false);
      setResults([]);
      setSearchError('Ketik minimal 3 karakter, lalu tekan Cari.');
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const places = await searchPlaces(q, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      setResults(places);
      if (places.length === 0) {
        setSearchError('Lokasi tidak ditemukan. Coba kata kunci lain atau klik langsung pada peta.');
      }
    } catch (error) {
      if (!mountedRef.current || isAbortError(error)) return;
      setSearchError(error instanceof Error ? error.message : 'Pencarian gagal. Coba lagi.');
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setSearching(false);
    }
  };

  const requestDeviceLocation = () => {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('Browser ini tidak mendukung lokasi perangkat. Pilih titik pada peta.');
      return;
    }
    if (!window.isSecureContext) {
      setGeoError('Lokasi perangkat memerlukan HTTPS (atau localhost). Pilih titik pada peta.');
      return;
    }

    const seq = ++geoSeqRef.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current || seq !== geoSeqRef.current) return;
        setLocating(false);
        applyPointRef.current(position.coords.latitude, position.coords.longitude, {
          fly: true,
          reverse: true,
        });
      },
      (error) => {
        if (!mountedRef.current || seq !== geoSeqRef.current) return;
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError('Izin lokasi ditolak. Aktifkan izin lokasi atau pilih titik pada peta.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoError('Lokasi perangkat tidak tersedia. Pilih titik pada peta.');
        } else {
          setGeoError('Waktu permintaan lokasi habis. Coba lagi atau pilih titik pada peta.');
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  const recenter = () => {
    const point = coordsRef.current;
    if (!point) return;
    mapRef.current?.flyTo([point.latitude, point.longitude], POINT_ZOOM, { duration: 0.6 });
  };

  const clearPoint = () => {
    geoSeqRef.current += 1;
    setLocating(false);
    searchAbortRef.current?.abort();
    reverseAbortRef.current?.abort();
    reverseSeqRef.current += 1;
    setReverseLoading(false);
    setReverseError(null);
    setSearching(false);
    setSearchError(null);
    setGeoError(null);
    setResults([]);
    markerRef.current?.remove();
    markerRef.current = null;
    coordsRef.current = null;
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    onClear?.();
  };

  const retryReverse = () => {
    const point = coordsRef.current;
    if (point) reverseLookupRef.current(point);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Cari alamat atau nama tempat"
            autoComplete="off"
            className={`${inputClass()} pl-9`}
            placeholder="Cari alamat atau nama tempat…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Jangan biarkan Enter mengirim form cabang di luar komponen ini.
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
            maxLength={160}
          />
        </div>
        <Button
          type="button"
          size="sm"
          loading={searching}
          loadingText="Mencari…"
          icon={<Search size={14} />}
          onClick={() => void runSearch()}
        >
          Cari
        </Button>
      </div>

      {searchError && (
        <p
          role="alert"
          className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-[11px] text-nnorte-error"
        >
          {searchError}
        </p>
      )}

      {results.length > 0 && (
        <ul
          aria-label="Hasil pencarian lokasi"
          className="max-h-52 space-y-1 overflow-auto rounded-xl border border-nnorte-border bg-nnorte-surface p-1.5"
        >
          {results.map((place) => (
            <li key={place.placeId ?? `${place.latitude},${place.longitude}`}>
              <button
                type="button"
                onClick={() => commitPlace(place)}
                className="flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-nnorte-surface-2 focus-visible:bg-nnorte-surface-2"
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-nnorte-red" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-xs font-medium text-nnorte-text">{place.label}</span>
                  {(place.city || place.province) && (
                    <span className="mt-0.5 block text-[10px] text-nnorte-muted">
                      {[place.city, place.province, place.postalCode].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <div
          ref={containerRef}
          role="region"
          aria-label="Peta pemilihan lokasi cabang"
          className="nnorte-map h-56 w-full overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface-2 sm:h-64"
        />
        {!mapReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-nnorte-surface-2 text-xs text-nnorte-muted">
            <Loader2 size={14} className="nn-spin" aria-hidden="true" />
            Memuat peta…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<LocateFixed size={14} />}
          loading={locating}
          loadingText="Mencari lokasi…"
          onClick={requestDeviceLocation}
        >
          Lokasi saya
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Crosshair size={14} />}
          onClick={recenter}
          disabled={!coords}
        >
          Ke penanda
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={clearPoint}
          disabled={!coords && !reverseLoading}
        >
          Hapus titik
        </Button>
        {reverseLoading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-nnorte-muted" aria-live="polite">
            <Loader2 size={12} className="nn-spin" aria-hidden="true" />
            Mengisi alamat…
          </span>
        )}
      </div>

      {geoError && (
        <p
          role="alert"
          className="rounded-lg border border-nnorte-warning/40 bg-nnorte-warning/10 p-2.5 text-[11px] text-nnorte-warning"
        >
          {geoError}
        </p>
      )}

      {reverseError && (
        <p role="status" className="text-[11px] text-nnorte-warning">
          {reverseError}{' '}
          {coords && (
            <button
              type="button"
              onClick={retryReverse}
              className="cursor-pointer font-semibold underline decoration-dotted underline-offset-2 hover:text-nnorte-text"
            >
              Coba lagi
            </button>
          )}
        </p>
      )}

      <div
        aria-live="polite"
        className="grid grid-cols-2 gap-2 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-2.5"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-nnorte-muted">Latitude</p>
          <p className="mt-0.5 truncate font-mono text-xs text-nnorte-text">
            {coords ? coords.latitude.toFixed(6) : '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-nnorte-muted">Longitude</p>
          <p className="mt-0.5 truncate font-mono text-xs text-nnorte-text">
            {coords ? coords.longitude.toFixed(6) : '—'}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-nnorte-muted">
        {coords
          ? 'Klik peta atau geser penanda untuk menyesuaikan titik cabang.'
          : 'Klik peta, cari alamat, atau gunakan lokasi perangkat untuk menandai cabang.'}
      </p>
    </div>
  );
};
