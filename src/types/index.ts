export type UserRole = 'owner' | 'branch_admin' | 'cashier' | 'kitchen' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string; // undefined for owner
  branchName?: string;
  avatar?: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

/** Anggota tim (hasil RPC list_team_members). */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  branchName?: string;
  status: 'active' | 'inactive';
  lastSignInAt?: string;
  createdAt?: string;
}

export interface Branch {
  id: string;
  /** Kode tampilan. Cabang nonaktif memakai kode arsip terakhirnya. */
  code: string;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo?: string;
  operatingHours: string;
  status: 'active' | 'inactive';
  totalTables: number;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  is24Hours: boolean;
  /** "HH:MM" (24 jam). Kosong jika is24Hours. */
  openingTime?: string;
  closingTime?: string;
  /** Warna grafik (#rrggbb). Kosong -> warna default berdasarkan urutan kode cabang. */
  chartColor?: string;
}

export interface MenuIngredient {
  name: string;
  /** Takaran bahan untuk satu porsi menu. */
  quantity: number;
  unit: string;
}

export interface MasterMenuItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  image: string;
  status: 'active' | 'archived';
  isPopular?: boolean;
  isSpicy?: boolean;
  preparationTimeMinutes: number;
  ingredients?: MenuIngredient[];
  allergens?: string[];
  variants?: {
    name: string; // e.g., 'Tingkat Kematangan'
    options: string[]; // ['Rare', 'Medium Rare', 'Medium', 'Well Done']
  }[];
  addons?: {
    id: string;
    name: string;
    price: number;
  }[];
}

export interface BranchMenuPricing {
  branchId: string;
  menuId: string;
  price: number;
  isAvailable: boolean;
  isSoldOutToday: boolean;
  customNote?: string;
}

export interface TableInfo {
  id: string;
  branchId: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'billing';
  qrCodeToken: string;
  currentOrderId?: string;
}

export interface OrderItem {
  id: string;
  menuId: string;
  name: string;
  price: number; // price at time of order
  quantity: number;
  variantChoice?: string;
  selectedAddons?: { name: string; price: number }[];
  notes?: string;
}

export type OrderStatus = 'pending' | 'kitchen_queue' | 'cooking' | 'ready_to_serve' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PaymentMethod = 'qris' | 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer';
export type OrderType = 'dine_in' | 'takeaway';

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  tableNumber?: string;
  customerName: string;
  customerPhone?: string;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  tax: number; // 10%
  serviceCharge: number; // 5%
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  cashTendered?: number;
  changeDue?: number;
  kitchenStartTime?: string;
  kitchenFinishTime?: string;
}

export interface InventoryItem {
  id: string;
  branchId: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  lastRestocked: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  target: string;
  branchName: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'error';
}

export type ExpenseCategory =
  | 'bahan_baku'
  | 'gaji'
  | 'utilitas'
  | 'sewa'
  | 'pemasaran'
  | 'perawatan'
  | 'lainnya';

export interface Expense {
  id: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
}

export interface GlobalSettings {
  restaurantName: string;
  brandTagline: string;
  currency: string;
  taxPercentage: number;
  serviceChargePercentage: number;
  contactEmail: string;
  contactPhone: string;
  allowOnlineTakeaway: boolean;
  soundAlertsEnabled: boolean;
}


