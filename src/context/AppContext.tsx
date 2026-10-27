import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  User,
  TeamMember,
  Branch,
  MasterMenuItem,
  BranchMenuPricing,
  TableInfo,
  Order,
  OrderStatus,
  PaymentMethod,
  InventoryItem,
  AuditLog,
  GlobalSettings,
  UserRole,
} from '../types';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Tipe respons database (snake_case)
// ---------------------------------------------------------------------------

type DbBranch = {
  id: string;
  restaurant_id: string;
  code: string;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url: string | null;
  operating_hours: string;
  status: string;
  total_tables: number;
  province: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  place_id: string | null;
  is_24_hours: boolean;
  opening_time: string | null;
  closing_time: string | null;
  chart_color: string | null;
  sort_order: number | null;
  archived_code: string | null;
  deleted_at: string | null;
};

type DbMenuIngredient = {
  name: string;
  quantity: number | string;
  unit: string;
};

type DbMenuItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  base_price: number | string;
  image_url: string | null;
  status: string;
  is_popular: boolean;
  is_spicy: boolean;
  preparation_time_minutes: number;
  variants: { name: string; options: string[] }[];
  allergens: string[] | null;
  menu_ingredients?: DbMenuIngredient[];
};

type DbMenuCategory = {
  name: string;
};

type DbBranchMenuItem = {
  branch_id: string;
  menu_item_id: string;
  price: number | string;
  is_available: boolean;
  is_sold_out_today: boolean;
  custom_note: string | null;
};

type DbTable = {
  id: string;
  branch_id: string;
  table_number: string;
  capacity: number;
  status: string;
  qr_code_token: string;
};

type DbInventoryItem = {
  id: string;
  branch_id: string;
  name: string;
  category: string;
  current_stock: number | string;
  unit: string;
  min_threshold: number | string;
  cost_per_unit: number | string;
  last_restocked_at: string | null;
};

type DbOrderItemAddon = { id: string; addon_name_snapshot: string; unit_price: number | string; quantity: number };
type DbOrderItem = {
  id: string;
  menu_item_id: string | null;
  menu_name_snapshot: string;
  unit_price: number | string;
  quantity: number;
  variant_choice: string | null;
  notes: string | null;
  order_item_addons?: DbOrderItemAddon[];
};
type DbOrder = {
  id: string;
  branch_id: string;
  table_id: string | null;
  order_number: string;
  order_type: string;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number | string;
  discount_amount?: number | string;
  tax_amount: number | string;
  service_charge_amount: number | string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  paid_at: string | null;
  kitchen_start_at: string | null;
  kitchen_finish_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: DbOrderItem[];
};
type DbPayment = {
  order_id: string;
  method: PaymentMethod;
  cash_tendered: number | string | null;
  change_due: number | string | null;
};

type DbRestaurant = {
  id: string;
  name: string;
  tagline: string;
  contact_email: string | null;
  contact_phone: string | null;
  currency: string;
  tax_percentage: number | string;
  service_charge_percentage: number | string;
  allow_online_takeaway: boolean;
  sound_alerts_enabled: boolean;
};

type DbAuditLog = {
  id: string;
  branch_id: string | null;
  actor_id: string | null;
  action: string;
  target: string;
  outcome: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  branches?: { name: string } | null;
};

type DbTeamMember = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  branch_id: string | null;
  branch_name: string | null;
  status: string;
  last_sign_in_at: string | null;
  created_at: string | null;
};

// ---------------------------------------------------------------------------
// Mapping DB -> tipe aplikasi
// ---------------------------------------------------------------------------

const n = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const hhmm = (t: string | null): string | undefined => (t ? t.slice(0, 5) : undefined);

const mapBranchFromDB = (b: DbBranch): Branch => ({
  id: b.id,
  // Cabang nonaktif/terhapus menyimpan kode terakhirnya di archived_code.
  code: b.archived_code || b.code,
  name: b.name,
  tagline: b.tagline,
  address: b.address,
  city: b.city,
  phone: b.phone,
  email: b.email,
  logo: b.logo_url || undefined,
  operatingHours: b.operating_hours,
  status: b.status as 'active' | 'inactive',
  totalTables: b.total_tables,
  province: b.province || undefined,
  postalCode: b.postal_code || undefined,
  latitude: b.latitude === null ? undefined : Number(b.latitude),
  longitude: b.longitude === null ? undefined : Number(b.longitude),
  placeId: b.place_id || undefined,
  is24Hours: b.is_24_hours,
  openingTime: hhmm(b.opening_time),
  closingTime: hhmm(b.closing_time),
  chartColor: b.chart_color || undefined,
});

const mapMenuFromDB = (m: DbMenuItem): MasterMenuItem => ({
  id: m.id,
  sku: m.sku,
  name: m.name,
  category: m.category,
  description: m.description,
  basePrice: n(m.base_price),
  image: m.image_url || '',
  status: m.status as 'active' | 'archived',
  isPopular: m.is_popular,
  isSpicy: m.is_spicy,
  preparationTimeMinutes: m.preparation_time_minutes,
  variants: m.variants,
  ingredients: (m.menu_ingredients || [])
    .map((ingredient) => ({
      name: ingredient.name,
      quantity: n(ingredient.quantity),
      unit: ingredient.unit,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id')),
  allergens: m.allergens || [],
});

const mapBranchMenuFromDB = (bmi: DbBranchMenuItem): BranchMenuPricing => ({
  branchId: bmi.branch_id,
  menuId: bmi.menu_item_id,
  price: n(bmi.price),
  isAvailable: bmi.is_available,
  isSoldOutToday: bmi.is_sold_out_today,
  customNote: bmi.custom_note || undefined,
});

const mapTableFromDB = (t: DbTable): TableInfo => ({
  id: t.id,
  branchId: t.branch_id,
  tableNumber: t.table_number,
  capacity: t.capacity,
  status: t.status as TableInfo['status'],
  qrCodeToken: t.qr_code_token,
});

const mapInventoryFromDB = (i: DbInventoryItem): InventoryItem => {
  const stock = n(i.current_stock);
  const min = n(i.min_threshold);
  return {
    id: i.id,
    branchId: i.branch_id,
    name: i.name,
    category: i.category,
    currentStock: stock,
    unit: i.unit,
    minThreshold: min,
    costPerUnit: n(i.cost_per_unit),
    lastRestocked: i.last_restocked_at || '',
    status: stock === 0 ? 'out_of_stock' : stock <= min ? 'low_stock' : 'in_stock',
  };
};

const mapOrderFromDB = (
  o: DbOrder,
  branchNames: Map<string, string>,
  tableNumbers: Map<string, string>,
  payments: Map<string, DbPayment>
): Order => {
  const pay = payments.get(o.id);
  return {
    id: o.id,
    orderNumber: o.order_number,
    branchId: o.branch_id,
    branchName: branchNames.get(o.branch_id) || '',
    tableNumber: o.table_id ? tableNumbers.get(o.table_id) : undefined,
    customerName: o.customer_name,
    customerPhone: o.customer_phone || undefined,
    orderType: o.order_type as 'dine_in' | 'takeaway',
    items: (o.order_items || []).map((oi) => ({
      id: oi.id,
      menuId: oi.menu_item_id || '',
      name: oi.menu_name_snapshot,
      price: n(oi.unit_price),
      quantity: oi.quantity,
      variantChoice: oi.variant_choice || undefined,
      selectedAddons: (oi.order_item_addons || []).map((a) => ({ name: a.addon_name_snapshot, price: n(a.unit_price) })),
      notes: oi.notes || undefined,
    })),
    subtotal: n(o.subtotal),
    discount: n(o.discount_amount),
    tax: n(o.tax_amount),
    serviceCharge: n(o.service_charge_amount),
    totalAmount: n(o.total_amount),
    status: o.status as OrderStatus,
    paymentStatus: o.payment_status as 'unpaid' | 'paid' | 'refunded',
    paymentMethod: pay?.method,
    paidAt: o.paid_at || undefined,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    cashTendered: pay?.cash_tendered != null ? n(pay.cash_tendered) : undefined,
    changeDue: pay?.change_due != null ? n(pay.change_due) : undefined,
    kitchenStartTime: o.kitchen_start_at || undefined,
    kitchenFinishTime: o.kitchen_finish_at || undefined,
  };
};

const mapSettingsFromDB = (r: DbRestaurant): GlobalSettings => ({
  restaurantName: r.name,
  brandTagline: r.tagline,
  currency: r.currency,
  taxPercentage: n(r.tax_percentage),
  serviceChargePercentage: n(r.service_charge_percentage),
  contactEmail: r.contact_email || '',
  contactPhone: r.contact_phone || '',
  allowOnlineTakeaway: r.allow_online_takeaway,
  soundAlertsEnabled: r.sound_alerts_enabled,
});

const mapAuditLogFromDB = (log: DbAuditLog, branchNames: Map<string, string>): AuditLog => ({
  id: log.id,
  timestamp: log.created_at,
  userId: log.actor_id || '',
  userName: log.profiles?.full_name || 'Sistem',
  role: log.profiles ? 'staf' : 'sistem',
  action: log.action,
  target: log.target,
  branchName: log.branches?.name || (log.branch_id ? branchNames.get(log.branch_id) || 'Cabang' : 'Semua Cabang'),
  ipAddress: '—',
  status: log.outcome as 'success' | 'warning' | 'error',
});

const mapMemberFromDB = (m: DbTeamMember): TeamMember => ({
  id: m.user_id,
  name: m.full_name || 'Pengguna',
  email: m.email || '',
  phone: m.phone || undefined,
  role: m.role,
  branchId: m.branch_id || undefined,
  branchName: m.branch_name || undefined,
  status: m.status === 'active' ? 'active' : 'inactive',
  lastSignInAt: m.last_sign_in_at || undefined,
  createdAt: m.created_at || undefined,
});

// ---------------------------------------------------------------------------
// Konteks
// ---------------------------------------------------------------------------

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

/** Hasil operasi tulis. Form memakai `error` untuk pesan inline; tidak ada keberhasilan palsu. */
export type OpResult = { ok: true } | { ok: false; error: string };
const OK: OpResult = { ok: true };
const fail = (error: string): OpResult => ({ ok: false, error });

export type BranchInput = Omit<Branch, 'id' | 'code'>;

export type MenuInput = Omit<MasterMenuItem, 'id'>;

export type InventoryInput = {
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
};

const ORDERS_PAGE = 300;

interface AppContextType {
  currentUser: User | null;
  currentBranchId: string;
  setCurrentBranchId: (id: string) => void;
  restaurantId: string | null;
  branches: Branch[];
  users: TeamMember[];
  masterMenus: MasterMenuItem[];
  branchMenus: BranchMenuPricing[];
  tables: TableInfo[];
  orders: Order[];
  hasMoreOrders: boolean;
  inventory: InventoryItem[];
  auditLogs: AuditLog[];
  settings: GlobalSettings;
  toasts: Toast[];
  /** true selama pemuatan data awal/ulang; dataError berisi pesan bila ada query gagal. */
  dataLoading: boolean;
  dataError: string | null;
  reloadData: () => Promise<void>;
  loadMoreOrders: () => Promise<void>;

  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchRole: (role: string, branchId?: string) => Promise<void>;

  // Branch
  addBranch: (branch: BranchInput) => Promise<OpResult & { code?: string }>;
  updateBranch: (id: string, updates: Partial<BranchInput>) => Promise<OpResult>;
  /** Soft delete + penomoran ulang global cabang aktif. */
  deleteBranch: (id: string) => Promise<OpResult>;

  // Master Menu
  menuCategories: string[];
  addMenuCategory: (name: string) => Promise<OpResult>;
  deleteMenuCategory: (name: string) => Promise<OpResult>;
  addMasterMenu: (item: MenuInput, branchIds: string[]) => Promise<OpResult>;
  updateMasterMenu: (id: string, updates: Partial<MenuInput>) => Promise<OpResult>;
  /** Arsipkan atau aktifkan kembali menu master tanpa menghapus datanya. */
  setMasterMenuStatus: (id: string, status: MasterMenuItem['status']) => Promise<OpResult>;
  /** Menu yang pernah dipakai transaksi diarsipkan (bukan dihapus). */
  deleteMasterMenu: (id: string) => Promise<OpResult & { archived?: boolean }>;
  /** Menambahkan menu ke cabang yang belum memilikinya; harga/ketersediaan cabang yang sudah ada TIDAK ditimpa. */
  distributeMenus: (menuIds: string[], branchIds: string[]) => Promise<OpResult & { added?: number }>;

  // Branch Menu Overrides
  updateBranchPrice: (branchId: string, menuId: string, price: number) => Promise<void>;
  toggleBranchAvailability: (branchId: string, menuId: string) => Promise<void>;
  toggleBranchSoldOut: (branchId: string, menuId: string) => Promise<void>;

  // Tables
  addTable: (table: Omit<TableInfo, 'id'>) => Promise<void>;
  updateTable: (id: string, updates: Partial<TableInfo>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  updateTableStatus: (id: string, status: TableInfo['status']) => Promise<void>;

  // Orders & Lifecycle
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  createTakeawayOrder: (input: { customerName: string; customerPhone: string; items: { menuId: string; quantity: number; variantChoice?: string; notes?: string; addonIds: string[] }[] }) => Promise<OpResult>;
  processPayment: (orderId: string, method: PaymentMethod, cashTendered?: number) => Promise<OpResult>;

  // Inventory
  adjustStock: (id: string, amount: number, note: string) => Promise<void>;
  addInventoryItem: (input: InventoryInput) => Promise<OpResult>;

  // Team
  setMemberStatus: (userId: string, status: 'active' | 'inactive') => Promise<OpResult>;
  updateMemberAccess: (
    userId: string,
    data: { fullName: string; phone: string; role: UserRole; branchId: string }
  ) => Promise<OpResult>;

  // Settings & System
  updateSettings: (newSettings: Partial<GlobalSettings>) => Promise<void>;
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
  addAuditLog: (action: string, target: string, status?: 'success' | 'warning' | 'error', branchId?: string | null) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const EMPTY_SETTINGS: GlobalSettings = {
  restaurantName: 'NNORTE',
  brandTagline: '',
  currency: 'IDR',
  taxPercentage: 0,
  serviceChargePercentage: 0,
  contactEmail: '',
  contactPhone: '',
  allowOnlineTakeaway: false,
  soundAlertsEnabled: true,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, signIn: supabaseSignIn, signOut: supabaseSignOut } = useAuth();

  const [currentBranchId, setCurrentBranchId] = useState<string>(authUser?.branchId || 'all');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [masterMenus, setMasterMenus] = useState<MasterMenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const [branchMenus, setBranchMenus] = useState<BranchMenuPricing[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLimit, setOrdersLimit] = useState(ORDERS_PAGE);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(EMPTY_SETTINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const currentUser = authUser;
  const loadId = useRef(0);
  const ordersLimitRef = useRef(ordersLimit);
  ordersLimitRef.current = ordersLimit;
  // Nama semua cabang (termasuk yang sudah dihapus) agar pesanan/audit historis
  // tetap menampilkan nama cabangnya.
  const branchNamesRef = useRef<Map<string, string>>(new Map());

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = 't-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // ---------------------------------------------------------------------------
  // Pemuatan data. Setiap query diperiksa; kegagalan ditampilkan (tidak ada fallback diam-diam).
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(
    async (limit: number, branchNames: Map<string, string>, tableNumbers: Map<string, string>) => {
      const [ordRes, payRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*, order_item_addons(*))')
          .order('created_at', { ascending: false })
          .limit(limit + 1),
        supabase
          .from('payments')
          .select('order_id, method, cash_tendered, change_due')
          .order('paid_at', { ascending: false })
          .limit(limit + 1),
      ]);
      if (ordRes.error) throw new Error(`Pesanan: ${ordRes.error.message}`);
      if (payRes.error) throw new Error(`Pembayaran: ${payRes.error.message}`);
      const rows = (ordRes.data || []) as DbOrder[];
      const payments = new Map<string, DbPayment>();
      for (const p of (payRes.data || []) as DbPayment[]) if (!payments.has(p.order_id)) payments.set(p.order_id, p);
      return {
        more: rows.length > limit,
        orders: rows.slice(0, limit).map((o) => mapOrderFromDB(o, branchNames, tableNumbers, payments)),
      };
    },
    []
  );

  const fetchAllData = useCallback(async () => {
    if (!authUser) return;
    const id = ++loadId.current;
    setDataLoading(true);
    setDataError(null);
    const errors: string[] = [];
    const collect = <T,>(label: string, res: { data: T | null; error: { message: string } | null }): T | null => {
      if (res.error) {
        errors.push(`${label}: ${res.error.message}`);
        return null;
      }
      return res.data;
    };

    try {
      const canSeeTeam = authUser.role === 'owner' || authUser.role === 'branch_admin';
      const [rest, br, menus, cats, bmi, tbl, inv, logs, team] = await Promise.all([
        supabase.from('restaurants').select('*').limit(1),
        supabase.from('branches').select('*').order('code'),
        supabase.from('menu_items').select('*, menu_ingredients(name, quantity, unit)').order('name'),
        currentUser?.role === 'branch_admin' && currentUser.branchId
          ? supabase.from('branch_menu_categories').select('name').eq('branch_id', currentUser.branchId).order('name')
          : supabase.from('menu_categories').select('name').order('name'),
        supabase.from('branch_menu_items').select('*'),
        supabase.from('dining_tables').select('*').order('table_number'),
        supabase.from('inventory_items').select('*').order('name'),
        supabase.from('audit_logs').select('*, profiles(full_name), branches(name)').order('created_at', { ascending: false }).limit(100),
        canSeeTeam ? supabase.rpc('list_team_members') : Promise.resolve({ data: [], error: null }),
      ]);
      if (id !== loadId.current) return;

      const restRows = collect('Restoran', rest) as DbRestaurant[] | null;
      if (restRows && restRows.length > 0) {
        setRestaurantId(restRows[0].id);
        setSettings(mapSettingsFromDB(restRows[0]));
      }

      const branchRows = (collect('Cabang', br) as DbBranch[] | null) || [];
      const allBranches = branchRows.map(mapBranchFromDB);
      // Soft-deleted branches tidak tampil di manajemen, tetapi namanya tetap
      // dipakai untuk pesanan/audit historis.
      const mappedBranches = allBranches.filter((_, i) => !branchRows[i].deleted_at);
      branchNamesRef.current = new Map(allBranches.map((b) => [b.id, b.name]));
      setBranches(mappedBranches);
      // Cabang yang dipilih bisa saja baru dihapus admin lain.
      setCurrentBranchId((prev) => (prev === 'all' || mappedBranches.some((b) => b.id === prev) ? prev : 'all'));
      setMasterMenus(((collect('Menu', menus) as DbMenuItem[] | null) || []).map(mapMenuFromDB));
      const categoryRows = cats.error && currentUser?.role === 'branch_admin' &&
        /branch_menu_categories|schema cache|could not find the table/i.test(cats.error.message)
        ? []
        : (collect('Kategori', cats) as DbMenuCategory[] | null) || [];
      setMenuCategories(categoryRows.map((c) => c.name));
      setBranchMenus(((collect('Harga cabang', bmi) as DbBranchMenuItem[] | null) || []).map(mapBranchMenuFromDB));
      const mappedTables = ((collect('Meja', tbl) as DbTable[] | null) || []).map(mapTableFromDB);
      setTables(mappedTables);
      setInventory(((collect('Stok', inv) as DbInventoryItem[] | null) || []).map(mapInventoryFromDB));

      const branchNames = branchNamesRef.current;
      setAuditLogs(((collect('Audit', logs) as DbAuditLog[] | null) || []).map((l) => mapAuditLogFromDB(l, branchNames)));
      setUsers(((collect('Anggota tim', team as never) as DbTeamMember[] | null) || []).map(mapMemberFromDB));

      try {
        const res = await fetchOrders(ordersLimitRef.current, branchNames, new Map(mappedTables.map((t) => [t.id, t.tableNumber])));
        if (id !== loadId.current) return;
        setOrders(res.orders);
        setHasMoreOrders(res.more);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Pesanan gagal dimuat');
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Koneksi ke server gagal');
    } finally {
      if (id === loadId.current) {
        setDataLoading(false);
        if (errors.length > 0) {
          console.error('Gagal memuat data:', errors);
          setDataError(errors.join(' • '));
        }
      }
    }
  }, [authUser, currentUser, fetchOrders]);

  // Muat saat login; kosongkan saat logout agar tidak ada sisa data pengguna sebelumnya.
  useEffect(() => {
    if (authUser) {
      setCurrentBranchId(authUser.branchId || 'all');
      void fetchAllData();
    } else {
      loadId.current++;
      branchNamesRef.current = new Map();
      setRestaurantId(null);
      setBranches([]);
      setUsers([]);
      setMasterMenus([]);
      setBranchMenus([]);
      setTables([]);
      setOrders([]);
      setInventory([]);
      setAuditLogs([]);
      setSettings(EMPTY_SETTINGS);
      setDataError(null);
      setDataLoading(false);
      setCurrentBranchId('all');
    }
  }, [authUser, fetchAllData]);

  // Pesanan dimuat ulang diam-diam tiap 20 detik (saat tab terlihat) untuk dapur/kasir.
  useEffect(() => {
    if (!authUser) return;
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetchOrders(
          ordersLimitRef.current,
          branchNamesRef.current,
          new Map(tables.map((tb) => [tb.id, tb.tableNumber]))
        );
        setOrders(res.orders);
        setHasMoreOrders(res.more);
      } catch (e) {
        console.warn('Penyegaran pesanan gagal:', e);
      }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [authUser, branches, tables, fetchOrders]);

  const loadMoreOrders = useCallback(async () => {
    const next = ordersLimitRef.current + ORDERS_PAGE;
    ordersLimitRef.current = next;
    setOrdersLimit(next);
    try {
      const res = await fetchOrders(next, branchNamesRef.current, new Map(tables.map((t) => [t.id, t.tableNumber])));
      setOrders(res.orders);
      setHasMoreOrders(res.more);
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Gagal memuat pesanan lama.');
    }
  }, [branches, tables, fetchOrders, addToast]);

  // ---------------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------------

  const addAuditLog = useCallback(
    async (action: string, target: string, status: 'success' | 'warning' | 'error' = 'success', branchId?: string | null) => {
      if (!authUser || !restaurantId) return;
      const { error } = await supabase.from('audit_logs').insert({
        restaurant_id: restaurantId,
        branch_id: branchId !== undefined ? branchId : currentBranchId === 'all' ? null : currentBranchId,
        actor_id: authUser.id,
        action,
        target,
        outcome: status,
        metadata: {},
      });
      if (error) console.error('Gagal menulis audit log:', error.message);
    },
    [authUser, restaurantId, currentBranchId]
  );

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const login = async (email: string, password: string) => {
    const result = await supabaseSignIn(email.trim(), password);
    if (!result.ok) {
      addToast('error', result.error || 'Kredensial tidak valid atau akun dinonaktifkan.');
      return false;
    }
    return true;
  };

  const logout = async () => {
    await supabaseSignOut();
    addToast('info', 'Anda telah keluar dari sistem internal.');
  };

  const switchRole = async (role: string) => {
    if (role === 'customer') {
      await supabaseSignOut();
      addToast('info', 'Beralih ke Portal Pelanggan.');
      return;
    }
    addToast('info', 'Untuk beralih peran staf, silakan keluar dan login ulang dengan akun yang sesuai.');
  };

  // ---------------------------------------------------------------------------
  // Cabang
  // ---------------------------------------------------------------------------

  const branchToDb = (b: Partial<BranchInput>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (b.name !== undefined) out.name = b.name.trim();
    if (b.tagline !== undefined) out.tagline = b.tagline.trim();
    if (b.address !== undefined) out.address = b.address.trim();
    if (b.city !== undefined) out.city = b.city.trim();
    if (b.phone !== undefined) out.phone = b.phone.trim();
    if (b.email !== undefined) out.email = b.email.trim();
    if (b.logo !== undefined) out.logo_url = b.logo || null;
    if (b.totalTables !== undefined) out.total_tables = b.totalTables;
    if (b.province !== undefined) out.province = b.province || null;
    if (b.postalCode !== undefined) out.postal_code = b.postalCode || null;
    if (b.latitude !== undefined) out.latitude = b.latitude ?? null;
    if (b.longitude !== undefined) out.longitude = b.longitude ?? null;
    if (b.placeId !== undefined) out.place_id = b.placeId || null;
    if (b.is24Hours !== undefined) out.is_24_hours = b.is24Hours;
    if (b.is24Hours === true) {
      out.opening_time = null;
      out.closing_time = null;
    } else {
      if (b.openingTime !== undefined) out.opening_time = b.openingTime || null;
      if (b.closingTime !== undefined) out.closing_time = b.closingTime || null;
    }
    if (b.chartColor !== undefined) out.chart_color = b.chartColor || null;
    return out;
  };

  const friendlyDbError = (message: string): string => {
    if (/branch_admin_delete_menu_category/i.test(message)) {
      return 'Fitur hapus kategori belum tersedia di database. Terapkan migrasi 202610270006_branch_category_delete_reassign.sql lalu muat ulang halaman.';
    }
    if (/branch_menu_categories|branch_admin_(add|delete)_menu_category|schema cache/i.test(message)) {
      return 'Fitur kategori cabang belum tersedia di database. Terapkan migrasi 202610270004_branch_menu_categories.sql lalu muat ulang halaman.';
    }
    if (message.includes('branches_restaurant_id_code_key')) return 'Kode cabang bentrok. Coba simpan ulang.';
    if (message.includes('menu_items_restaurant_id_sku_key')) return 'SKU sudah dipakai menu lain.';
    if (message.includes('row-level security')) return 'Anda tidak memiliki izin untuk tindakan ini.';
    return message;
  };

  const addBranch: AppContextType['addBranch'] = async (data) => {
    if (!authUser || !restaurantId) return fail('Sesi atau restoran tidak ditemukan.');
    // `code` sengaja tidak dikirim: trigger database yang membuatnya (unik, aman dari race).
    const { data: row, error } = await supabase
      .from('branches')
      .insert({ restaurant_id: restaurantId, ...branchToDb(data) })
      .select('code')
      .single();
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    await addAuditLog('TAMBAH_CABANG', `Cabang baru: ${data.name} (${row.code})`);
    addToast('success', `Cabang ${data.name} (${row.code}) berhasil ditambahkan.`);
    return { ok: true, code: row.code as string };
  };

  const updateBranch: AppContextType['updateBranch'] = async (id, updates) => {
    const current = branches.find((b) => b.id === id);
    const { status, ...fields } = updates;

    // Status/urutan bukan kolom yang boleh diubah langsung: RPC database yang
    // menonaktifkan/mengaktifkan cabang sekaligus menomori ulang cabang aktif.
    const dbFields = branchToDb(fields);
    if (Object.keys(dbFields).length > 0) {
      const { error } = await supabase.from('branches').update(dbFields).eq('id', id);
      if (error) return fail(friendlyDbError(error.message));
    }

    if (status !== undefined && current && status !== current.status) {
      const { error } = await supabase.rpc('set_branch_status', { p_branch: id, p_status: status });
      if (error) return fail(friendlyDbError(error.message));
    }

    await fetchAllData();
    await addAuditLog('UPDATE_CABANG', `Update cabang ${current?.code || id}`, 'success', id);
    addToast('success', 'Informasi cabang diperbarui.');
    return OK;
  };

  const deleteBranch: AppContextType['deleteBranch'] = async (id) => {
    const branch = branches.find((b) => b.id === id);
    if (!branch) return fail('Cabang tidak ditemukan.');
    const { error } = await supabase.rpc('delete_branch', { p_branch: id });
    if (error) return fail(friendlyDbError(error.message));

    if (currentBranchId === id) setCurrentBranchId('all');
    await fetchAllData();
    await addAuditLog('HAPUS_CABANG', `Hapus cabang ${branch.name} (${branch.code})`, 'warning', id);
    addToast('warning', `Cabang ${branch.name} dihapus. Daftar cabang aktif telah diperbarui.`);
    return OK;
  };

  // ---------------------------------------------------------------------------
  // Master menu
  // ---------------------------------------------------------------------------

  const menuToDb = (m: Partial<MenuInput>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (m.sku !== undefined) out.sku = m.sku.trim();
    if (m.name !== undefined) out.name = m.name.trim();
    if (m.category !== undefined) out.category = m.category.trim();
    if (m.description !== undefined) out.description = m.description.trim();
    if (m.basePrice !== undefined) out.base_price = m.basePrice;
    if (m.image !== undefined) out.image_url = m.image || null;
    if (m.status !== undefined) out.status = m.status;
    if (m.isPopular !== undefined) out.is_popular = m.isPopular;
    if (m.isSpicy !== undefined) out.is_spicy = m.isSpicy;
    if (m.preparationTimeMinutes !== undefined) out.preparation_time_minutes = m.preparationTimeMinutes;
    if (m.variants !== undefined) out.variants = m.variants;
    if (m.allergens !== undefined) out.allergens = m.allergens;
    return out;
  };

  const addMenuCategory: AppContextType['addMenuCategory'] = async (rawName) => {
    if (!authUser || !restaurantId) return fail('Sesi atau restoran tidak ditemukan.');
    const name = rawName.trim();
    if (!name) return fail('Nama kategori wajib diisi.');
    if (name.length > 60) return fail('Nama kategori maksimal 60 karakter.');
    const duplicate = masterMenus.some((m) =>
      (currentUser?.role !== 'branch_admin' || branchMenus.some((entry) => entry.branchId === currentUser.branchId && entry.menuId === m.id)) &&
      m.category.trim().toLowerCase() === name.toLowerCase()
    ) ||
      menuCategories.some((c) => c.toLowerCase() === name.toLowerCase());
    if (duplicate) return fail('Kategori sudah ada.');

    if (currentUser?.role === 'branch_admin' && currentUser.branchId) {
      const { error } = await supabase.rpc('branch_admin_add_menu_category', {
        p_branch: currentUser.branchId,
        p_name: name,
      });
      if (error) return fail(error.code === '23505' ? 'Kategori sudah ada.' : friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('TAMBAH_KATEGORI_CABANG', `Kategori menu: ${name}`, 'success', currentUser.branchId);
      addToast('success', `Kategori ${name} ditambahkan untuk cabang ini.`);
      return OK;
    }
    if (currentUser?.role !== 'owner') return fail('Role Anda tidak dapat menambah kategori.');

    const { error } = await supabase.from('menu_categories').insert({ restaurant_id: restaurantId, name });
    if (error) {
      return fail(error.code === '23505' ? 'Kategori sudah ada.' : friendlyDbError(error.message));
    }

    await fetchAllData();
    await addAuditLog('TAMBAH_KATEGORI', `Kategori menu: ${name}`, 'success', null);
    addToast('success', `Kategori ${name} ditambahkan.`);
    return OK;
  };

  const deleteMenuCategory: AppContextType['deleteMenuCategory'] = async (rawName) => {
    const name = rawName.trim();
    if (!name) return fail('Kategori tidak valid.');
    if (currentUser?.role === 'branch_admin' && currentUser.branchId) {
      const { error } = await supabase.rpc('branch_admin_delete_menu_category', {
        p_branch: currentUser.branchId,
        p_name: name,
      });
      if (error) return fail(friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('HAPUS_KATEGORI_CABANG', `Kategori menu: ${name}`, 'warning', currentUser.branchId);
      addToast('success', `Kategori ${name} dihapus dari daftar cabang.`);
      return OK;
    }
    if (currentUser?.role !== 'owner' || !restaurantId) return fail('Role Anda tidak dapat menghapus kategori.');
    if (masterMenus.some((menu) => menu.category.trim().toLowerCase() === name.toLowerCase())) {
      return fail('Kategori masih digunakan menu. Pindahkan menu ke kategori lain sebelum menghapusnya.');
    }
    const { error } = await supabase.from('menu_categories').delete().eq('restaurant_id', restaurantId).ilike('name', name);
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    await addAuditLog('HAPUS_KATEGORI', `Kategori menu: ${name}`, 'warning', null);
    addToast('success', `Kategori ${name} dihapus.`);
    return OK;
  };

  const addMasterMenu: AppContextType['addMasterMenu'] = async (item, branchIds) => {
    if (!authUser || !restaurantId) return fail('Sesi atau restoran tidak ditemukan.');
    if (currentUser?.role === 'branch_admin') {
      if (!currentUser.branchId) return fail('Cabang aktif tidak ditemukan.');
      const { data, error } = await supabase.rpc('branch_admin_create_menu', {
        p_restaurant: restaurantId,
        p_branch: currentUser.branchId,
        p_sku: item.sku,
        p_name: item.name,
        p_category: item.category,
        p_description: item.description,
        p_base_price: item.basePrice,
        p_preparation_minutes: item.preparationTimeMinutes,
        p_is_popular: item.isPopular ?? false,
        p_is_spicy: item.isSpicy ?? false,
        p_variants: item.variants ?? [],
        p_allergens: item.allergens ?? [],
        p_ingredients: item.ingredients ?? [],
      });
      if (error) return fail(friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('TAMBAH_MENU_CABANG', `Menu baru: ${item.name}`, 'success', currentUser.branchId);
      addToast('success', `Menu ${item.name} ditambahkan ke katalog cabang.`);
      return OK;
    }
    if (currentUser?.role !== 'owner') return fail('Role Anda tidak dapat menambah menu.');
    const effectiveBranchIds = currentUser?.role === 'branch_admin'
      ? (currentUser.branchId ? [currentUser.branchId] : [])
      : currentUser?.role === 'owner' ? branchIds : [];
    if (effectiveBranchIds.length === 0) return fail('Cabang aktif tidak ditemukan untuk menambahkan menu.');
    const { data: created, error } = await supabase
      .from('menu_items')
      .insert({ restaurant_id: restaurantId, ...menuToDb(item) })
      .select('id, name')
      .single();
    if (error) return fail(friendlyDbError(error.message));

    const recipeRows = (item.ingredients || []).map((ingredient) => ({
      restaurant_id: restaurantId,
      menu_item_id: created.id,
      name: ingredient.name.trim(),
      quantity: ingredient.quantity,
      unit: ingredient.unit.trim(),
    }));
    if (recipeRows.length > 0) {
      const { error: recipeErr } = await supabase.from('menu_ingredients').insert(recipeRows);
      if (recipeErr) {
        await supabase.from('menu_items').delete().eq('id', created.id); // batalkan agar tidak setengah tersimpan
        return fail(`Gagal menyimpan bahan menu: ${friendlyDbError(recipeErr.message)}`);
      }
    }

    // Harga awal tiap cabang = harga dasar; setelahnya harga cabang berdiri sendiri.
    if (effectiveBranchIds.length > 0) {
      const rows = effectiveBranchIds.map((branchId) => ({
        restaurant_id: restaurantId,
        branch_id: branchId,
        menu_item_id: created.id,
        price: item.basePrice,
        is_available: true,
        is_sold_out_today: false,
        addons: [],
      }));
      const { error: distErr } = await supabase.from('branch_menu_items').insert(rows);
      if (distErr) {
        await supabase.from('menu_items').delete().eq('id', created.id); // batalkan agar tidak setengah tersimpan
        return fail(`Gagal mendistribusikan menu ke cabang: ${friendlyDbError(distErr.message)}`);
      }
    }

    await fetchAllData();
    const isBranchCreate = currentUser?.role === 'branch_admin';
    await addAuditLog(isBranchCreate ? 'TAMBAH_MENU_CABANG' : 'TAMBAH_MENU_PUSAT', `Menu baru: ${created.name}`, 'success', isBranchCreate ? currentUser.branchId : null);
    addToast('success', isBranchCreate ? `Menu ${created.name} ditambahkan ke cabang.` : `Menu ${created.name} ditambahkan ke katalog master.`);
    return OK;
  };

  const updateMasterMenu: AppContextType['updateMasterMenu'] = async (id, updates) => {
    if (!restaurantId) return fail('Restoran tidak ditemukan.');
    if (currentUser?.role === 'branch_admin' && currentUser.branchId) {
      const menu = masterMenus.find((entry) => entry.id === id);
      if (!menu) return fail('Menu tidak ditemukan di cabang ini.');
      const payload = { ...menu, ...updates };
      const { error } = await supabase.rpc('branch_admin_update_menu', {
        p_restaurant: restaurantId,
        p_branch: currentUser.branchId,
        p_menu: id,
        p_sku: payload.sku,
        p_name: payload.name,
        p_category: payload.category,
        p_description: payload.description,
        p_base_price: payload.basePrice,
        p_preparation_minutes: payload.preparationTimeMinutes,
        p_is_popular: payload.isPopular ?? false,
        p_is_spicy: payload.isSpicy ?? false,
        p_variants: payload.variants ?? [],
        p_allergens: payload.allergens ?? [],
        p_ingredients: payload.ingredients ?? [],
      });
      if (error) return fail(friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('UBAH_MENU_CABANG', `Menu diubah: ${payload.name}`, 'success', currentUser.branchId);
      addToast('success', `Menu ${payload.name} diperbarui untuk cabang ini.`);
      return OK;
    }
    const { error } = await supabase.from('menu_items').update(menuToDb(updates)).eq('id', id);
    if (error) return fail(friendlyDbError(error.message));

    if (updates.ingredients !== undefined) {
      const { error: deleteErr } = await supabase.from('menu_ingredients').delete().eq('menu_item_id', id);
      if (deleteErr) return fail(friendlyDbError(deleteErr.message));

      const recipeRows = updates.ingredients.map((ingredient) => ({
        restaurant_id: restaurantId,
        menu_item_id: id,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity,
        unit: ingredient.unit.trim(),
      }));
      if (recipeRows.length > 0) {
        const { error: insertErr } = await supabase.from('menu_ingredients').insert(recipeRows);
        if (insertErr) return fail(`Gagal menyimpan bahan menu: ${friendlyDbError(insertErr.message)}`);
      }
    }

    await fetchAllData();
    await addAuditLog('UPDATE_MENU_PUSAT', `Update menu ${updates.name || id}`, 'success', null);
    addToast('success', 'Master menu berhasil diperbarui.');
    return OK;
  };

  const setMasterMenuStatus: AppContextType['setMasterMenuStatus'] = async (id, status) => {
    const menu = masterMenus.find((m) => m.id === id);
    const { error } = await supabase.from('menu_items').update({ status }).eq('id', id);
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    const label = menu?.name || id;
    if (status === 'active') {
      await addAuditLog('AKTIFKAN_MENU_PUSAT', `Aktifkan menu ${label}`, 'success', null);
      addToast('success', `${label} diaktifkan kembali.`);
    } else {
      await addAuditLog('ARSIP_MENU_PUSAT', `Arsipkan menu ${label}`, 'warning', null);
      addToast('warning', `${label} diarsipkan.`);
    }
    return OK;
  };

  const distributeMenus: AppContextType['distributeMenus'] = async (menuIds, branchIds) => {
    if (!restaurantId) return fail('Restoran tidak ditemukan.');
    const menus = masterMenus.filter((m) => menuIds.includes(m.id));
    if (menus.length === 0) return fail('Pilih setidaknya satu menu master.');

    const owned = new Set(branchMenus.map((bm) => `${bm.branchId}|${bm.menuId}`));
    const rows = menus.flatMap((menu) =>
      branchIds
        .filter((branchId) => !owned.has(`${branchId}|${menu.id}`))
        .map((branchId) => ({
          restaurant_id: restaurantId,
          branch_id: branchId,
          menu_item_id: menu.id,
          price: menu.basePrice,
          is_available: true,
          is_sold_out_today: false,
          addons: [],
        })),
    );
    if (rows.length === 0) return { ok: true, added: 0 };

    const { error } = await supabase.from('branch_menu_items').upsert(rows, { onConflict: 'branch_id,menu_item_id', ignoreDuplicates: true });
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    await addAuditLog('DISTRIBUSI_MENU', `${rows.length} entri menu-cabang (${menus.length} menu)`, 'success', null);
    return { ok: true, added: rows.length };
  };

  const deleteMasterMenu: AppContextType['deleteMasterMenu'] = async (id) => {
    const menu = masterMenus.find((m) => m.id === id);
    if (currentUser?.role === 'branch_admin' && currentUser.branchId) {
      const { error } = await supabase.rpc('branch_admin_remove_menu', {
        p_branch: currentUser.branchId,
        p_menu: id,
      });
      if (error) return fail(friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('HAPUS_MENU_CABANG', `Menu dilepas dari cabang: ${menu?.name || id}`, 'warning', currentUser.branchId);
      addToast('success', `${menu?.name || 'Menu'} dihapus dari katalog cabang ini.`);
      return OK;
    }
    const { count, error: countErr } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('menu_item_id', id);
    if (countErr) return fail(countErr.message);

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from('menu_items').update({ status: 'archived' }).eq('id', id);
      if (error) return fail(friendlyDbError(error.message));
      await fetchAllData();
      await addAuditLog('ARSIP_MENU_PUSAT', `Arsip menu ${menu?.name || id} (dipakai ${count} baris transaksi)`, 'warning', null);
      addToast('warning', 'Menu sudah dipakai dalam transaksi, sehingga diarsipkan (tidak dihapus).');
      return { ok: true, archived: true };
    }

    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    await addAuditLog('HAPUS_MENU_PUSAT', `Hapus menu ${menu?.name || id}`, 'warning', null);
    addToast('warning', 'Menu dihapus dari katalog master.');
    return OK;
  };

  // ---------------------------------------------------------------------------
  // Override menu per cabang
  // ---------------------------------------------------------------------------

  const runWrite = async (
    op: PromiseLike<{ error: { message: string } | null }>,
    success?: { type: Toast['type']; message: string }
  ): Promise<boolean> => {
    const { error } = await op;
    if (error) {
      addToast('error', friendlyDbError(error.message));
      return false;
    }
    await fetchAllData();
    if (success) addToast(success.type, success.message);
    return true;
  };

  const updateBranchPrice = async (branchId: string, menuId: string, price: number) => {
    const ok = await runWrite(
      supabase.from('branch_menu_items').update({ price }).eq('branch_id', branchId).eq('menu_item_id', menuId),
      { type: 'success', message: 'Harga cabang berhasil diperbarui.' }
    );
    if (ok) await addAuditLog('UPDATE_HARGA_LOKAL', `Harga menu ${menuId} diset Rp ${price}`, 'success', branchId);
  };

  const toggleBranchAvailability = async (branchId: string, menuId: string) => {
    const current = branchMenus.find((bm) => bm.branchId === branchId && bm.menuId === menuId);
    if (!current) return;
    await runWrite(
      supabase.from('branch_menu_items').update({ is_available: !current.isAvailable }).eq('branch_id', branchId).eq('menu_item_id', menuId),
      { type: 'info', message: 'Status ketersediaan menu cabang diubah.' }
    );
  };

  const toggleBranchSoldOut = async (branchId: string, menuId: string) => {
    const current = branchMenus.find((bm) => bm.branchId === branchId && bm.menuId === menuId);
    if (!current) return;
    await runWrite(
      supabase.from('branch_menu_items').update({ is_sold_out_today: !current.isSoldOutToday }).eq('branch_id', branchId).eq('menu_item_id', menuId),
      { type: 'info', message: 'Status habis hari ini diubah.' }
    );
  };

  // ---------------------------------------------------------------------------
  // Meja
  // ---------------------------------------------------------------------------

  const addTable = async (t: Omit<TableInfo, 'id'>) => {
    if (!restaurantId) return;
    await runWrite(
      supabase.from('dining_tables').insert({
        restaurant_id: restaurantId,
        branch_id: t.branchId,
        table_number: t.tableNumber,
        capacity: t.capacity,
        status: t.status,
        ...(t.qrCodeToken ? { qr_code_token: t.qrCodeToken } : {}),
      }),
      { type: 'success', message: `Meja ${t.tableNumber} ditambahkan.` }
    );
  };

  const updateTable = async (id: string, u: Partial<TableInfo>) => {
    const db: Record<string, unknown> = {};
    if (u.tableNumber !== undefined) db.table_number = u.tableNumber;
    if (u.capacity !== undefined) db.capacity = u.capacity;
    if (u.status !== undefined) db.status = u.status;
    if (u.qrCodeToken !== undefined) db.qr_code_token = u.qrCodeToken;
    await runWrite(supabase.from('dining_tables').update(db).eq('id', id), { type: 'success', message: 'Data meja berhasil diperbarui.' });
  };

  const deleteTable = async (id: string) => {
    const table = tables.find((t) => t.id === id);
    if (!table) return;
    if (table.status !== 'available') {
      addToast('warning', 'Meja hanya dapat dihapus saat statusnya tersedia.');
      return;
    }
    await runWrite(supabase.from('dining_tables').delete().eq('id', id), { type: 'success', message: `${table.tableNumber} berhasil dihapus.` });
  };

  const updateTableStatus = async (id: string, status: TableInfo['status']) => {
    await runWrite(supabase.from('dining_tables').update({ status }).eq('id', id));
  };

  // ---------------------------------------------------------------------------
  // Pesanan & pembayaran
  // ---------------------------------------------------------------------------

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const db: Record<string, unknown> = { status };
    if (status === 'cooking') db.kitchen_start_at = new Date().toISOString();
    if (status === 'ready_to_serve') db.kitchen_finish_at = new Date().toISOString();

    const { error } = await supabase.from('orders').update(db).eq('id', orderId);
    if (error) {
      addToast('error', friendlyDbError(error.message));
      return;
    }

    if (status === 'completed' || status === 'cancelled') {
      const order = orders.find((o) => o.id === orderId);
      const table = order?.tableNumber ? tables.find((t) => t.tableNumber === order.tableNumber && t.branchId === order.branchId) : undefined;
      if (table) {
        const { error: tErr } = await supabase.from('dining_tables').update({ status: 'available' }).eq('id', table.id);
        if (tErr) addToast('warning', 'Status pesanan berubah, tetapi meja gagal dikosongkan: ' + tErr.message);
      }
    }
    await fetchAllData();
    addToast('info', `Status pesanan diubah.`);
  };

  const processPayment = async (orderId: string, method: PaymentMethod, cashTendered?: number): Promise<OpResult> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return fail('Pesanan tidak ditemukan.');
    // Nominal dikirim = total tagihan; server menolak bila tidak sama.
    const { error } = await supabase.rpc('register_payment', {
      target_order: orderId,
      payment_method: method,
      paid_amount: order.totalAmount,
      tendered_amount: method === 'cash' ? cashTendered ?? null : null,
    });
    if (error) return fail(error.message);
    await fetchAllData();
    await addAuditLog('PEMBAYARAN_SELESAI', `Pesanan ${order.orderNumber} lunas via ${method}`, 'success', order.branchId);
    addToast('success', 'Pembayaran berhasil dicatat.');
    return OK;
  };

  const createTakeawayOrder: AppContextType['createTakeawayOrder'] = async (input) => {
    if (!currentUser?.branchId) return fail('Cabang kasir tidak ditemukan.');
    const items = input.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0).map((item) => ({
      menu_item_id: item.menuId,
      quantity: item.quantity,
      variant_choice: item.variantChoice || null,
      notes: item.notes || null,
      addons: item.addonIds.map((id) => ({ id })),
    }));
    if (!input.customerName.trim()) return fail('Nama pelanggan wajib diisi.');
    if (items.length === 0) return fail('Pilih minimal satu menu.');
    const { error } = await supabase.rpc('staff_create_takeaway_order', {
      p_branch: currentUser.branchId,
      p_customer: input.customerName.trim(),
      p_phone: input.customerPhone.trim() || null,
      p_items: items,
    });
    if (error) return fail(friendlyDbError(error.message));
    await fetchAllData();
    addToast('success', 'Pesanan takeaway berhasil dibuat dan dikirim ke antrean dapur.');
    return OK;
  };

  // ---------------------------------------------------------------------------
  // Stok
  // ---------------------------------------------------------------------------

  const adjustStock = async (id: string, amount: number, note: string) => {
    const item = inventory.find((inv) => inv.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.currentStock + amount);
    const db: Record<string, unknown> = { current_stock: newQty };
    if (amount > 0) db.last_restocked_at = new Date().toISOString();
    const ok = await runWrite(supabase.from('inventory_items').update(db).eq('id', id), {
      type: 'success',
      message: 'Stok bahan baku diperbarui.',
    });
    if (ok) await addAuditLog('PENYESUAIAN_STOK', `${item.name} ${amount > 0 ? '+' : ''}${amount} (${note})`, 'success', item.branchId);
  };

  const addInventoryItem: AppContextType['addInventoryItem'] = async (input) => {
    if (!restaurantId || !currentUser?.branchId) return fail('Cabang aktif tidak ditemukan.');
    const name = input.name.trim();
    const unit = input.unit.trim();
    const category = input.category.trim() || 'Bahan Baku';
    if (!name) return fail('Nama bahan wajib diisi.');
    if (name.length > 100) return fail('Nama bahan maksimal 100 karakter.');
    if (!unit) return fail('Satuan wajib diisi.');
    if (unit.length > 30) return fail('Satuan maksimal 30 karakter.');
    if (![input.currentStock, input.minThreshold, input.costPerUnit].every((v) => Number.isFinite(v) && v >= 0)) {
      return fail('Stok, ambang minimum, dan harga harus berupa angka 0 atau lebih.');
    }
    const duplicate = inventory.some(
      (item) => item.branchId === currentUser.branchId && item.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return fail('Bahan dengan nama ini sudah ada di cabang.');

    const { error } = await supabase.from('inventory_items').insert({
      restaurant_id: restaurantId,
      branch_id: currentUser.branchId,
      name,
      category,
      current_stock: input.currentStock,
      unit,
      min_threshold: input.minThreshold,
      cost_per_unit: input.costPerUnit,
      last_restocked_at: input.currentStock > 0 ? new Date().toISOString() : null,
    });
    if (error) return fail(friendlyDbError(error.message));

    await fetchAllData();
    await addAuditLog('TAMBAH_STOK', `${name} ${input.currentStock} ${unit}`, 'success', currentUser.branchId);
    addToast('success', `Bahan ${name} ditambahkan.`);
    return OK;
  };

  // ---------------------------------------------------------------------------
  // Tim
  // ---------------------------------------------------------------------------

  const setMemberStatus: AppContextType['setMemberStatus'] = async (userId, status) => {
    const { error } = await supabase.rpc('owner_set_member_status', { p_user_id: userId, p_status: status });
    if (error) return fail(error.message);
    const member = users.find((u) => u.id === userId);
    await fetchAllData();
    await addAuditLog(status === 'active' ? 'AKTIFKAN_AKSES' : 'NONAKTIFKAN_AKSES', `${member?.email || userId}`, 'warning', member?.branchId ?? null);
    addToast('success', status === 'active' ? 'Akses pengguna diaktifkan.' : 'Akses pengguna dinonaktifkan.');
    return OK;
  };

  const updateMemberAccess: AppContextType['updateMemberAccess'] = async (userId, d) => {
    if (d.role === 'owner') return fail('Role pemilik utama tidak dapat diberikan.');
    const { error } = await supabase.rpc('owner_update_member_access', {
      p_user_id: userId,
      p_full_name: d.fullName,
      p_phone: d.phone,
      p_role: d.role,
      p_branch_id: d.branchId,
    });
    if (error) return fail(error.message);
    const member = users.find((u) => u.id === userId);
    await fetchAllData();
    await addAuditLog('UBAH_HAK_AKSES', `${member?.email || userId} → ${d.role}`, 'warning', d.branchId);
    addToast('success', 'Hak akses pengguna diperbarui.');
    return OK;
  };

  // ---------------------------------------------------------------------------
  // Pengaturan
  // ---------------------------------------------------------------------------

  const updateSettings = async (s: Partial<GlobalSettings>) => {
    if (!restaurantId) return;
    const db: Record<string, unknown> = {};
    if (s.restaurantName !== undefined) db.name = s.restaurantName;
    if (s.brandTagline !== undefined) db.tagline = s.brandTagline;
    if (s.currency !== undefined) db.currency = s.currency;
    if (s.taxPercentage !== undefined) db.tax_percentage = s.taxPercentage;
    if (s.serviceChargePercentage !== undefined) db.service_charge_percentage = s.serviceChargePercentage;
    if (s.contactEmail !== undefined) db.contact_email = s.contactEmail;
    if (s.contactPhone !== undefined) db.contact_phone = s.contactPhone;
    if (s.allowOnlineTakeaway !== undefined) db.allow_online_takeaway = s.allowOnlineTakeaway;
    if (s.soundAlertsEnabled !== undefined) db.sound_alerts_enabled = s.soundAlertsEnabled;
    await runWrite(supabase.from('restaurants').update(db).eq('id', restaurantId), {
      type: 'success',
      message: 'Pengaturan restoran diperbarui.',
    });
  };

  const resetAllData = async () => {
    await fetchAllData();
    addToast('info', 'Data disinkronkan ulang dari server.');
  };

  const value: AppContextType = {
    currentUser,
    currentBranchId,
    setCurrentBranchId,
    restaurantId,
    branches,
    users,
    masterMenus,
    branchMenus,
    tables,
    orders,
    hasMoreOrders,
    inventory,
    auditLogs,
    settings,
    toasts,
    dataLoading,
    dataError,
    reloadData: fetchAllData,
    loadMoreOrders,
    login,
    logout,
    switchRole,
    addBranch,
    updateBranch,
    deleteBranch,
    menuCategories,
    addMenuCategory,
    deleteMenuCategory,
    addMasterMenu,
    updateMasterMenu,
    setMasterMenuStatus,
    deleteMasterMenu,
    distributeMenus,
    updateBranchPrice,
    toggleBranchAvailability,
    toggleBranchSoldOut,
    addTable,
    updateTable,
    deleteTable,
    updateTableStatus,
    updateOrderStatus,
    processPayment,
    createTakeawayOrder,
    adjustStock,
    addInventoryItem,
    setMemberStatus,
    updateMemberAccess,
    updateSettings,
    addToast,
    removeToast,
    addAuditLog,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
