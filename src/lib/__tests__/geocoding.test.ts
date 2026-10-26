import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOMINATIM_URL,
  OSM_TILE_URL,
  parseCoordinates,
  resetGeocodingStateForTests,
  reverseGeocode,
  roundCoordinates,
  searchPlaces,
} from '../geocoding';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const monas = {
  place_id: 123,
  osm_type: 'node',
  osm_id: 456,
  lat: '-6.175392',
  lon: '106.827153',
  display_name: 'Monumen Nasional, Gambir, Jakarta Pusat, DKI Jakarta, 10110, Indonesia',
  address: {
    road: 'Jl. Medan Merdeka Barat',
    house_number: '1',
    suburb: 'Gambir',
    city: 'Kota Jakarta Pusat',
    state: 'DKI Jakarta',
    postcode: '10110',
  },
};

const padang = {
  place_id: 789,
  osm_type: 'way',
  osm_id: 1011,
  lat: '-0.947100',
  lon: '100.417200',
  display_name: 'Jl. Merdeka, Padang, Sumatera Barat, 25111, Indonesia',
  address: {
    road: 'Jl. Merdeka',
    house_number: '12',
    city: 'Kota Padang',
    state: 'Sumatera Barat',
    postcode: '25111',
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetGeocodingStateForTests();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validasi koordinat', () => {
  it('menerima angka dan string numerik dalam rentang', () => {
    expect(parseCoordinates(-0.9471, 100.4172)).toEqual({ latitude: -0.9471, longitude: 100.4172 });
    expect(parseCoordinates('-0.9', '100.4')).toEqual({ latitude: -0.9, longitude: 100.4 });
  });

  it('menolak koordinat kosong, bukan angka, dan di luar rentang', () => {
    expect(parseCoordinates(undefined, 100)).toBeNull();
    expect(parseCoordinates('', 100)).toBeNull();
    expect(parseCoordinates('abc', 100)).toBeNull();
    expect(parseCoordinates(91, 100)).toBeNull();
    expect(parseCoordinates(-91, 100)).toBeNull();
    expect(parseCoordinates(0, 181)).toBeNull();
    expect(parseCoordinates(0, -181)).toBeNull();
    expect(parseCoordinates(Number.NaN, 100)).toBeNull();
  });

  it('membulatkan ke 6 desimal seperti kolom numeric(9,6)', () => {
    expect(roundCoordinates({ latitude: -0.947123456, longitude: 100.417987654 })).toEqual({
      latitude: -0.947123,
      longitude: 100.417988,
    });
  });
});

describe('pencarian Nominatim', () => {
  it('memakai tombol eksplisit (bukan autocomplete) dan parameter yang benar', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([monas]));

    const places = await searchPlaces('  monas  ');

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      latitude: -6.175392,
      longitude: 106.827153,
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      postalCode: '10110',
      placeId: 'osm:node/456',
    });

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(`${url.origin}${url.pathname}`).toBe(`${NOMINATIM_URL}/search`);
    expect(url.searchParams.get('q')).toBe('monas');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('countrycodes')).toBe('id');
    expect(url.searchParams.get('accept-language')).toBe('id');
    expect(url.searchParams.has('autocomplete')).toBe(false);
  });

  it('tidak mengirim permintaan untuk kata kunci kurang dari 3 karakter', async () => {
    expect(await searchPlaces('ab')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('meng-cache hasil agar permintaan yang sama tidak diulang', async () => {
    fetchMock.mockResolvedValue(jsonResponse([monas]));

    await searchPlaces('monas');
    await searchPlaces('MONAS');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('menampilkan pesan ramah saat layanan membatasi permintaan', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
    await expect(searchPlaces('bandung')).rejects.toThrow(/membatasi permintaan/i);
  });

  it('menampilkan pesan saat jaringan gagal', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(searchPlaces('bandung')).rejects.toThrow(/koneksi internet/i);
  });

  it('membatalkan permintaan yang sudah dibatalkan pemanggil', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(searchPlaces('bandung', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('reverse geocoding', () => {
  it('mengisi alamat, kota, provinsi, kode pos, dan id OSM', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(padang));

    const place = await reverseGeocode(-0.9471, 100.4172);

    expect(place).toMatchObject({
      address: padang.display_name,
      city: 'Padang',
      province: 'Sumatera Barat',
      postalCode: '25111',
      placeId: 'osm:way/1011',
    });

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(`${url.origin}${url.pathname}`).toBe(`${NOMINATIM_URL}/reverse`);
    expect(url.searchParams.get('lat')).toBe('-0.9471');
    expect(url.searchParams.get('lon')).toBe('100.4172');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('zoom')).toBe('18');
    expect(url.searchParams.get('accept-language')).toBe('id');
  });

  it('meng-cache hasil reverse untuk titik yang sama', async () => {
    fetchMock.mockResolvedValue(jsonResponse(padang));

    await reverseGeocode(-0.9471, 100.4172);
    await reverseGeocode(-0.9471, 100.4172);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mengembalikan null bila titik tidak punya alamat', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unable to geocode' }));
    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('menolak koordinat tidak valid tanpa memanggil layanan', async () => {
    await expect(reverseGeocode(91, 0)).rejects.toThrow(/tidak valid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('konfigurasi peta', () => {
  it('memakai tile OpenStreetMap standar tanpa key API', () => {
    expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(OSM_TILE_URL).not.toMatch(/google|api[_-]?key/i);
  });
});
