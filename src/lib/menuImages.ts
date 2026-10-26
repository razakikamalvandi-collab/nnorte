
import { supabase } from './supabase';

export const MENU_IMAGE_BUCKET = 'menu-images';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Membuat UUID dengan Web Crypto API.
 * Mendukung randomUUID maupun getRandomValues.
 */
function generateUuid(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  throw new Error(
    'Browser tidak mendukung pembuatan ID acak yang aman. Buka NNORTE melalui HTTPS atau localhost.',
  );
}

/** Memeriksa tanda biner file gambar. */
async function sniffType(file: File): Promise<string | null> {
  const buf = new Uint8Array(
    await file.slice(0, 12).arrayBuffer(),
  );

  if (
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }

  const riff = String.fromCharCode(...buf.slice(0, 4));
  const webp = String.fromCharCode(...buf.slice(8, 12));

  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

/** Memvalidasi gambar sebelum diunggah. */
export async function validateImageFile(
  file: File,
): Promise<string | null> {
  if (
    !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  ) {
    return 'Format gambar harus JPEG, PNG, atau WebP.';
  }

  if (file.size === 0) {
    return 'File gambar kosong.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `Ukuran gambar ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas 2 MB.`;
  }

  const sniffed = await sniffType(file);

  if (!sniffed || sniffed !== file.type) {
    return 'Isi file bukan gambar JPEG, PNG, atau WebP yang valid.';
  }

  return null;
}

/** Mengunggah gambar menu dan mengembalikan URL publik serta path. */
export async function uploadMenuImage(
  restaurantId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const problem = await validateImageFile(file);

  if (problem) {
    throw new Error(problem);
  }

  const extension = EXT_BY_TYPE[file.type];

  if (!extension) {
    throw new Error('Format gambar tidak didukung.');
  }

  const path = `${restaurantId}/${generateUuid()}.${extension}`;

  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
  };
}

/** Mengambil path objek dari URL publik bucket NNORTE. */
export function storagePathFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const marker = `/storage/v1/object/public/${MENU_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);

  if (index < 0) {
    return null;
  }

  try {
    return decodeURIComponent(
      url.slice(index + marker.length).split('?')[0],
    );
  } catch {
    return null;
  }
}

/** Menghapus gambar lama tanpa menggagalkan penyimpanan menu. */
export async function removeMenuImageByPath(
  path: string | null,
): Promise<void> {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.warn('Gagal menghapus gambar lama:', error.message);
  }
}
