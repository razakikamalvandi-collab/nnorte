import { customerSupabase } from './supabase';
import { buildRatingPayload, type RatingSubmission } from './ratings';
import type { MenuIngredient } from '../types';

/** API portal pelanggan: hanya RPC publik `portal_*` (harga & total dihitung server). */
export interface PortalBranch {
  id: string;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  operatingHours: string;
  is24Hours: boolean;
  latitude?: number;
  longitude?: number;
  taxPercentage: number;
  servicePercentage: number;
  allowTakeaway: boolean;
  restaurantName: string;
}

export interface PortalAddon { id: string; name: string; price: number }
export interface PortalVariant { name: string; options: string[] }
export interface PortalMenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image?: string;
  price: number;
  isPopular: boolean;
  isSpicy: boolean;
  prepMinutes: number;
  ingredients: MenuIngredient[];
  allergens: string[];
  variants: PortalVariant[];
  addons: PortalAddon[];
  soldOut: boolean;
}

export interface PortalTable { tableId: string; tableNumber: string; branchId: string }

export interface PortalOrderLine {
  menuId: string;
  quantity: number;
  variantChoice?: string;
  notes?: string;
  addonIds: string[];
}

export interface PortalCompensationVoucher {
  code: string;
  discountPercent: number;
  maxDiscount: number;
  expiresAt: string;
  redeemed?: boolean;
}
export interface PortalMenuReview {
  rating: number;
  review: string;
  createdAt: string;
}
export interface PortalMenuReviews {
  averageRating: number;
  count: number;
  reviews: PortalMenuReview[];
}
export interface PortalMenuMetrics {
  menuItemId: string;
  averageRating: number;
  reviewCount: number;
  orderCount: number;
  isFavorite: boolean;
}
export interface PortalOrderResult { orderId: string; orderNumber: string; trackingToken: string; total: number; discount: number }
export interface PortalOrderStatusItem {
  orderItemId?: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  variantChoice?: string;
  notes?: string;
}
export interface PortalOrderStatus {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  items: PortalOrderStatusItem[];
}
export interface PortalOrderRatingItem { orderItemId: string; rating: number }
export interface PortalOrderRatings {
  orderRating: number | null;
  orderReview: string | null;
  items: PortalOrderRatingItem[];
  compensation: PortalCompensationVoucher | null;
}

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const optionalNumber = (v: unknown) => {
  if (v === null || v === undefined || v === '') return undefined;
  const value = Number(v);
  return Number.isFinite(value) ? value : undefined;
};

const friendly = (msg: string) =>
  /Failed to fetch|NetworkError|network/i.test(msg) ? 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' : msg;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await customerSupabase.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export async function fetchBranches(): Promise<PortalBranch[]> {
  const rows = await rpc<Row[]>('portal_get_branches');
  return (rows ?? []).map((r) => ({
    id: s(r.id), name: s(r.name), tagline: s(r.tagline), address: s(r.address), city: s(r.city), phone: s(r.phone),
    operatingHours: s(r.operating_hours), is24Hours: r.is_24_hours === true,
    latitude: optionalNumber(r.latitude), longitude: optionalNumber(r.longitude),
    taxPercentage: n(r.tax_percentage), servicePercentage: n(r.service_charge_percentage),
    allowTakeaway: r.allow_online_takeaway === true, restaurantName: s(r.restaurant_name),
  }));
}

export async function fetchMenu(branchId: string): Promise<PortalMenuItem[]> {
  const rows = await rpc<Row[]>('portal_get_menu', { p_branch: branchId });
  return (rows ?? []).map((r) => ({
    id: s(r.menu_item_id), name: s(r.name), category: s(r.category), description: s(r.description),
    image: s(r.image_url) || undefined, price: n(r.price), isPopular: r.is_popular === true, isSpicy: r.is_spicy === true,
    prepMinutes: n(r.preparation_time_minutes),
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients.flatMap((ingredient): MenuIngredient[] => {
        if (typeof ingredient !== 'object' || ingredient === null) return [];
        const item = ingredient as Row;
        const quantity = Number(item.quantity);
        if (typeof item.name !== 'string' || typeof item.unit !== 'string' || !Number.isFinite(quantity)) return [];
        return [{ name: item.name, quantity, unit: item.unit }];
      })
      : [],
    allergens: Array.isArray(r.allergens) ? r.allergens.filter((allergen): allergen is string => typeof allergen === 'string') : [],
    variants: Array.isArray(r.variants) ? (r.variants as PortalVariant[]) : [],
    addons: Array.isArray(r.addons) ? (r.addons as Row[]).map((a) => ({ id: s(a.id), name: s(a.name), price: n(a.price) })) : [],
    soldOut: r.is_sold_out === true,
  }));
}

export async function fetchMenuReviews(branchId: string, menuItemId: string): Promise<PortalMenuReviews> {
  const rows = await rpc<Row[]>('portal_get_menu_reviews', { p_branch: branchId, p_menu_item: menuItemId });
  const row = rows?.[0];
  const reviews = Array.isArray(row?.reviews) ? (row.reviews as Row[]).flatMap((item): PortalMenuReview[] => {
    const rating = n(item.rating);
    const review = s(item.review).trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !review) return [];
    return [{ rating, review, createdAt: s(item.created_at) }];
  }) : [];
  return { averageRating: n(row?.average_rating), count: n(row?.review_count), reviews };
}

export async function fetchMenuMetrics(branchId: string): Promise<PortalMenuMetrics[]> {
  const rows = await rpc<Row[]>('portal_get_menu_metrics', { p_branch: branchId });
  return (rows ?? []).map((row) => ({
    menuItemId: s(row.menu_item_id),
    averageRating: n(row.average_rating),
    reviewCount: n(row.review_count),
    orderCount: n(row.order_count),
    isFavorite: row.is_favorite === true,
  }));
}

export async function setMenuFavorite(branchId: string, menuItemId: string, favorite: boolean): Promise<void> {
  await rpc<boolean>('portal_set_menu_favorite', {
    p_branch: branchId,
    p_menu_item: menuItemId,
    p_favorite: favorite,
  });
}

export async function resolveTable(token: string): Promise<PortalTable | null> {
  const rows = await rpc<Row[]>('portal_resolve_table', { p_token: token });
  const r = rows?.[0];
  return r ? { tableId: s(r.table_id), tableNumber: s(r.table_number), branchId: s(r.branch_id) } : null;
}

export async function createOrder(args: {
  branchId: string;
  qrToken: string | null;
  orderType: 'dine_in' | 'takeaway';
  customer: string;
  phone: string;
  lines: PortalOrderLine[];
  voucherCode?: string | null;
}): Promise<PortalOrderResult> {
  const rows = await rpc<Row[]>('portal_create_order_with_voucher', {
    p_branch: args.branchId,
    p_qr_token: args.qrToken,
    p_order_type: args.orderType,
    p_customer: args.customer,
    p_phone: args.phone || null,
    p_voucher: args.voucherCode?.trim() || null,
    p_items: args.lines.map((l) => ({
      menu_item_id: l.menuId,
      quantity: l.quantity,
      variant_choice: l.variantChoice || null,
      notes: l.notes || null,
      addons: l.addonIds.map((id) => ({ id })),
    })),
  });
  const r = rows?.[0];
  if (!r) throw new Error('Pesanan tidak dapat dibuat.');
  return { orderId: s(r.order_id), orderNumber: s(r.order_number), trackingToken: s(r.tracking_token), total: n(r.total_amount), discount: n(r.discount_amount) };
}

const mapVoucher = (row?: Row): PortalCompensationVoucher | null => row && s(row.code) ? ({
  code: s(row.code),
  discountPercent: n(row.discount_percent),
  maxDiscount: n(row.max_discount),
  expiresAt: s(row.expires_at),
  redeemed: row.redeemed === true,
}) : null;

export async function checkCompensationVoucher(branchId: string, code: string): Promise<PortalCompensationVoucher> {
  const rows = await rpc<Row[]>('portal_check_compensation_voucher', { p_branch: branchId, p_code: code });
  const voucher = mapVoucher(rows?.[0]);
  if (!voucher) throw new Error('Kode kompensasi tidak valid.');
  return voucher;
}

export async function fetchOrderStatus(orderId: string, token: string): Promise<PortalOrderStatus | null> {
  const rows = await rpc<Row[]>('portal_get_order_status', { p_order: orderId, p_token: token });
  const r = rows?.[0];
  if (!r) return null;
  return {
    orderNumber: s(r.order_number), status: s(r.status), paymentStatus: s(r.payment_status), total: n(r.total_amount), createdAt: s(r.created_at),
    items: Array.isArray(r.items) ? (r.items as Row[]).map((i) => ({
      orderItemId: s(i.order_item_id) || undefined,
      menuItemId: s(i.menu_item_id) || undefined,
      name: s(i.name),
      quantity: n(i.quantity),
      unitPrice: n(i.unit_price),
      variantChoice: s(i.variant_choice) || undefined,
      notes: s(i.notes) || undefined,
    })) : [],
  };
}

export async function fetchOrderRatings(orderId: string, token: string): Promise<PortalOrderRatings> {
  const data = await rpc<Row | null>('portal_get_order_ratings', { p_order: orderId, p_token: token });
  const orderRating =
    typeof data?.orderRating === 'number' &&
    Number.isInteger(data.orderRating) &&
    data.orderRating >= 1 &&
    data.orderRating <= 5
      ? data.orderRating
      : null;
  const items = Array.isArray(data?.items)
    ? (data.items as Row[])
        .map((item) => ({ orderItemId: s(item.orderItemId), rating: n(item.rating) }))
        .filter(
          (item) =>
            item.orderItemId &&
            Number.isInteger(item.rating) &&
            item.rating >= 1 &&
            item.rating <= 5,
        )
    : [];
  const compensationRows = orderRating !== null && orderRating <= 2
    ? await rpc<Row[]>('portal_get_rating_compensation', { p_order: orderId, p_token: token })
    : [];
  return {
    orderRating,
    orderReview: s(data?.orderReview) || null,
    items,
    compensation: mapVoucher(compensationRows?.[0]),
  };
}

export async function submitOrderRating(orderId: string, token: string, submissions: RatingSubmission[]): Promise<PortalCompensationVoucher | null> {
  const payload = buildRatingPayload(submissions);
  await rpc<Row>('portal_submit_order_rating', {
    p_order: orderId,
    p_token: token,
    p_order_rating: payload.orderRating,
    p_order_review: payload.orderReview,
    p_items: payload.items.map((item) => ({ orderItemId: item.orderItemId, rating: item.rating })),
  });
  const voucherRows = await rpc<Row[]>('portal_issue_rating_compensation', { p_order: orderId, p_token: token });
  return mapVoucher(voucherRows?.[0]);
}
