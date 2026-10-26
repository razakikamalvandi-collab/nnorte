import { supabase } from './supabase';

export const MENU_IMAGE_BUCKET = 'menu-images';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // sama dengan batas bucket
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Memeriksa tanda biner file (bukan sekadar ekstensi/MIME dari browser). */
async function sniffType(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = (i: number) => buf[i];
  if (hex(0) === 0xff && hex(1) === 0xd8 && hex(2) === 0xff) return 'image/jpeg';
  if (hex(0) === 0x89 && hex(1) === 0x50 && hex(2) === 0x4e && hex(3) === 0x47) return 'image/png';
  const riff = String.fromCharCode(...buf.slice(0, 4));
  const webp = String.fromCharCode(...buf.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

/** Pesan error (Indonesia) atau null bila file layak diunggah. */
export async function validateImageFile(file: File): Promise<string | null> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Format gambar harus JPEG, PNG, atau WebP.';
  }
  if (file.size === 0) return 'File gambar kosong.';
  if (file.size > MAX_IMAGE_BYTES) {
    return `Ukuran gambar ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
  }
  const sniffed = await sniffType(file);
  if (!sniffed || sniffed !== file.type) return 'Isi file bukan gambar JPEG, PNG, atau WebP yang valid.';
  return null;
}

/** Mengunggah ke `<restaurantId>/<uuid>.<ext>` dan mengembalikan URL publik + path. */
export async function uploadMenuImage(restaurantId: string, file: File): Promise<{ url: string; path: string }> {
  const problem = await validateImageFile(file);
  if (problem) throw new Error(problem);
  const path = `${restaurantId}/${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
  const { error } = await supabase.storage.from(MENU_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  const { data } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Path objek dari URL publik bucket kita; null untuk URL lain (mis. gambar lama dari luar). */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${MENU_IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

/** Menghapus objek lama; kegagalan hanya dicatat (tidak menggagalkan penyimpanan menu). */
export async function removeMenuImageByPath(path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(MENU_IMAGE_BUCKET).remove([path]);
  if (error) console.warn('Gagal menghapus gambar lama:', error.message);
}
