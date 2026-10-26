import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, CustomerAuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { ReportFilterProvider } from './context/ReportFilterContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastContainer } from './components/common/ToastContainer';

// Views
import { Login } from './views/auth/Login';
import { Splash } from './views/auth/original/AuthPage';
import ResetPasswordPage from './views/auth/original/ResetPasswordPage';
import { CustomerPortal } from './views/customer/CustomerPortal';

// Super Admin
import { DashboardKonsolidasi } from './views/super-admin/DashboardKonsolidasi';
import { ManajemenCabang } from './views/super-admin/ManajemenCabang';
import { AdminHakAkses } from './views/super-admin/AdminHakAkses';
import { MasterKatalogMenu } from './views/super-admin/MasterKatalogMenu';
import { DistribusiMenu } from './views/super-admin/DistribusiMenu';
import { SemuaPesanan } from './views/super-admin/SemuaPesanan';
import { AnalitikPenjualan } from './views/super-admin/AnalitikPenjualan';
import { LaporanKeuangan } from './views/super-admin/LaporanKeuangan';
import { AuditKeamanan } from './views/super-admin/AuditKeamanan';
import { PengaturanGlobal } from './views/super-admin/PengaturanGlobal';

// Branch Admin
import { DashboardCabang } from './views/branch-admin/DashboardCabang';
import { MejaQRCode } from './views/branch-admin/MejaQRCode';
import { MenuHargaCabang } from './views/branch-admin/MenuHargaCabang';
import { StokBahanBaku } from './views/branch-admin/StokBahanBaku';
import { KaryawanCabang } from './views/branch-admin/KaryawanCabang';
import { LaporanOperasional } from './views/branch-admin/LaporanOperasional';

// Cashier
import { DashboardKasir } from './views/cashier/DashboardKasir';
import { TransaksiPembayaran } from './views/cashier/TransaksiPembayaran';
import { RiwayatTransaksi } from './views/cashier/RiwayatTransaksi';

// Kitchen
import { DashboardDapur } from './views/kitchen/DashboardDapur';

const MainAppContent: React.FC = () => {
  const { currentUser } = useApp();
  const { loading: authLoading } = useAuth();
  const [isCustomerView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('qr') || params.get('customer') === '1';
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard_konsolidasi');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Tautan "reset password" dari email Supabase (sesi pemulihan dibuat otomatis dari URL).
  if (window.location.pathname.replace(/\/+$/, '') === '/reset-password') {
    return (
      <>
        <ResetPasswordPage onGoToCustomer={() => window.location.replace('/?customer=1')} />
        <ToastContainer />
      </>
    );
  }

  if (isCustomerView) {
    return (
      <>
        <CustomerAuthProvider>
          <CustomerPortal />
        </CustomerAuthProvider>
        <ToastContainer />
      </>
    );
  }

  // Tunggu pemulihan sesi (refresh browser) supaya pengguna yang masih login tidak melihat form login sekilas.
  if (authLoading && !currentUser) {
    return <Splash label="Memeriksa sesi Anda…" />;
  }

  // Akun tanpa membership staf aktif (pendaftar mandiri / Google) hanya boleh memakai portal pelanggan.
  if (currentUser && currentUser.role === 'customer') {
    return (
      <>
        <CustomerPortal />
        <ToastContainer />
      </>
    );
  }

  // If not logged in
  if (!currentUser) {
    return (
      <>
        <Login onGoToCustomer={() => window.location.assign('/?customer=1')} />
        <ToastContainer />
      </>
    );
  }

  // Active view mapping per role
  let renderedView = <DashboardKonsolidasi />;
  let activeTabTitle = 'Dashboard Konsolidasi';

  if (currentUser.role === 'owner') {
    switch (activeTab) {
      case 'dashboard_konsolidasi':
        renderedView = <DashboardKonsolidasi />;
        activeTabTitle = 'Dashboard Konsolidasi';
        break;
      case 'manajemen_cabang':
        renderedView = <ManajemenCabang />;
        activeTabTitle = 'Manajemen Cabang';
        break;
      case 'admin_hak_akses':
        renderedView = <AdminHakAkses />;
        activeTabTitle = 'Admin & Hak Akses';
        break;
      case 'master_katalog':
        renderedView = <MasterKatalogMenu />;
        activeTabTitle = 'Master Katalog Menu';
        break;
      case 'distribusi_menu':
        renderedView = <DistribusiMenu />;
        activeTabTitle = 'Distribusi Menu ke Cabang';
        break;
      case 'semua_pesanan':
        renderedView = <SemuaPesanan />;
        activeTabTitle = 'Semua Pesanan';
        break;
      case 'analitik_penjualan':
        renderedView = <AnalitikPenjualan />;
        activeTabTitle = 'Analitik Penjualan';
        break;
      case 'laporan_keuangan':
        renderedView = <LaporanKeuangan />;
        activeTabTitle = 'Laporan Keuangan';
        break;
      case 'audit_keamanan':
        renderedView = <AuditKeamanan />;
        activeTabTitle = 'Audit & Keamanan';
        break;
      case 'pengaturan_global':
        renderedView = <PengaturanGlobal />;
        activeTabTitle = 'Pengaturan Global';
        break;
      default:
        renderedView = <DashboardKonsolidasi />;
        activeTabTitle = 'Dashboard Konsolidasi';
    }
  } else if (currentUser.role === 'branch_admin') {
    switch (activeTab) {
      case 'dashboard_cabang':
        renderedView = <DashboardCabang />;
        activeTabTitle = 'Dashboard Cabang';
        break;
      case 'pesanan_cabang':
        renderedView = <SemuaPesanan />;
        activeTabTitle = 'Pesanan Cabang';
        break;
      case 'meja_qr':
        renderedView = <MejaQRCode />;
        activeTabTitle = 'Meja & QR Code';
        break;
      case 'menu_harga_cabang':
        renderedView = <MenuHargaCabang />;
        activeTabTitle = 'Menu & Harga Cabang';
        break;
      case 'dapur_antrean':
        renderedView = <DashboardDapur initialSubTab="antrean_baru" />;
        activeTabTitle = 'Dapur & Antrean';
        break;
      case 'stok_bahan':
        renderedView = <StokBahanBaku />;
        activeTabTitle = 'Stok & Bahan Baku';
        break;
      case 'kasir_pembayaran':
        renderedView = <TransaksiPembayaran />;
        activeTabTitle = 'Kasir & Pembayaran';
        break;
      case 'karyawan_cabang':
        renderedView = <KaryawanCabang />;
        activeTabTitle = 'Karyawan Cabang';
        break;
      case 'laporan_operasional':
        renderedView = <LaporanOperasional />;
        activeTabTitle = 'Laporan Operasional';
        break;
      case 'pengaturan_cabang':
        renderedView = <PengaturanGlobal />;
        activeTabTitle = 'Pengaturan Cabang';
        break;
      default:
        renderedView = <DashboardCabang />;
        activeTabTitle = 'Dashboard Cabang';
    }
  } else if (currentUser.role === 'cashier') {
    switch (activeTab) {
      case 'dashboard_kasir':
        renderedView = <DashboardKasir onGoToCheckout={() => setActiveTab('transaksi_pembayaran')} />;
        activeTabTitle = 'Dashboard Kasir';
        break;
      case 'pesanan_masuk':
        renderedView = <SemuaPesanan />;
        activeTabTitle = 'Pesanan Masuk';
        break;
      case 'transaksi_pembayaran':
        renderedView = <TransaksiPembayaran />;
        activeTabTitle = 'Transaksi & POS';
        break;
      case 'riwayat_transaksi':
        renderedView = <RiwayatTransaksi />;
        activeTabTitle = 'Riwayat Transaksi';
        break;
      case 'informasi_meja':
        renderedView = <MejaQRCode />;
        activeTabTitle = 'Informasi Meja';
        break;
      default:
        renderedView = <DashboardKasir onGoToCheckout={() => setActiveTab('transaksi_pembayaran')} />;
        activeTabTitle = 'Dashboard Kasir';
    }
  } else if (currentUser.role === 'kitchen') {
    switch (activeTab) {
      case 'dashboard_dapur':
        renderedView = <DashboardDapur initialSubTab="antrean_baru" />;
        activeTabTitle = 'Dashboard Dapur';
        break;
      case 'antrean_baru':
        renderedView = <DashboardDapur initialSubTab="antrean_baru" />;
        activeTabTitle = 'Antrean Baru';
        break;
      case 'sedang_diproses':
        renderedView = <DashboardDapur initialSubTab="sedang_diproses" />;
        activeTabTitle = 'Sedang Diproses';
        break;
      case 'siap_disajikan':
        renderedView = <DashboardDapur initialSubTab="siap_disajikan" />;
        activeTabTitle = 'Siap Disajikan';
        break;
      case 'riwayat_pesanan':
        renderedView = <DashboardDapur initialSubTab="riwayat_pesanan" />;
        activeTabTitle = 'Riwayat Pesanan';
        break;
      default:
        renderedView = <DashboardDapur initialSubTab="antrean_baru" />;
        activeTabTitle = 'Dashboard Dapur';
    }
  }

  return (
    <div className="min-h-screen bg-nnorte-bg text-nnorte-text flex flex-col font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        setIsOpenMobile={setIsMobileMenuOpen}
      />

      {/* Main Layout Area */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          activeTabTitle={activeTabTitle}
        />

        <main className="flex-1 w-full max-w-[1600px] mx-auto overflow-y-auto p-4 sm:p-6">
          {renderedView}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <ReportFilterProvider>
            <MainAppContent />
          </ReportFilterProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}