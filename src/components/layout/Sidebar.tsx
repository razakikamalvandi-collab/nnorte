import React from "react";
import { useApp } from "../../context/AppContext";
import {
  LayoutDashboard,
  Building2,
  Users,
  UtensilsCrossed,
  Share2,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  QrCode,
  Tags,
  ChefHat,
  Package,
  CreditCard,
  UserCheck,
  Clock,
  Sparkles,
  ShoppingBag,
  LogOut,
  ExternalLink,
  Flame,
  X,
  CircleDollarSign,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile,
}) => {
  const { currentUser, logout, branches } = useApp();

  if (!currentUser) return null;

  const currentBranch = branches.find((b) => b.id === currentUser.branchId);

  // Define sidebar navigation items based on current user role
  let navItems: { id: string; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [];

  if (currentUser.role === 'owner') {
    navItems = [
      { id: 'dashboard_konsolidasi', label: 'Dashboard Konsolidasi', icon: LayoutDashboard },
      { id: 'manajemen_cabang', label: 'Manajemen Cabang', icon: Building2 },
      { id: 'admin_hak_akses', label: 'Admin & Hak Akses', icon: Users },
      { id: 'master_katalog', label: 'Master Katalog Menu', icon: UtensilsCrossed },
      { id: 'distribusi_menu', label: 'Distribusi Menu ke Cabang', icon: Share2 },
      { id: 'semua_pesanan', label: 'Semua Pesanan', icon: Receipt },
      { id: 'analitik_penjualan', label: 'Analitik Penjualan', icon: TrendingUp },
      { id: 'laporan_keuangan', label: 'Laporan Keuangan', icon: FileSpreadsheet },
      { id: 'audit_keamanan', label: 'Audit & Keamanan', icon: ShieldCheck },
      { id: 'pengaturan_global', label: 'Pengaturan Global', icon: Settings },
    ];
  } else if (currentUser.role === 'branch_admin') {
    navItems = [
      { id: 'dashboard_cabang', label: 'Dashboard Cabang', icon: LayoutDashboard },
      { id: 'pesanan_cabang', label: 'Pesanan Cabang', icon: Receipt },
      { id: 'meja_qr', label: 'Meja & QR Code', icon: QrCode },
      { id: 'master_katalog', label: 'Master Katalog Menu', icon: UtensilsCrossed },
      { id: 'menu_harga_cabang', label: 'Menu & Harga Cabang', icon: Tags },
      { id: 'dapur_antrean', label: 'Dapur & Antrean', icon: ChefHat },
      { id: 'stok_bahan', label: 'Stok & Bahan Baku', icon: Package },
      { id: 'kasir_pembayaran', label: 'Kasir & Pembayaran', icon: CreditCard },
      { id: 'karyawan_cabang', label: 'Karyawan Cabang', icon: UserCheck },
      { id: 'laporan_operasional', label: 'Laporan Operasional', icon: TrendingUp },
      { id: 'pengaturan_cabang', label: 'Pengaturan Cabang', icon: Settings },
    ];
  } else if (currentUser.role === 'cashier') {
    navItems = [
      { id: 'dashboard_kasir', label: 'Dashboard Kasir', icon: LayoutDashboard },
      { id: 'pesanan_masuk', label: 'Pesanan Masuk', icon: ShoppingBag },
      { id: 'transaksi_pembayaran', label: 'Transaksi & POS', icon: CircleDollarSign },
      { id: 'riwayat_transaksi', label: 'Riwayat Transaksi', icon: Receipt },
      { id: 'informasi_meja', label: 'Informasi Meja', icon: QrCode },
    ];
  } else if (currentUser.role === 'kitchen') {
    navItems = [
      { id: 'dashboard_dapur', label: 'Dashboard Dapur', icon: LayoutDashboard },
      { id: 'antrean_baru', label: 'Antrean Baru', icon: Clock },
      { id: 'sedang_diproses', label: 'Sedang Diproses', icon: Flame },
      { id: 'siap_disajikan', label: 'Siap Disajikan', icon: Sparkles },
      { id: 'riwayat_pesanan', label: 'Riwayat Dapur', icon: Receipt },
    ];
  }

  const roleBadgeText = {
    owner: 'Pemilik Utama / Super Admin',
    branch_admin: 'Admin Cabang',
    cashier: 'Kasir POS',
    kitchen: 'Head Chef Dapur',
    customer: 'Pelanggan',
  }[currentUser.role];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-nnorte-sidebar border-r border-nnorte-border flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="relative h-16 px-5 border-b border-nnorte-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nnorte-logo.svg" alt="Logo NNORTE" className="h-10 w-10 rounded-full object-cover shadow-md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider text-nnorte-text">NNORTE</span>
              </div>
              <p className="text-[10px] text-nnorte-muted truncate max-w-[130px]">
                {currentUser.role === 'owner' ? 'Coffee & Hangout' : currentBranch?.name || 'Cabang'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="lg:hidden text-nnorte-muted hover:text-nnorte-text p-1"
          >
            <X size={18} />
          </button>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-nnorte-red to-nnorte-blue opacity-70"
          />
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-nnorte-subtle">
            Menu Navigasi
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpenMobile(false);
                }}
                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 relative cursor-pointer text-left ${
                  isActive
                    ? 'bg-nnorte-red text-nnorte-on-brand font-semibold shadow-[0_6px_18px_-8px_var(--c-red-glow)]'
                    : 'text-nnorte-muted hover:text-nnorte-text hover:bg-nnorte-surface'
                }`}
              >
                <Icon
                  size={17}
                  className={isActive ? 'text-nnorte-on-brand' : 'text-nnorte-blue-soft/80 group-hover:text-nnorte-blue-soft'}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Quick link to customer ordering portal */}
          <div className="pt-4 mt-4 border-t border-nnorte-border/60">
            <button
              onClick={() => {
                const portalUrl = new URL(window.location.href);
                portalUrl.searchParams.set('customer', '1');
                if (currentUser.role === 'branch_admin' && currentUser.branchId) {
                  portalUrl.searchParams.set('branch', currentUser.branchId);
                } else {
                  portalUrl.searchParams.delete('branch');
                }
                window.open(portalUrl.toString(), '_blank', 'noopener,noreferrer');
              }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-medium text-nnorte-muted hover:text-nnorte-text hover:bg-nnorte-surface-2 border border-nnorte-border/40 hover:border-nnorte-blue/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={14} className="text-nnorte-blue-soft" />
                <span>Portal Pelanggan</span>
              </div>
              <span className="text-[10px] text-nnorte-subtle">Buka</span>
            </button>
          </div>
        </div>

        {/* User profile & Logout footer */}
        <div className="p-3 border-t border-nnorte-border bg-nnorte-bg">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-nnorte-surface-2 border border-nnorte-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-nnorte-red/20 border border-nnorte-red/40 flex items-center justify-center text-xs font-bold text-nnorte-red-hover shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-nnorte-text truncate">{currentUser.name}</div>
                <div className="text-[10px] text-nnorte-red truncate">{roleBadgeText}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar Sesi"
              className="w-7 h-7 rounded-md bg-nnorte-surface-2 hover:bg-nnorte-red-dark text-nnorte-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
