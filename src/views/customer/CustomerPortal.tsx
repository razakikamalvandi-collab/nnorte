import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  CupSoda,
  Eye,
  EyeOff,
  Flame,
  IceCreamCone,
  Info,
  Leaf,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  Phone,
  Pizza,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Sandwich,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  UserRound,
  Utensils,
  Zap,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { SplashScreen } from '../../components/customer/SplashScreen';
import type { TrackItem } from '../../components/customer/OrderFactory3D';
import type { RatingSubmit } from '../../components/customer/OrderRatingDialog';
import { Button } from '../../components/ui/Button';
import AddToCartAnimation from '@/components/ui/AddToCartAnimation';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import {
  PortalBranch,
  PortalMenuItem,
  PortalOrderStatus,
  PortalTable,
  type PortalOrderRatings,
  createOrder,
  fetchBranches,
  fetchMenu,
  fetchOrderRatings,
  fetchOrderStatus,
  resolveTable,
  submitOrderRating,
} from '../../lib/portalApi';
import { isDrinkCategory, toSceneStatus } from '../../lib/orderProgress';
import { formatRupiah, getOrderStatusBadge, getPaymentStatusBadge } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

interface CartLine {
  key: string;
  menu: PortalMenuItem;
  quantity: number;
  addonIds: string[];
  variantChoice: string;
  notes: string;
}

type OrderTab = 'cart' | 'checkout' | 'track';

const SEEN_KEY = 'nnorte_splash_seen';
const TRACK_KEY = 'nnorte_track';
const safeGet = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* abaikan */ } };

const lineUnit = (l: CartLine) => l.menu.price + l.menu.addons.filter((a) => l.addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0);

const ORDER_TABS = [
  { id: 'cart', label: 'Keranjang', icon: ShoppingBag },
  { id: 'checkout', label: 'Checkout', icon: Banknote },
  { id: 'track', label: 'Lacak', icon: ReceiptText },
] as const;

// Three.js dimuat hanya saat tab Lacak benar-benar dibuka.
const OrderFactory3D = React.lazy(() =>
  import('../../components/customer/OrderFactory3D').then((module) => ({ default: module.OrderFactory3D })),
);

function categoryIcon(category: string) {
  const key = category.toLowerCase();
  if (key.includes('pizza') || key.includes('piza')) return Pizza;
  if (key.includes('burger') || key.includes('sandwich') || key.includes('roti')) return Sandwich;
  if (key.includes('minum') || key.includes('kopi') || key.includes('teh') || key.includes('jus')) return CupSoda;
  if (
    key.includes('dessert')
    || key.includes('manis')
    || key.includes('kue')
    || key.includes('es krim')
    || key.includes('es buah')
    || key === 'es'
    || key.startsWith('es ')
  ) return IceCreamCone;
  return Utensils;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width={16} height={16} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export const CustomerPortal: React.FC = () => {
  const { user, signIn, signUp, signInWithGoogle, signOut, resetPassword } = useAuth();
  const { addToast } = useApp();
  const qrToken = useMemo(() => new URLSearchParams(window.location.search).get('qr'), []);

  const [splash, setSplash] = useState(() => safeGet(SEEN_KEY) !== '1');
  const [steps, setSteps] = useState({ done: 0, total: 3 });
  const [bootError, setBootError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [branches, setBranches] = useState<PortalBranch[]>([]);
  const [table, setTable] = useState<PortalTable | null>(null);
  const [branchId, setBranchId] = useState('');
  const [menu, setMenu] = useState<PortalMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [optionFor, setOptionFor] = useState<PortalMenuItem | null>(null);
  const [opt, setOpt] = useState<{ addonIds: string[]; variants: Record<string, string>; notes: string }>({ addonIds: [], variants: {}, notes: '' });

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderTab, setOrderTab] = useState<OrderTab>('cart');
  const [tableInfoOpen, setTableInfoOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ orderNumber: string; total: number } | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [track, setTrack] = useState<{ orderId: string; token: string } | null>(() => {
    try { const v = safeGet(TRACK_KEY); return v ? (JSON.parse(v) as { orderId: string; token: string }) : null; } catch { return null; }
  });
  const [status, setStatus] = useState<PortalOrderStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<PortalOrderRatings | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const menuReq = useRef(0);
  const ratingsReq = useRef(0);
  const trackRef = useRef(track);
  trackRef.current = track;
  const cartRef = useRef<HTMLButtonElement>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const branch = branches.find((b) => b.id === branchId);
  const locked = !!table; // cabang ditentukan oleh QR meja
  const displayName = user ? (user.name && !user.name.includes('@') ? user.name : user.email) : '';
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'NN';

  const loadMenu = useCallback(async (id: string) => {
    const req = ++menuReq.current;
    setMenuLoading(true);
    setMenuError(null);
    try {
      const m = await fetchMenu(id);
      if (req === menuReq.current) setMenu(m);
    } catch (e) {
      if (req === menuReq.current) setMenuError(e instanceof Error ? e.message : 'Menu gagal dimuat.');
    } finally {
      if (req === menuReq.current) setMenuLoading(false);
    }
  }, []);

  const loadRatings = useCallback(async (silent = false) => {
    if (!track) return;
    const req = ++ratingsReq.current;
    if (!silent) {
      setRatingsLoading(true);
      setRatingsError(null);
    }
    try {
      const next = await fetchOrderRatings(track.orderId, track.token);
      if (req === ratingsReq.current) {
        setRatings(next);
        setRatingsError(null);
      }
    } catch (e) {
      if (req === ratingsReq.current) setRatingsError(e instanceof Error ? e.message : 'Rating gagal dimuat.');
    } finally {
      // Request terbaru (termasuk refetch senyap) selalu menutup indikator loading.
      // Request lama yang sudah tidak relevan tidak boleh mengubah state.
      if (req === ratingsReq.current) setRatingsLoading(false);
    }
  }, [track]);

  const boot = useCallback(async () => {
    setBootError(null);
    setReady(false);
    setSteps({ done: 0, total: 3 });
    try {
      const bs = await fetchBranches();
      setBranches(bs);
      setSteps((s) => ({ ...s, done: 1 }));
      let tbl: PortalTable | null = null;
      if (qrToken) {
        tbl = await resolveTable(qrToken);
        if (!tbl) throw new Error('Kode QR meja tidak dikenali. Pindai ulang QR di meja Anda atau minta bantuan staf.');
      }
      setTable(tbl);
      setSteps((s) => ({ ...s, done: 2 }));
      const target = tbl?.branchId ?? bs[0]?.id ?? '';
      setBranchId(target);
      if (target) {
        const m = await fetchMenu(target);
        setMenu(m);
      }
      setSteps({ done: 3, total: 3 });
      if (!tbl) setOrderType('takeaway');
      setBootError(null);
      setReady(true);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : 'Gagal memuat data.');
    }
  }, [qrToken]);

  useEffect(() => {
    void boot();
  }, [boot]);

  // Batas waktu: splash tidak boleh menggantung selamanya.
  useEffect(() => {
    if (ready || bootError) return;
    const t = window.setTimeout(() => setBootError('Pemuatan terlalu lama. Periksa koneksi internet Anda.'), 15000);
    return () => window.clearTimeout(t);
  }, [ready, bootError, steps.done]);

  // Pantau status pesanan sampai selesai/dibatalkan.
  useEffect(() => {
    if (!track) return;
    let stop = false;
    const tick = async () => {
      try {
        const st = await fetchOrderStatus(track.orderId, track.token);
        if (stop) return;
        setStatus(st);
        setStatusError(st ? null : 'Pesanan tidak ditemukan.');
        if (st && (st.status === 'completed' || st.status === 'cancelled')) window.clearInterval(iv);
      } catch (e) {
        if (!stop) setStatusError(e instanceof Error ? e.message : 'Gagal memuat status.');
      }
    };
    const iv = window.setInterval(() => void tick(), 10000);
    void tick();
    return () => { stop = true; window.clearInterval(iv); };
  }, [track]);

  // Ganti pesanan yang dilacak -> buang rating pesanan lama dan batalkan
  // respons rating yang masih dalam perjalanan dari pesanan sebelumnya.
  useEffect(() => {
    ratingsReq.current += 1;
    setRatings(null);
    setRatingsError(null);
    setRatingsLoading(false);
  }, [track?.orderId, track?.token]);

  // Rating hanya perlu dimuat saat pesanan sudah selesai.
  useEffect(() => {
    if (!track || status?.status !== 'completed') return;
    void loadRatings();
  }, [track, status?.status, loadRatings]);

  // Setelah pelanggan masuk, isi nama & nomor otomatis (tanpa menimpa ketikan mereka).
  useEffect(() => {
    if (!user) return;
    const profileName = user.name && !user.name.includes('@') ? user.name : '';
    setName((current) => current || profileName);
    setPhone((current) => current || user.phone || '');
  }, [user]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(menu.map((m) => m.category).filter(Boolean)))], [menu]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => (category === 'all' || m.category === category) && (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)));
  }, [menu, search, category]);
  const featured = useMemo(
    () =>
      menu.find((m) => m.isPopular && !m.soldOut && m.image)
      ?? menu.find((m) => !m.soldOut && m.image)
      ?? menu.find((m) => m.image)
      ?? menu[0],
    [menu],
  );

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + lineUnit(l) * l.quantity, 0);
  const tax = Math.round((subtotal * (branch?.taxPercentage ?? 0)) / 100);
  const service = Math.round((subtotal * (branch?.servicePercentage ?? 0)) / 100);
  const totalEstimate = subtotal + tax + service;

  const optUnit = optionFor
    ? optionFor.price + optionFor.addons.filter((a) => opt.addonIds.includes(a.id)).reduce((sum, a) => sum + a.price, 0)
    : 0;

  const canTakeaway = !!branch?.allowTakeaway;
  const sb = status ? getOrderStatusBadge(status.status) : null;
  const pb = status ? getPaymentStatusBadge(status.paymentStatus) : null;

  const trackItems: TrackItem[] = useMemo(() => {
    if (!status) return [];
    return status.items.map((item, index) => {
      const menuItem = menu.find((candidate) => candidate.id === item.menuItemId)
        ?? menu.find((candidate) => candidate.name === item.name);
      const saved = ratings?.items.find((entry) => entry.orderItemId === item.orderItemId);
      return {
        id: item.orderItemId || `item-${index}`,
        orderItemId: item.orderItemId || `item-${index}`,
        name: item.name,
        qty: item.quantity,
        imageUrl: menuItem?.image ?? null,
        kind: isDrinkCategory(menuItem?.category),
        note: item.notes || undefined,
        rating: saved?.rating ?? null,
      };
    });
  }, [status, menu, ratings]);

  const ratingsReady = !!ratings && !ratingsLoading;
  const canRateOrder = !!status && status.items.length > 0 && status.items.every((item) => !!item.orderItemId);

  const handleRate = async (submitted: RatingSubmit[]) => {
    const currentTrack = track;
    if (!currentTrack) throw new Error('Pesanan tidak ditemukan.');
    await submitOrderRating(currentTrack.orderId, currentTrack.token, submitted);

    // Jangan pernah mencampur rating pesanan lama ke pesanan yang sedang
    // dilacak bila pelanggan berganti pesanan saat RPC masih berjalan.
    if (
      trackRef.current?.orderId !== currentTrack.orderId ||
      trackRef.current?.token !== currentTrack.token
    ) return;

    // Perbarui tampilan lebih dulu agar dialog sukses tidak menunggu refetch.
    setRatings((current) => {
      const next: PortalOrderRatings = current ?? { orderRating: null, orderReview: null, items: [] };
      const overall = submitted.find((entry) => entry.orderItemId == null);
      const items = [...next.items];
      for (const entry of submitted) {
        if (entry.orderItemId == null) continue;
        const index = items.findIndex((item) => item.orderItemId === entry.orderItemId);
        if (index >= 0) items[index] = { orderItemId: entry.orderItemId, rating: entry.rating };
        else items.push({ orderItemId: entry.orderItemId, rating: entry.rating });
      }
      return {
        orderRating: overall?.rating ?? next.orderRating,
        orderReview: overall?.review?.trim() || next.orderReview,
        items,
      };
    });

    // Refetch senyap: dialog sukses tidak boleh tertutup hanya karena loading.
    void loadRatings(true);
  };

  const scrollToMenu = () => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.getElementById('portal-menu')?.scrollIntoView({ behavior, block: 'start' });
  };

  const selectCategory = (next: string) => {
    setCategory(next);
    scrollToMenu();
  };

  const openOrder = (nextTab: OrderTab) => {
    setOrderTab(nextTab);
    setOrderOpen(true);
  };

  const closeAndBrowse = () => {
    setOrderOpen(false);
    window.setTimeout(scrollToMenu, 180);
  };

  const pulseCart = () => {
    const cartButton = cartRef.current;
    if (!cartButton) return;
    cartButton.classList.remove('nnorte-cart-bounce');
    void cartButton.offsetWidth;
    cartButton.addEventListener('animationend', (event) => {
      if (event.target === cartButton) cartButton.classList.remove('nnorte-cart-bounce');
    }, { once: true });
    cartButton.classList.add('nnorte-cart-bounce');

    const ripple = cartButton.querySelector<HTMLElement>('.nnorte-cart-ripple');
    if (ripple) {
      ripple.classList.remove('nnorte-cart-ripple--active');
      void ripple.offsetWidth;
      ripple.addEventListener('animationend', (event) => {
        if (event.target === ripple) ripple.classList.remove('nnorte-cart-ripple--active');
      }, { once: true });
      ripple.classList.add('nnorte-cart-ripple--active');
    }
  };

  const changeBranch = (id: string) => {
    if (cart.length > 0 && !window.confirm('Mengganti cabang akan mengosongkan keranjang. Lanjutkan?')) return;
    setCart([]);
    setBranchId(id);
    void loadMenu(id);
  };

  const openAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setAuthPassword('');
    setAccountOpen(false);
    setAuthOpen(true);
  };

  const switchAuthMode = (mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthNotice(null);
    setAuthPassword('');
  };

  const submitAuth = async () => {
    if (authBusy) return;
    setAuthError(null);
    setAuthNotice(null);
    const email = authEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthError('Format email tidak valid.');
    if (authMode !== 'forgot' && !authPassword) return setAuthError('Password wajib diisi.');
    if (authMode === 'register' && authName.trim().length < 2) return setAuthError('Nama minimal 2 karakter.');
    if (authMode === 'register' && authPassword.length < 8) return setAuthError('Password minimal 8 karakter.');

    setAuthBusy(true);
    try {
      if (authMode === 'forgot') {
        const res = await resetPassword(email);
        if (!res.ok) setAuthError(res.error ?? 'Gagal mengirim email reset.');
        else setAuthNotice('Tautan reset password sudah dikirim. Periksa email Anda.');
        return;
      }
      if (authMode === 'register') {
        const res = await signUp(email, authPassword, authName.trim());
        if (!res.ok) {
          setAuthError(res.error ?? 'Pendaftaran gagal.');
          return;
        }
        if (res.needsConfirmation) {
          setAuthMode('login');
          setAuthPassword('');
          setAuthNotice('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.');
        } else {
          setAuthOpen(false);
        }
        return;
      }
      const res = await signIn(email, authPassword);
      if (!res.ok) {
        setAuthError(res.error ?? 'Gagal masuk.');
        return;
      }
      setAuthOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setAuthBusy(false);
    }
  };

  const googleAuth = async () => {
    if (authBusy) return;
    setAuthError(null);
    setAuthNotice(null);
    setAuthBusy(true);
    const res = await signInWithGoogle();
    setAuthBusy(false);
    if (!res.ok) setAuthError(res.error ?? 'Gagal masuk dengan Google.');
  };

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
  };

  const addLine = (m: PortalMenuItem, addonIds: string[], variants: Record<string, string>, notes: string) => {
    const variantChoice = Object.entries(variants).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ').slice(0, 60);
    const key = `${m.id}|${[...addonIds].sort().join(',')}|${variantChoice}|${notes}`;
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      if (ex) return c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l));
      return [...c, { key, menu: m, quantity: 1, addonIds, variantChoice, notes }];
    });
    setOptionFor(null);
  };

  const addToCart = (m: PortalMenuItem) => {
    addLine(m, [], {}, '');
    addToast('success', `${m.name} ditambahkan ke keranjang.`);
  };

  const confirmAddOption = () => {
    if (!optionFor) return;
    addLine(optionFor, opt.addonIds, opt.variants, opt.notes.trim());
    pulseCart();
    addToast('success', `${optionFor.name} ditambahkan ke keranjang.`);
  };

  const openItem = (m: PortalMenuItem) => {
    if (m.addons.length === 0 && m.variants.length === 0) return addToCart(m);
    setOpt({ addonIds: [], variants: Object.fromEntries(m.variants.map((v) => [v.name, v.options[0] ?? ''])), notes: '' });
    setOptionFor(m);
  };

  const changeQty = (key: string, d: number) =>
    setCart((c) => c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + d) } : l)).filter((l) => l.quantity > 0));

  const refreshStatus = async () => {
    if (!track) return;
    setStatusError(null);
    try {
      const st = await fetchOrderStatus(track.orderId, track.token);
      setStatus(st);
      if (!st) setStatusError('Pesanan tidak ditemukan.');
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Gagal memuat status.');
    }
  };

  const submit = async () => {
    if (submitting || !branch || cart.length === 0) return;
    if (!name.trim()) return setSubmitError('Nama pemesan wajib diisi.');
    if (orderType === 'dine_in' && !table) return setSubmitError('Untuk makan di tempat, pindai QR di meja Anda.');
    if (orderType === 'takeaway' && !canTakeaway) return setSubmitError('Pesanan bawa pulang online belum dibuka cabang ini.');
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createOrder({
        branchId: branch.id,
        qrToken: orderType === 'dine_in' ? qrToken : null,
        orderType,
        customer: name.trim(),
        phone: phone.trim(),
        lines: cart.map((l) => ({ menuId: l.menu.id, quantity: l.quantity, variantChoice: l.variantChoice, notes: l.notes, addonIds: l.addonIds })),
      });
      const t = { orderId: res.orderId, token: res.trackingToken };
      safeSet(TRACK_KEY, JSON.stringify(t));
      setTrack(t);
      setStatus(null);
      setStatusError(null);
      setLastOrder({ orderNumber: res.orderNumber, total: res.total });
      setCart([]);
      setOrderOpen(false);
      setOrderTab('track');
      setSuccessOpen(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Pesanan gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  };

  if (splash) {
    return (
      <SplashScreen
        progress={steps}
        ready={ready}
        error={bootError}
        onRetry={() => void boot()}
        onFinish={() => { safeSet(SEEN_KEY, '1'); setSplash(false); }}
      />
    );
  }

  if (bootError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-nnorte-bg p-6">
        <div className="w-full max-w-sm">
          <ErrorState message={bootError} onRetry={() => { setSplash(true); void boot(); }} />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-nnorte-bg font-sans text-nnorte-text">
      <header className="sticky top-0 z-30 border-b border-nnorte-border bg-nnorte-sidebar/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
              className="flex min-w-0 cursor-pointer items-center gap-2.5"
              aria-label="NNORTE, kembali ke atas"
            >
              <img src="/nnorte-logo.svg" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-base font-black tracking-[0.16em]">NNORTE</span>
                <span className="hidden text-[8px] font-bold uppercase tracking-[0.2em] text-nnorte-muted sm:block">Restoran Multi Cabang</span>
              </span>
            </button>

            {table ? (
              <button
                type="button"
                onClick={() => setTableInfoOpen(true)}
                aria-label={`Meja ${table.tableNumber}, lihat info meja`}
                className="nn-press inline-flex h-8 max-w-32 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-nnorte-red/35 bg-nnorte-red/10 px-2.5 text-[10px] font-bold text-nnorte-red"
              >
                <QrCode size={11} aria-hidden="true" />
                <span className="truncate">Meja {table.tableNumber}</span>
              </button>
            ) : !locked && branches.length > 0 ? (
              <label className="relative inline-flex h-8 max-w-40 shrink-0 items-center gap-1 rounded-full border border-nnorte-border bg-nnorte-surface-2 pl-2.5 pr-1 text-[10px] font-semibold text-nnorte-muted">
                <MapPin size={11} className="shrink-0" aria-hidden="true" />
                <select
                  value={branchId}
                  onChange={(e) => changeBranch(e.target.value)}
                  aria-label="Pilih cabang"
                  className="min-w-0 max-w-28 cursor-pointer appearance-none truncate bg-transparent py-1 pr-4 text-[10px] font-semibold text-nnorte-text outline-none"
                >
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-1.5" aria-hidden="true" />
              </label>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={`Akun ${displayName}`}
                  className="nn-press flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-nnorte-border bg-nnorte-surface-2 px-1.5 text-nnorte-text hover:border-nnorte-blue/40"
                >
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                    : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-nnorte-red text-[9px] font-black text-nnorte-on-brand">{initials}</span>}
                  <span className="hidden max-w-20 truncate text-[11px] font-semibold sm:inline">{displayName.split(' ')[0]}</span>
                </button>
                {accountOpen && (
                  <>
                    <button type="button" tabIndex={-1} aria-label="Tutup menu akun" onClick={() => setAccountOpen(false)} className="fixed inset-0 z-10 cursor-default bg-transparent" />
                    <div role="menu" aria-label="Menu akun" className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface shadow-xl">
                      <div className="border-b border-nnorte-border px-3 py-2.5">
                        <p className="truncate text-[11px] font-bold text-nnorte-text">{displayName}</p>
                        <p className="truncate text-[10px] text-nnorte-muted">{user.email}</p>
                      </div>
                      {track && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setAccountOpen(false); openOrder('track'); }}
                          className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-3 text-[11px] font-semibold text-nnorte-text hover:bg-nnorte-surface-2"
                        >
                          <ReceiptText size={13} aria-hidden="true" /> Lacak Pesanan
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-3 text-[11px] font-semibold text-nnorte-text hover:bg-nnorte-surface-2"
                      >
                        <LogOut size={13} aria-hidden="true" /> Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('login')}
                aria-label="Masuk ke akun pelanggan"
                className="nn-press flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-nnorte-border bg-nnorte-surface-2 px-2.5 text-[11px] font-semibold text-nnorte-text hover:border-nnorte-blue/40"
              >
                <LogIn size={14} aria-hidden="true" /> <span className="hidden sm:inline">Masuk</span>
              </button>
            )}
            <button
              ref={cartRef}
              type="button"
              onClick={() => openOrder('cart')}
              aria-label={`Buka keranjang, ${count} item`}
              className="nn-press relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-nnorte-border bg-nnorte-surface-2 text-nnorte-text hover:border-nnorte-blue/40"
            >
              <ShoppingBag size={17} aria-hidden="true" />
              <span className="nnorte-cart-ripple pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-current text-nnorte-red opacity-0" aria-hidden="true" />
              {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-nnorte-red px-1 text-[10px] font-black text-nnorte-on-brand shadow-md">{count > 99 ? '99+' : count}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {branches.length === 0 ? (
          <EmptyState icon={Utensils} title="Belum ada cabang yang buka" description="Silakan kembali beberapa saat lagi." />
        ) : (
          <div className="space-y-5 sm:space-y-7">
            <section className="relative overflow-hidden rounded-3xl border border-nnorte-border bg-gradient-to-br from-nnorte-red-dark/25 via-nnorte-surface to-nnorte-surface p-5 shadow-xl sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-nnorte-red/10 blur-3xl" aria-hidden="true" />
              <div className="relative grid gap-5 md:grid-cols-12 md:items-center">
                <div className="space-y-4 md:col-span-7">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-nnorte-red/30 bg-nnorte-red/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-nnorte-red">
                    <Flame size={11} className="fill-current" aria-hidden="true" /> {branch?.restaurantName || 'NNORTE'}
                  </span>
                  <div className="space-y-2">
                    <h1 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl">
                      {table ? 'Pesan langsung dari meja Anda.' : canTakeaway ? 'Pesan untuk dibawa pulang.' : 'Pindai QR meja untuk memesan.'}
                    </h1>
                    <p className="max-w-lg text-[11px] leading-relaxed text-nnorte-muted sm:text-sm">
                      {branch?.tagline || 'Pilih hidangan favorit, kirim pesanan, dan lacak prosesnya tanpa perlu antre.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted" aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Cari menu"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari makanan atau minuman…"
                        className={`${inputClass()} pl-9`}
                      />
                    </div>
                    <Button className="shrink-0" onClick={scrollToMenu} icon={<ArrowRight size={14} />}>Cari Menu</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-semibold text-nnorte-muted">
                    <span className="inline-flex items-center gap-1"><Zap size={11} className="text-nnorte-red" aria-hidden="true" /> Pesanan langsung ke dapur</span>
                    <span className="inline-flex items-center gap-1"><Leaf size={11} className="text-nnorte-success" aria-hidden="true" /> Bahan segar</span>
                    <span className="inline-flex items-center gap-1"><ShieldCheck size={11} className="text-nnorte-blue-soft" aria-hidden="true" /> Harga transparan</span>
                  </div>
                </div>

                <div className="md:col-span-5">
                  {featured ? (
                    <button
                      type="button"
                      onClick={() => selectCategory('all')}
                      className="group relative block w-full overflow-hidden rounded-2xl border border-nnorte-border bg-nnorte-sidebar text-left shadow-lg"
                      aria-label={`Lihat ${featured.name}`}
                    >
                      {featured.image ? (
                        <img src={featured.image} alt={featured.name} className="nnorte-product-image aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <span className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-nnorte-red-dark/30 to-nnorte-sidebar text-nnorte-muted"><Utensils size={36} aria-hidden="true" /></span>
                      )}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" aria-hidden="true" />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur">
                        <Sparkles size={9} aria-hidden="true" /> Rekomendasi
                      </span>
                      <span className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/55 p-2.5 backdrop-blur">
                        <span className="block truncate text-[11px] font-bold text-white">{featured.name}</span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="text-[9px] text-white/70">{featured.category}</span>
                          <span className="text-sm font-black text-nnorte-red-soft">{formatRupiah(featured.price)}</span>
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted">
                      <img src="/nnorte-logo.svg" alt="" className="h-16 w-16 opacity-40" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {track && (
              <button
                type="button"
                onClick={() => openOrder('track')}
                className="nn-lift flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-nnorte-red/30 bg-nnorte-red/10 p-3 text-left sm:p-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nnorte-red text-nnorte-on-brand shadow-glow-red">
                  <ReceiptText size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">Pesanan {status?.orderNumber ?? 'aktif'}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-nnorte-muted">
                    {status ? [sb?.label, pb?.label].filter(Boolean).join(' · ') : statusError ? 'Status pesanan tidak tersedia' : 'Memuat status pesanan…'}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold text-nnorte-red sm:inline-flex">Lacak <ChevronRight size={12} aria-hidden="true" /></span>
                <ChevronRight size={14} className="shrink-0 text-nnorte-muted sm:hidden" aria-hidden="true" />
              </button>
            )}

            {!user && (
              <section className="flex flex-col gap-3 rounded-2xl border border-nnorte-blue/30 bg-nnorte-blue/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nnorte-blue/15 text-nnorte-blue-soft">
                    <UserRound size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold">Pesan lebih cepat dengan akun</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-nnorte-muted">Nama dan nomor telepon otomatis terisi saat checkout.</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" className="flex-1 sm:flex-none" icon={<LogIn size={13} />} onClick={() => openAuth('login')}>Masuk</Button>
                  <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" icon={<UserPlus size={13} />} onClick={() => openAuth('register')}>Daftar</Button>
                </div>
              </section>
            )}

            <section className="space-y-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nnorte-red">Jelajahi</p>
                  <h2 className="text-lg font-black tracking-tight">Kategori Menu</h2>
                </div>
                <span className="text-[10px] text-nnorte-muted">{Math.max(categories.length - 1, 0)} kategori</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori menu">
                {categories.map((c) => {
                  const Icon = c === 'all' ? Sparkles : categoryIcon(c);
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectCategory(c)}
                      className={`nn-press inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold ${
                        active
                          ? 'border-nnorte-red bg-nnorte-red text-nnorte-on-brand shadow-glow-red'
                          : 'border-nnorte-border bg-nnorte-surface text-nnorte-muted hover:border-nnorte-red/40 hover:text-nnorte-text'
                      }`}
                    >
                      <Icon size={12} aria-hidden="true" />
                      {c === 'all' ? 'Semua' : c}
                    </button>
                  );
                })}
              </div>
            </section>

            <section id="portal-menu" className="scroll-mt-24 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-nnorte-red">Katalog</p>
                  <h2 className="text-xl font-black tracking-tight">Daftar Hidangan</h2>
                </div>
                <span className="text-[10px] text-nnorte-muted">{visible.length} menu</span>
              </div>

              {menuError ? (
                <ErrorState message={menuError} onRetry={() => void loadMenu(branchId)} />
              ) : menuLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-64" />)}
                </div>
              ) : visible.length === 0 ? (
                <EmptyState
                  icon={Utensils}
                  title={menu.length === 0 ? 'Menu belum tersedia' : 'Menu tidak ditemukan'}
                  description={menu.length === 0 ? 'Cabang ini belum memiliki menu yang dijual.' : 'Coba kata kunci atau kategori lain.'}
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {visible.map((m, i) => (
                    <li
                      key={m.id}
                      className="nn-rise group flex flex-col overflow-hidden rounded-2xl border border-nnorte-border bg-nnorte-surface shadow-sm transition-colors hover:border-nnorte-red/35"
                      style={{ ['--i' as string]: Math.min(i, 8) }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-nnorte-sidebar">
                        {m.image ? (
                          <img src={m.image} alt={m.name} loading="lazy" className={`nnorte-product-image h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${m.soldOut ? 'opacity-55' : ''}`} />
                        ) : (
                          <span className="flex h-full items-center justify-center text-nnorte-muted"><Utensils size={28} aria-hidden="true" /></span>
                        )}
                        <span className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/55 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white backdrop-blur">{m.category}</span>
                        <span className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
                          {m.isPopular && <span className="inline-flex items-center gap-0.5 rounded-full bg-nnorte-red px-1.5 py-0.5 text-[8px] font-bold text-nnorte-on-brand shadow-sm"><Star size={8} className="fill-current" aria-hidden="true" /> Favorit</span>}
                          {m.isSpicy && <span className="inline-flex items-center gap-0.5 rounded-full bg-nnorte-warning px-1.5 py-0.5 text-[8px] font-bold text-nnorte-bg shadow-sm"><Flame size={8} className="fill-current" aria-hidden="true" /> Pedas</span>}
                          {m.soldOut && <span className="rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur">Habis</span>}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="flex items-center justify-between gap-2 text-[9px] text-nnorte-muted">
                          <span className="truncate font-bold uppercase tracking-wider text-nnorte-red">{m.category}</span>
                          {m.prepMinutes > 0 && <span className="inline-flex shrink-0 items-center gap-0.5"><Clock size={9} aria-hidden="true" /> ±{m.prepMinutes} mnt</span>}
                        </div>
                        <h3 className="mt-1 text-[13px] font-bold leading-snug">{m.name}</h3>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-nnorte-muted">{m.description || 'Hidangan pilihan dari dapur NNORTE.'}</p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-sm font-black text-nnorte-red">{formatRupiah(m.price)}</span>
                          {m.soldOut ? (
                            <span className="text-[10px] font-semibold text-nnorte-muted">Habis</span>
                          ) : m.addons.length === 0 && m.variants.length === 0 ? (
                            <AddToCartAnimation
                              product={{ id: m.id, name: m.name, price: m.price, image: m.image ?? '' }}
                              cartRef={cartRef}
                              onAdd={() => addToCart(m)}
                            />
                          ) : (
                            <button
                              type="button"
                              aria-label={`Atur ${m.name}`}
                              onClick={() => openItem(m)}
                              className="nn-press inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-nnorte-red px-3 text-[11px] font-bold text-nnorte-on-brand hover:bg-nnorte-red-hover"
                            >
                              <Plus size={13} aria-hidden="true" /> Atur
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-nnorte-border bg-nnorte-sidebar/70">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 md:grid-cols-12 lg:px-8">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <img src="/nnorte-logo.svg" alt="" className="h-9 w-9 rounded-full object-cover" />
              <div>
                <p className="text-base font-black tracking-[0.16em]">NNORTE</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-nnorte-muted">Restoran Multi Cabang</p>
              </div>
            </div>
            <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-nnorte-muted">
              {branch?.tagline || 'Cita rasa yang konsisten di setiap cabang. Pesan langsung dari meja, tanpa antre.'}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-nnorte-subtle">
              <ShieldCheck size={11} aria-hidden="true" /> Harga dan total dihitung oleh server.
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.18em] text-nnorte-subtle">Jelajahi</h3>
            <ul className="mt-2.5 space-y-1.5 text-[11px]">
              {categories.slice(0, 5).map((c) => (
                <li key={c}>
                  <button type="button" onClick={() => selectCategory(c)} className="cursor-pointer text-nnorte-muted transition-colors hover:text-nnorte-text">
                    {c === 'all' ? 'Semua Menu' : c}
                  </button>
                </li>
              ))}
              {track && (
                <li>
                  <button type="button" onClick={() => openOrder('track')} className="inline-flex cursor-pointer items-center gap-1 text-nnorte-red transition-colors hover:text-nnorte-red-soft">
                    Lacak Pesanan <ArrowRight size={10} aria-hidden="true" />
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.18em] text-nnorte-subtle">Hubungi Cabang</h3>
            {branch ? (
              <ul className="mt-2.5 space-y-2 text-[11px] text-nnorte-muted">
                <li className="flex gap-2">
                  <MapPin size={12} className="mt-0.5 shrink-0 text-nnorte-red" aria-hidden="true" />
                  <span>{[branch.address, branch.city].filter(Boolean).join(', ') || 'Alamat cabang belum diatur.'}</span>
                </li>
                {branch.phone && (
                  <li>
                    <a href={`tel:${branch.phone}`} className="flex items-center gap-2 transition-colors hover:text-nnorte-text">
                      <Phone size={12} className="shrink-0 text-nnorte-red" aria-hidden="true" /> {branch.phone}
                    </a>
                  </li>
                )}
                <li className="flex gap-2">
                  <Clock size={12} className="mt-0.5 shrink-0 text-nnorte-red" aria-hidden="true" />
                  <span>{branch.is24Hours ? 'Buka 24 jam' : branch.operatingHours || 'Jam operasional belum diatur.'}</span>
                </li>
              </ul>
            ) : (
              <p className="mt-2.5 text-[11px] text-nnorte-muted">Pilih cabang untuk melihat kontak dan jam operasional.</p>
            )}
            {table && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-nnorte-red/30 bg-nnorte-red/10 px-2.5 py-1 text-[10px] font-bold text-nnorte-red">
                <QrCode size={10} aria-hidden="true" /> Meja {table.tableNumber}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-nnorte-border/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-[9px] text-nnorte-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} {branch?.restaurantName || 'NNORTE'}. Semua hak dilindungi.</p>
            <p>Pembayaran dilakukan di kasir · Tidak ada biaya tersembunyi.</p>
          </div>
        </div>
      </footer>

      <Modal
        isOpen={orderOpen}
        onClose={() => !submitting && setOrderOpen(false)}
        busy={submitting}
        title={orderTab === 'cart' ? 'Keranjang Pesanan' : orderTab === 'checkout' ? 'Checkout' : 'Lacak Pesanan'}
        subtitle={branch ? `${branch.name}${table ? ` · Meja ${table.tableNumber}` : ''}` : ''}
        maxWidth={orderTab === 'track' ? '2xl' : 'md'}
        footer={
          orderTab === 'cart' ? (
            <Button className="w-full sm:w-auto" disabled={cart.length === 0} onClick={() => setOrderTab('checkout')} icon={<ArrowRight size={14} />}>
              Lanjut ke Checkout
            </Button>
          ) : orderTab === 'checkout' ? (
            <Button className="w-full sm:w-auto" onClick={() => void submit()} loading={submitting} loadingText="Mengirim pesanan…" disabled={cart.length === 0}>
              Kirim Pesanan · {formatRupiah(totalEstimate)}
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => { setOrderTab('cart'); closeAndBrowse(); }}>
              Tambah Pesanan Lain
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <div role="tablist" aria-label="Tahapan pesanan" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-nnorte-border bg-nnorte-surface-2 p-1.5">
            {ORDER_TABS.map((item) => {
              const Icon = item.icon;
              const active = orderTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setOrderTab(item.id)}
                  className={`nn-press flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[10px] font-bold ${
                    active ? 'bg-nnorte-red text-nnorte-on-brand shadow-sm' : 'text-nnorte-muted hover:text-nnorte-text'
                  }`}
                >
                  <Icon size={13} aria-hidden="true" /> {item.label}
                </button>
              );
            })}
          </div>

          {orderTab === 'cart' && (
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-nnorte-surface-2 text-nnorte-muted">
                  <ShoppingBag size={24} aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold">Keranjang masih kosong</p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-nnorte-muted">Tambahkan menu favorit Anda untuk mulai memesan.</p>
                <Button className="mt-4" variant="secondary" onClick={closeAndBrowse}>Pilih Menu</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="space-y-2">
                  {cart.map((l) => {
                    const addons = l.menu.addons.filter((a) => l.addonIds.includes(a.id)).map((a) => `+${a.name}`);
                    return (
                      <li key={l.key} className="flex gap-2.5 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-2.5">
                        {l.menu.image ? (
                          <img src={l.menu.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-nnorte-sidebar text-nnorte-muted"><Utensils size={18} aria-hidden="true" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-bold">{l.menu.name}</p>
                              <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-nnorte-muted">
                                {[l.variantChoice, ...addons, l.notes].filter(Boolean).join(' · ') || l.menu.category}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Hapus ${l.menu.name} dari keranjang`}
                              onClick={() => changeQty(l.key, -l.quantity)}
                              className="nn-press flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-nnorte-muted hover:bg-nnorte-error/10 hover:text-nnorte-error"
                            >
                              <Trash2 size={12} aria-hidden="true" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-nnorte-red">{formatRupiah(lineUnit(l) * l.quantity)}</span>
                            <div className="flex items-center gap-1">
                              <button type="button" aria-label={`Kurangi ${l.menu.name}`} onClick={() => changeQty(l.key, -1)} className="nn-press flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface text-nnorte-text"><Minus size={11} aria-hidden="true" /></button>
                              <span className="w-5 text-center text-[11px] font-bold">{l.quantity}</span>
                              <button type="button" aria-label={`Tambah ${l.menu.name}`} onClick={() => changeQty(l.key, 1)} className="nn-press flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface text-nnorte-text"><Plus size={11} aria-hidden="true" /></button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <dl className="space-y-1.5 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3 text-[11px]">
                  <div className="flex justify-between gap-2"><dt className="text-nnorte-muted">Subtotal</dt><dd>{formatRupiah(subtotal)}</dd></div>
                  {tax > 0 && <div className="flex justify-between gap-2"><dt className="text-nnorte-muted">Pajak ({branch?.taxPercentage}%)</dt><dd>{formatRupiah(tax)}</dd></div>}
                  {service > 0 && <div className="flex justify-between gap-2"><dt className="text-nnorte-muted">Layanan ({branch?.servicePercentage}%)</dt><dd>{formatRupiah(service)}</dd></div>}
                  <div className="flex justify-between gap-2 border-t border-nnorte-border pt-1.5 text-xs font-black text-nnorte-red"><dt>Estimasi Total</dt><dd>{formatRupiah(totalEstimate)}</dd></div>
                </dl>
                <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-nnorte-muted">
                  <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" /> Total akhir dihitung ulang oleh server saat pesanan dikirim.
                </p>
              </div>
            )
          )}

          {orderTab === 'checkout' && (
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-nnorte-surface-2 text-nnorte-muted">
                  <ShoppingBag size={24} aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold">Belum ada item untuk di-checkout</p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-nnorte-muted">Kembali ke menu dan tambahkan hidangan terlebih dahulu.</p>
                <Button className="mt-4" variant="secondary" onClick={closeAndBrowse}>Pilih Menu</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nnorte-red/10 text-nnorte-red">
                    <QrCode size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-nnorte-muted">Pesanan untuk</p>
                    <p className="truncate text-[11px] font-bold">{orderType === 'dine_in' && table ? `Meja ${table.tableNumber}` : 'Bawa pulang'} · {branch?.name}</p>
                  </div>
                </div>

                <Field label="Nama Pemesan" required>
                  <input type="text" maxLength={80} className={inputClass()} value={name} onChange={(e) => { setName(e.target.value); setSubmitError(null); }} autoComplete="name" placeholder="Nama Anda" />
                </Field>
                <Field label="No. Telepon (opsional)" hint="Dipakai staf jika perlu menghubungi Anda.">
                  <input type="tel" maxLength={30} className={inputClass()} value={phone} onChange={(e) => { setPhone(e.target.value); setSubmitError(null); }} autoComplete="tel" placeholder="08xxxxxxxxxx" />
                </Field>

                <fieldset>
                  <legend className="mb-1.5 text-[11px] font-semibold">Tipe Pemesanan</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!table} onClick={() => { setOrderType('dine_in'); setSubmitError(null); }} className={`nn-press min-h-10 cursor-pointer rounded-xl border text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${orderType === 'dine_in' ? 'border-nnorte-red bg-nnorte-red text-nnorte-on-brand' : 'border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted'}`}>Makan di Tempat</button>
                    <button type="button" disabled={!canTakeaway} onClick={() => { setOrderType('takeaway'); setSubmitError(null); }} className={`nn-press min-h-10 cursor-pointer rounded-xl border text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${orderType === 'takeaway' ? 'border-nnorte-red bg-nnorte-red text-nnorte-on-brand' : 'border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted'}`}>Bawa Pulang</button>
                  </div>
                  {!table && <p className="mt-1.5 text-[10px] text-nnorte-muted">Untuk makan di tempat, pindai QR di meja Anda.</p>}
                  {!canTakeaway && <p className="mt-1.5 text-[10px] text-nnorte-muted">Pesanan bawa pulang online belum dibuka cabang ini.</p>}
                </fieldset>

                <div className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3">
                  <p className="flex items-center gap-2 text-[11px] font-bold"><Banknote size={14} className="text-nnorte-red" aria-hidden="true" /> Pembayaran di kasir</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-nnorte-muted">Pembayaran dilakukan di kasir setelah pesanan dikirim. Tanyakan metode yang tersedia (tunai, kartu, atau QRIS) kepada kasir.</p>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-nnorte-border pt-2">
                    <span className="text-[10px] text-nnorte-muted">Estimasi total</span>
                    <span className="text-sm font-black text-nnorte-red">{formatRupiah(totalEstimate)}</span>
                  </div>
                </div>

                {submitError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-[10px] text-nnorte-error">{submitError}</p>}

                <div className="rounded-xl border border-dashed border-nnorte-border p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold"><Info size={11} aria-hidden="true" /> Catatan per menu</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-nnorte-muted">Ingin tanpa saus atau sambal terpisah? Tambahkan catatan saat memilih menu lewat tombol <span className="font-semibold text-nnorte-text">Atur</span>.</p>
                </div>
              </div>
            )
          )}

          {orderTab === 'track' && (
            !track ? (
              <EmptyState
                icon={ReceiptText}
                title="Belum ada pesanan aktif"
                description="Pesan menu terlebih dahulu untuk melihat status di sini."
                action={<Button variant="secondary" onClick={closeAndBrowse}>Pilih Menu</Button>}
              />
            ) : !status ? (
              statusError ? (
                <div className="space-y-3">
                  <ErrorState message={statusError} />
                  <Button variant="secondary" className="w-full" icon={<RefreshCw size={14} />} onClick={() => void refreshStatus()}>Coba Lagi</Button>
                </div>
              ) : (
                <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>
              )
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-nnorte-muted">Nomor Pesanan</p>
                      <p className="truncate font-mono text-sm font-black">{status.orderNumber}</p>
                    </div>
                    {sb && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${sb.bg} ${sb.text} ${sb.border}`}>{sb.label}</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-nnorte-border pt-2 text-[10px] text-nnorte-muted">
                    <span>Pembayaran: <span className="font-semibold text-nnorte-text">{pb?.label ?? status.paymentStatus}</span></span>
                    <span className="shrink-0 text-xs font-black text-nnorte-red">{formatRupiah(status.total)}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-bg">
                  <React.Suspense fallback={<Skeleton className="h-[360px] w-full" />}>
                    <OrderFactory3D
                      height="clamp(300px, 48vh, 460px)"
                      status={toSceneStatus(status.status, status.paymentStatus)}
                      orderNumber={status.orderNumber}
                      branchName={branch?.name}
                      tableLabel={table ? `MEJA ${table.tableNumber}` : undefined}
                      items={trackItems}
                      orderRating={ratings?.orderRating ?? null}
                      orderReview={ratings?.orderReview ?? null}
                      onRate={ratingsReady && canRateOrder ? handleRate : undefined}
                    />
                  </React.Suspense>
                </div>
                <p className="px-1 text-[9px] leading-relaxed text-nnorte-muted">
                  Seret area 3D untuk memutar, cubit untuk zoom, dan ketuk kartu untuk detail item.
                </p>

                {status.status === 'completed' && ratingsLoading && (
                  <p className="px-1 text-[9px] text-nnorte-muted">Memuat rating pesanan…</p>
                )}
                {status.status === 'completed' && ratingsError && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-nnorte-warning/30 bg-nnorte-warning/10 p-3 text-[10px] leading-relaxed text-nnorte-text">
                    <span className="min-w-0">{ratingsError}</span>
                    <button
                      type="button"
                      onClick={() => void loadRatings()}
                      className="nn-press shrink-0 cursor-pointer rounded-lg border border-nnorte-border bg-nnorte-surface px-2 py-1 text-[9px] font-semibold text-nnorte-text"
                    >
                      Coba lagi
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-nnorte-border bg-nnorte-surface p-3">
                  <h3 className="mb-2 text-[11px] font-bold">Rincian Pesanan</h3>
                  <ul className="space-y-1.5 text-[10px]">
                    {status.items.map((it, i) => (
                      <li key={it.orderItemId ?? i} className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate">{it.quantity}× {it.name}</span>
                          {(it.variantChoice || it.notes) && (
                            <span className="mt-0.5 block truncate text-[9px] text-nnorte-muted">
                              {[it.variantChoice, it.notes].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-nnorte-muted">{formatRupiah(it.unitPrice * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {status.paymentStatus === 'unpaid' && status.status !== 'cancelled' && (
                  <div className="flex gap-2 rounded-xl border border-nnorte-warning/30 bg-nnorte-warning/10 p-3 text-[10px] leading-relaxed text-nnorte-text">
                    <Banknote size={14} className="mt-0.5 shrink-0 text-nnorte-warning" aria-hidden="true" />
                    <p>Silakan lakukan pembayaran di kasir. Tunjukkan nomor pesanan <span className="font-mono font-bold">{status.orderNumber}</span>.</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[9px] text-nnorte-muted">
                    <RefreshCw size={10} aria-hidden="true" />
                    {status.status === 'completed' || status.status === 'cancelled' ? 'Status akhir pesanan.' : 'Diperbarui otomatis tiap 10 detik.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void refreshStatus();
                      if (status.status === 'completed') void loadRatings();
                    }}
                    className="nn-press inline-flex cursor-pointer items-center gap-1 rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-2 py-1 text-[9px] font-semibold text-nnorte-muted hover:text-nnorte-text"
                  >
                    <RefreshCw size={10} aria-hidden="true" /> Muat ulang
                  </button>
                </div>
                {statusError && <p className="text-[10px] text-nnorte-error">{statusError}</p>}
              </div>
            )
          )}
        </div>
      </Modal>

      <Modal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Pesanan Terkirim"
        subtitle="Tim dapur langsung menerima pesanan Anda."
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nnorte-success/15 text-nnorte-success">
            <CircleCheck size={34} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-nnorte-muted">Nomor pesanan</p>
            <p className="font-mono text-xl font-black">{lastOrder?.orderNumber ?? '—'}</p>
            {lastOrder && <p className="mt-1 text-sm font-black text-nnorte-red">{formatRupiah(lastOrder.total)}</p>}
          </div>
          <div className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3 text-left text-[10px] leading-relaxed text-nnorte-muted">
            <p className="flex items-center gap-2 text-[11px] font-bold text-nnorte-text"><Banknote size={14} className="text-nnorte-red" aria-hidden="true" /> Pembayaran di kasir</p>
            <p className="mt-1">Tunjukkan nomor pesanan ini ke kasir untuk menyelesaikan pembayaran.</p>
          </div>
          <div className="grid gap-2">
            <Button onClick={() => { setSuccessOpen(false); setOrderTab('track'); setOrderOpen(true); }} icon={<ReceiptText size={14} />}>Lihat Status Pesanan</Button>
            <Button variant="secondary" onClick={() => { setSuccessOpen(false); setOrderTab('cart'); window.setTimeout(scrollToMenu, 180); }}>Pesan Lagi</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={tableInfoOpen}
        onClose={() => setTableInfoOpen(false)}
        title="Informasi Meja"
        subtitle="Nomor meja berasal dari QR yang Anda pindai."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-nnorte-red/30 bg-nnorte-red/10 p-5 text-center">
            <QrCode size={28} className="mx-auto text-nnorte-red" aria-hidden="true" />
            <p className="mt-2 text-3xl font-black">{table?.tableNumber}</p>
            <p className="mt-0.5 text-[11px] text-nnorte-muted">{branch?.name}</p>
          </div>
          <p className="text-[11px] leading-relaxed text-nnorte-muted">Nomor meja bersifat tetap dan tidak dapat diubah dari halaman ini. Jika Anda berpindah meja, pindai QR di meja baru agar pesanan diantar ke tempat yang benar.</p>
          <Button className="w-full" onClick={() => setTableInfoOpen(false)}>Mengerti</Button>
        </div>
      </Modal>

      <Modal
        isOpen={authOpen}
        onClose={() => !authBusy && setAuthOpen(false)}
        busy={authBusy}
        title={authMode === 'register' ? 'Daftar akun pelanggan' : authMode === 'forgot' ? 'Reset password' : 'Masuk ke NNORTE'}
        subtitle={authMode === 'forgot' ? 'Kami kirim tautan reset ke email Anda.' : authMode === 'register' ? 'Buat akun agar pemesanan berikutnya lebih cepat.' : 'Masuk untuk mempercepat pemesanan berikutnya.'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          {authMode !== 'forgot' && (
            <div role="tablist" aria-label="Mode autentikasi" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                onClick={() => switchAuthMode('login')}
                className={`nn-press min-h-10 cursor-pointer rounded-lg text-[11px] font-semibold ${authMode === 'login' ? 'bg-nnorte-red text-nnorte-on-brand' : 'border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:text-nnorte-text'}`}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'register'}
                onClick={() => switchAuthMode('register')}
                className={`nn-press min-h-10 cursor-pointer rounded-lg text-[11px] font-semibold ${authMode === 'register' ? 'bg-nnorte-red text-nnorte-on-brand' : 'border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:text-nnorte-text'}`}
              >
                Daftar
              </button>
            </div>
          )}

          {authError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-[11px] text-nnorte-error">{authError}</p>}
          {authNotice && <p role="status" className="rounded-lg border border-nnorte-blue/40 bg-nnorte-blue/10 p-2.5 text-[11px] text-nnorte-text">{authNotice}</p>}

          <form onSubmit={(e) => { e.preventDefault(); void submitAuth(); }} className="space-y-3" noValidate>
            {authMode === 'register' && (
              <Field label="Nama lengkap" required>
                <input type="text" maxLength={80} className={inputClass()} value={authName} onChange={(e) => setAuthName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email" required>
              <input type="email" className={inputClass()} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} autoComplete="email" />
            </Field>
            {authMode !== 'forgot' && (
              <div className="space-y-1.5">
                <label htmlFor="portal-auth-password" className="block text-[11px] font-semibold text-nnorte-text">
                  Password{authMode === 'register' ? ' (min. 8 karakter)' : ''}
                  <span className="ml-0.5 text-nnorte-red" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <input
                    id="portal-auth-password"
                    type={authShowPassword ? 'text' : 'password'}
                    className={`${inputClass()} pr-11`}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setAuthShowPassword((visible) => !visible)}
                    aria-label={authShowPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={authShowPassword}
                    className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-nnorte-muted hover:text-nnorte-text"
                  >
                    {authShowPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}

            {authMode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => switchAuthMode('forgot')} className="cursor-pointer text-[10px] font-semibold text-nnorte-muted hover:text-nnorte-text">Lupa password?</button>
              </div>
            )}

            <Button type="submit" className="w-full" loading={authBusy} loadingText="Memproses…">
              {authMode === 'register' ? 'Daftar' : authMode === 'forgot' ? 'Kirim tautan reset' : 'Masuk'}
            </Button>
          </form>

          {authMode === 'forgot' ? (
            <button type="button" onClick={() => switchAuthMode('login')} className="mx-auto block cursor-pointer text-[11px] font-semibold text-nnorte-muted hover:text-nnorte-text">Kembali ke halaman masuk</button>
          ) : (
            <>
              <div className="flex items-center gap-3 text-[9px] font-semibold uppercase tracking-wider text-nnorte-subtle">
                <span className="h-px flex-1 bg-nnorte-border" aria-hidden="true" />
                atau
                <span className="h-px flex-1 bg-nnorte-border" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => void googleAuth()}
                disabled={authBusy}
                className="nn-press flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-nnorte-border bg-nnorte-surface-2 text-[11px] font-semibold text-nnorte-text hover:border-nnorte-blue/40 disabled:opacity-60"
              >
                <GoogleMark /> Lanjut dengan Google
              </button>
              <p className="text-center text-[10px] leading-relaxed text-nnorte-muted">
                {authMode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                <button type="button" onClick={() => switchAuthMode(authMode === 'login' ? 'register' : 'login')} className="cursor-pointer font-semibold text-nnorte-red hover:underline">
                  {authMode === 'login' ? 'Daftar sekarang' : 'Masuk'}
                </button>
              </p>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={optionFor !== null}
        onClose={() => setOptionFor(null)}
        title={optionFor?.name ?? ''}
        subtitle="Sesuaikan pesanan Anda"
        maxWidth="md"
        footer={optionFor ? <Button className="w-full sm:w-auto" onClick={confirmAddOption}>Tambah ke Keranjang · {formatRupiah(optUnit)}</Button> : undefined}
      >
        {optionFor && (
          <div className="flex flex-col gap-4">
            {optionFor.image && <img src={optionFor.image} alt="" className="h-32 w-full rounded-xl object-cover" />}
            {optionFor.variants.map((v) => (
              <Field key={v.name} label={v.name}>
                <select className={inputClass()} value={opt.variants[v.name] ?? ''} onChange={(e) => setOpt((o) => ({ ...o, variants: { ...o.variants, [v.name]: e.target.value } }))}>
                  {v.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            ))}
            {optionFor.addons.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="mb-1 text-[11px] font-semibold">Tambahan</legend>
                {optionFor.addons.map((a) => (
                  <label key={a.id} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-nnorte-border px-3 text-[11px]">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--c-red)]"
                        checked={opt.addonIds.includes(a.id)}
                        onChange={(e) => setOpt((o) => ({ ...o, addonIds: e.target.checked ? [...o.addonIds, a.id] : o.addonIds.filter((x) => x !== a.id) }))}
                      />
                      {a.name}
                    </span>
                    <span className="text-nnorte-muted">+{formatRupiah(a.price)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <Field label="Catatan (opsional)" hint="Contoh: tanpa bawang, sambal terpisah.">
              <input type="text" maxLength={200} className={inputClass()} value={opt.notes} onChange={(e) => setOpt((o) => ({ ...o, notes: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
};
