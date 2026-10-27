
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Clock,
  Edit3,
  ImagePlus,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MasterMenuItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState } from '../../components/ui/States';
import AiMenuAssistant, {
  type AiMenuResult,
} from '../../components/super-admin/AiMenuAssistant';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  removeMenuImageByPath,
  storagePathFromUrl,
  uploadMenuImage,
  validateImageFile,
} from '../../lib/menuImages';
import {
  toRecipeIngredients,
  validateRecipeRows,
  type RecipeDraft,
} from '../../lib/recipes';

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

interface FormState {
  name: string;
  sku: string;
  category: string;
  description: string;
  ingredients: RecipeDraft[];
  allergens: string;
  basePrice: string;
  prepTime: string;
  isPopular: boolean;
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  category: '',
  description: '',
  ingredients: [],
  allergens: '',
  basePrice: '',
  prepTime: '15',
  isPopular: false,
};

/**
 * Membuat kode singkat kategori untuk SKU.
 *
 * Contoh:
 * Makanan Utama -> MKN
 * Minuman       -> MIN
 * Dessert       -> DES
 * Kopi          -> KOP
 */
const getCategoryCode = (category: string): string => {
  const normalized = category.trim().toLowerCase();

  const knownCodes: Record<string, string> = {
    'makanan utama': 'MKN',
    makanan: 'MKN',
    'main course': 'MKN',
    minuman: 'MIN',
    beverage: 'BEV',
    beverages: 'BEV',
    dessert: 'DES',
    'add on': 'ADD',
    addon: 'ADD',
    topping: 'TOP',
    appetizer: 'APP',
    'makanan pembuka': 'APP',
    kopi: 'KOP',
    coffee: 'KOP',
    snack: 'SNK',
    camilan: 'SNK',
    sarapan: 'SRP',
    breakfast: 'SRP',
    paket: 'PKT',
  };

  if (knownCodes[normalized]) {
    return knownCodes[normalized];
  }

  const words = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'MNU';
  }

  const code =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : words[0].slice(0, 3);

  return code.toUpperCase().slice(0, 3).padEnd(3, 'X');
};

/**
 * Menghasilkan SKU yang belum dipakai.
 * Format: NN-KODE-001, NN-KODE-002, dan seterusnya.
 *
 * SKU menu yang sudah tersimpan tidak diubah oleh fungsi ini.
 */
const generateSku = (
  category: string,
  menus: MasterMenuItem[],
  editingId?: string | null,
): string => {
  const code = getCategoryCode(category);
  const prefix = `NN-${code}-`;

  const usedSkus = new Set(
    menus
      .filter((menu) => menu.id !== editingId)
      .map((menu) => menu.sku.trim().toUpperCase()),
  );

  let highestNumber = 0;

  for (const menu of menus) {
    if (menu.id === editingId) continue;

    const sku = menu.sku.trim().toUpperCase();

    if (!sku.startsWith(prefix)) continue;

    const suffix = sku.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;

    highestNumber = Math.max(highestNumber, Number(suffix));
  }

  let nextNumber = highestNumber + 1;
  let candidate = '';

  do {
    candidate = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    nextNumber += 1;
  } while (usedSkus.has(candidate));

  return candidate;
};

export const MasterKatalogMenu: React.FC = () => {
  const {
    masterMenus,
    menuCategories,
    branches,
    branchMenus,
    currentUser,
    restaurantId,
    addMenuCategory,
    deleteMenuCategory,
    addMasterMenu,
    updateMasterMenu,
    setMasterMenuStatus,
    deleteMasterMenu,
    addToast,
    dataError,
    dataLoading,
    reloadData,
  } = useApp();

  const canEdit = currentUser?.role === 'owner';
  const isBranchAdmin = currentUser?.role === 'branch_admin';
  const branchId = isBranchAdmin ? currentUser?.branchId : undefined;
  const canCreate = canEdit || isBranchAdmin;
  const canManageCategories = canEdit || isBranchAdmin;
  const branchMenuIds = useMemo(
    () => new Set(branchMenus.filter((entry) => entry.branchId === branchId).map((entry) => entry.menuId)),
    [branchMenus, branchId],
  );

  const [cat, setCat] = useState('Semua');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterMenuItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState | 'image', string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  // File foto yang belum diunggah atau permintaan menghapus foto lama.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeleteBusy, setCategoryDeleteBusy] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const categories = useMemo(() => {
    const byName = new Map<string, string>();

    [...menuCategories, ...masterMenus
      .filter((menu) => !isBranchAdmin || branchMenuIds.has(menu.id))
      .map((menu) => menu.category)].forEach(
      (raw) => {
        const name = raw.trim();
        if (!name) return;

        const key = name.toLowerCase();
        if (!byName.has(key)) byName.set(key, name);
      },
    );

    return Array.from(byName.values()).sort((a, b) =>
      a.localeCompare(b, 'id'),
    );
  }, [menuCategories, masterMenus, isBranchAdmin, branchMenuIds]);

  const filtered = masterMenus.filter((menu) => {
    const term = q.trim().toLowerCase();

    return (
      (cat === 'Semua' ||
        menu.category.trim().toLowerCase() === cat.toLowerCase()) &&
      (!isBranchAdmin || branchMenuIds.has(menu.id)) &&
      (!term ||
        menu.name.toLowerCase().includes(term) ||
        menu.sku.toLowerCase().includes(term))
    );
  });

  // Bebaskan object URL foto sementara ketika pratinjau berubah/unmount.
  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const resetImage = (url = '') => {
    setFile(null);
    setRemoveImage(false);
    setPreview(url);

    if (fileInput.current) {
      fileInput.current.value = '';
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      ingredients: [],
      sku: generateSku('', masterMenus),
    });
    setErrors({});
    setFormError(null);
    setTargets(canEdit
      ? branches.filter((branch) => branch.status === 'active').map((branch) => branch.id)
      : branchId ? [branchId] : []);
    resetImage();
    setOpen(true);
  };

  const openEdit = (menu: MasterMenuItem) => {
    setEditing(menu);
    const usedByOtherBranch = isBranchAdmin && branchMenus.some(
      (entry) => entry.menuId === menu.id && entry.branchId !== branchId,
    );

    setForm({
      name: menu.name,
      sku: usedByOtherBranch ? generateSku(menu.category, masterMenus, menu.id) : menu.sku,
      category:
        categories.find(
          (category) =>
            category.toLowerCase() === menu.category.trim().toLowerCase(),
        ) ?? menu.category.trim(),
      description: menu.description,
      ingredients: (menu.ingredients ?? []).map((ingredient) => ({
        name: ingredient.name,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
      })),
      allergens: (menu.allergens ?? []).join(', '),
      basePrice: String(menu.basePrice),
      prepTime: String(menu.preparationTimeMinutes),
      isPopular: !!menu.isPopular,
    });

    setErrors({});
    setFormError(null);
    resetImage(menu.image || '');
    setOpen(true);
  };

  const close = () => {
    if (!saving) setOpen(false);
  };

  // Ketika kategori berubah, buat SKU baru untuk menu yang sedang ditambahkan.
  // Saat mengedit menu lama, SKU tidak otomatis diubah.
  const handleCategoryChange = (category: string) => {
    setForm((current) => ({
      ...current,
      category,
      ...(editing
        ? {}
        : {
            sku: generateSku(category, masterMenus),
          }),
    }));

    setErrors((current) => ({
      ...current,
      category: undefined,
      sku: undefined,
    }));
  };

  // Draf Asisten Menu AI tetap dapat disunting sebelum disimpan.
  const handleAiApply = (result: AiMenuResult) => {
    setEditing(null);

    setForm({
      ...EMPTY,
      name: result.name,
      sku: generateSku(result.category, masterMenus),
      category: result.category,
      description: result.description,
      ingredients: result.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      allergens: result.allergens,
    });

    setErrors({});
    setFormError(null);
    setTargets(canEdit
      ? branches.filter((branch) => branch.status === 'active').map((branch) => branch.id)
      : branchId ? [branchId] : []);
    resetImage();
    setOpen(true);
  };

  const addRecipeRow = () => {
    setForm((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        { name: '', quantity: '1', unit: '' },
      ],
    }));
  };

  const updateRecipeRow = (
    index: number,
    patch: Partial<RecipeDraft>,
  ) => {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const removeRecipeRow = (index: number) => {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter(
        (_, rowIndex) => rowIndex !== index,
      ),
    }));
  };

  const openAddCategory = () => {
    setCategoryName('');
    setCategoryError(null);
    setCategoryOpen(true);
  };

  const closeCategory = () => {
    if (!categorySaving) setCategoryOpen(false);
  };

  const submitCategory = async (event: React.FormEvent) => {
    event.preventDefault();

    if (categorySaving) return;

    const name = categoryName.trim();

    if (!name) {
      setCategoryError('Nama kategori wajib diisi.');
      return;
    }

    if (name.length > 60) {
      setCategoryError('Nama kategori maksimal 60 karakter.');
      return;
    }

    if (
      categories.some(
        (category) => category.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setCategoryError('Kategori tersebut sudah tersedia.');
      return;
    }

    setCategoryError(null);
    setCategorySaving(true);

    try {
      const result = await addMenuCategory(name);

      if (!result.ok) {
        setCategoryError(result.error);
        return;
      }

      if (open) {
        setForm((current) => ({
          ...current,
          category: name,
          ...(editing
            ? {}
            : {
                sku: generateSku(name, masterMenus),
              }),
        }));
      }

      setCategoryOpen(false);
    } catch (error) {
      setCategoryError(
        error instanceof Error
          ? error.message
          : 'Gagal menambah kategori.',
      );
    } finally {
      setCategorySaving(false);
    }
  };

  const removeCategory = async (category: string) => {
    if (categoryDeleteBusy) return;
    const affectedMenus = isBranchAdmin
      ? masterMenus.filter((menu) => branchMenuIds.has(menu.id) && menu.category.trim().toLowerCase() === category.toLowerCase()).length
      : masterMenus.filter((menu) => menu.category.trim().toLowerCase() === category.toLowerCase()).length;
    const impact = isBranchAdmin && affectedMenus > 0
      ? ` ${affectedMenus} menu di cabang ini akan dipindahkan ke kategori Lainnya.`
      : '';
    if (!window.confirm(`Hapus kategori ${category}?${impact}`)) return;
    setCategoryDeleteBusy(category);
    const result = await deleteMenuCategory(category);
    setCategoryDeleteBusy(null);
    if (!result.ok) {
      addToast('error', result.error);
      return;
    }
    if (cat.toLowerCase() === category.toLowerCase()) setCat('Semua');
  };

  const onPickFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const message = await validateImageFile(selectedFile);

    if (message) {
      setErrors((current) => ({ ...current, image: message }));

      if (fileInput.current) {
        fileInput.current.value = '';
      }

      return;
    }

    setErrors((current) => ({ ...current, image: undefined }));
    setFile(selectedFile);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const validate = () => {
    const nextErrors: typeof errors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Nama menu wajib diisi.';
    }

    if (!form.sku.trim()) {
      nextErrors.sku = 'SKU wajib diisi.';
    } else if (form.sku.trim().length > 40) {
      nextErrors.sku = 'SKU maksimal 40 karakter.';
    }

    if (!form.category.trim()) {
      nextErrors.category = 'Pilih kategori menu.';
    }

    const price = Number(form.basePrice);

    if (
      form.basePrice === '' ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      nextErrors.basePrice = 'Harga tidak valid.';
    }

    const preparationTime = Number(form.prepTime);

    if (
      !Number.isInteger(preparationTime) ||
      preparationTime < 1 ||
      preparationTime > 240
    ) {
      nextErrors.prepTime = 'Isi waktu saji 1–240 menit.';
    }

    const recipeError = validateRecipeRows(form.ingredients);

    if (recipeError) {
      nextErrors.ingredients = recipeError;
    }

    setErrors((current) => ({
      ...current,
      ...nextErrors,
      image: current.image,
    }));

    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    // Pastikan SKU tersedia sebelum validasi.
    const submittedSku = form.sku.trim()
      ? form.sku.trim().toUpperCase()
      : generateSku(form.category, masterMenus, editing?.id);

    const duplicateSku = masterMenus.some(
      (menu) =>
        menu.id !== editing?.id &&
        menu.sku.trim().toUpperCase() === submittedSku,
    );

    if (duplicateSku) {
      setErrors((current) => ({
        ...current,
        sku: 'SKU sudah dipakai menu lain. Gunakan SKU berbeda.',
      }));
      return;
    }

    const normalizedForm = {
      ...form,
      sku: submittedSku,
    };

    setForm(normalizedForm);

    if (!restaurantId) {
      setFormError('Restoran tidak ditemukan.');
      return;
    }

    if (!validate()) return;

    setSaving(true);
    setFormError(null);

    let uploaded: { url: string; path: string } | null = null;

    try {
      if (file) {
        if (isBranchAdmin) throw new Error('Admin Cabang hanya dapat menambahkan menu tanpa foto.');
        uploaded = await uploadMenuImage(restaurantId, file);
      }

      const oldUrl = editing?.image || '';
      const image = uploaded
        ? uploaded.url
        : removeImage
          ? ''
          : oldUrl;

      const payload = {
        name: normalizedForm.name.trim(),
        sku: normalizedForm.sku,
        category: normalizedForm.category.trim(),
        description: normalizedForm.description.trim(),
        ingredients: toRecipeIngredients(normalizedForm.ingredients),
        allergens: parseList(normalizedForm.allergens),
        basePrice: Number(normalizedForm.basePrice),
        image,
        preparationTimeMinutes: Number(normalizedForm.prepTime),
        isPopular: normalizedForm.isPopular,
      };

      const result = editing
        ? await updateMasterMenu(editing.id, payload)
        : await addMasterMenu(
            {
              ...payload,
              status: 'active',
            },
            targets,
          );

      if (!result.ok) {
        if (uploaded) {
          await removeMenuImageByPath(uploaded.path).catch(() => undefined);
        }

        setFormError(result.error);
        return;
      }

      // Hapus foto lama hanya setelah data baru berhasil disimpan.
      if (editing && oldUrl && (uploaded || removeImage)) {
        const oldPath = storagePathFromUrl(oldUrl);

        if (oldPath) {
          await removeMenuImageByPath(oldPath).catch(() => undefined);
        }
      }

      setOpen(false);
      addToast(
        'success',
        editing ? 'Menu berhasil diperbarui.' : 'Menu berhasil ditambahkan.',
      );
    } catch (error) {
      if (uploaded) {
        await removeMenuImageByPath(uploaded.path).catch(() => undefined);
      }

      setFormError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan menu.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (menu: MasterMenuItem) => {
    const used = branchMenus.some(
      (branchMenu) => branchMenu.menuId === menu.id,
    );

    const confirmed = window.confirm(
      isBranchAdmin
        ? `Hapus ${menu.name} dari katalog cabang Anda? Menu di cabang lain tidak akan berubah.`
        : used
        ? `Hapus ${menu.name}? Jika sudah pernah dipakai transaksi, menu akan diarsipkan (bukan dihapus permanen).`
        : `Hapus ${menu.name} dari katalog master?`,
    );

    if (!confirmed) return;

    const result = await deleteMasterMenu(menu.id);

    if (!result.ok) {
      addToast('error', result.error);
      return;
    }

    addToast(
      'success',
      result.archived
        ? `${menu.name} diarsipkan karena sudah pernah dipakai transaksi.`
        : `${menu.name} dihapus.`,
    );

    if (!result.archived && menu.image) {
      const path = storagePathFromUrl(menu.image);

      if (path) {
        await removeMenuImageByPath(path).catch(() => undefined);
      }
    }
  };

  const toggleStatus = async (menu: MasterMenuItem) => {
    const nextStatus =
      menu.status === 'active' ? 'archived' : 'active';

    if (nextStatus === 'archived') {
      const confirmed = window.confirm(
        `Arsipkan ${menu.name}? Menu tidak akan tampil di portal pelanggan sampai diaktifkan kembali.`,
      );

      if (!confirmed) return;
    }

    setStatusSavingId(menu.id);

    try {
      const result = await setMasterMenuStatus(menu.id, nextStatus);

      if (!result.ok) {
        addToast('error', result.error);
      }
    } finally {
      setStatusSavingId(null);
    }
  };

  const shownPreview = removeImage ? '' : preview;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">
            Master Katalog Menu
          </h1>
          <p className="mt-1 text-xs text-nnorte-muted">
            {isBranchAdmin
              ? 'Daftar menu yang tersedia untuk cabang Anda. Ubah harga dan ketersediaan melalui Menu & Harga Cabang.'
              : 'Katalog global yang dapat didistribusikan ke seluruh cabang.'}
          </p>
        </div>

        {canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Sparkles size={16} />}
              onClick={() => setAiOpen(true)}
            >
              Asisten Menu
            </Button>
            <Button icon={<Plus size={16} />} onClick={openAdd}>
              Tambah Menu Baru
            </Button>
          </div>
        )}
      </div>

      {dataError && (
        <ErrorState
          message={dataError}
          onRetry={() => void reloadData()}
        />
      )}

      <div className="grid min-w-0 grid-cols-1 items-center gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-3 lg:grid-cols-[minmax(16rem,28rem)_minmax(0,1fr)]">
        <div className="relative w-full min-w-0">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Cari menu"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cari nama menu atau SKU..."
            className={`${inputClass()} pl-9`}
          />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
          {['Semua', ...categories].map((category) => (
            <div key={category} className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-nnorte-border bg-nnorte-surface-2">
              <button
                type="button"
                onClick={() => setCat(category)}
                aria-pressed={cat === category}
                className={`nn-press min-h-9 cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  cat === category
                    ? 'bg-nnorte-red text-nnorte-on-brand'
                    : 'text-nnorte-muted hover:text-nnorte-text'
                }`}
              >
                {category}
              </button>
            </div>
          ))}

          {canManageCategories && (
            <button
              type="button"
              onClick={openAddCategory}
              className="nn-press inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-nnorte-border bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text"
            >
              <Plus size={12} aria-hidden="true" />
              Tambah Kategori
            </button>
          )}
        </div>
      </div>

      {!dataLoading && filtered.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="Belum ada menu"
            description={
            masterMenus.length === 0 && canCreate
              ? 'Tambahkan menu baru ke katalog master.'
              : 'Tidak ada menu yang cocok dengan filter.'
          }
          action={
            masterMenus.length === 0 && canCreate ? (
              <Button
                icon={<Plus size={14} />}
                onClick={openAdd}
              >
                Tambah Menu Baru
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((menu, index) => (
            <article
              key={menu.id}
              className="nn-rise nn-lift group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-nnorte-border bg-nnorte-surface hover:border-nnorte-blue/40"
              style={{ ['--i' as string]: index }}
            >
              <div className="relative h-40 w-full overflow-hidden bg-nnorte-sidebar">
                {menu.image ? (
                  <img
                    src={menu.image}
                    alt={menu.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-nnorte-muted">
                    <Utensils size={32} aria-hidden="true" />
                  </div>
                )}

                {menu.isPopular && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-nnorte-red px-2 py-0.5 text-[10px] font-bold text-nnorte-on-brand shadow-md">
                    <Star
                      size={10}
                      className="fill-current"
                      aria-hidden="true"
                    />
                    Best Seller
                  </span>
                )}

                <span
                  className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    menu.status === 'active'
                      ? 'border-nnorte-success/30 bg-nnorte-success/15 text-nnorte-success'
                      : 'border-nnorte-border bg-nnorte-surface-2/90 text-nnorte-muted'
                  }`}
                >
                  {menu.status === 'active' ? 'Aktif' : 'Arsip'}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-nnorte-muted">
                  {menu.category || 'Tanpa kategori'}
                </span>

                <h3 className="line-clamp-1 text-sm font-bold text-nnorte-text">
                  {menu.name}
                </h3>

                <p className="line-clamp-2 text-[11px] leading-relaxed text-nnorte-muted">
                  {menu.description}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-nnorte-muted">
                  <span className="font-mono">{menu.sku}</span>

                  <span className="flex items-center gap-1">
                    <Clock size={10} aria-hidden="true" />
                    {menu.preparationTimeMinutes} mnt
                  </span>

                  <span
                    className={`flex items-center gap-1 ${
                      (menu.ingredients?.length ?? 0) === 0
                        ? 'text-nnorte-warning'
                        : ''
                    }`}
                  >
                    <Utensils size={10} aria-hidden="true" />
                    {menu.ingredients?.length ?? 0} bahan
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-2 border-t border-nnorte-border p-3">
                {isBranchAdmin && (
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-nnorte-muted">Cabang Anda</span>
                    <span className="font-bold text-nnorte-blue-soft">{branchMenus.find((entry) => entry.branchId === branchId && entry.menuId === menu.id)?.isAvailable === false ? 'Dinonaktifkan' : branchMenus.find((entry) => entry.branchId === branchId && entry.menuId === menu.id)?.isSoldOutToday ? 'Habis hari ini' : 'Tersedia'}</span>
                  </div>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void toggleStatus(menu)}
                    disabled={!!statusSavingId}
                    className={`nn-press inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      menu.status === 'active'
                        ? 'border-nnorte-warning/30 bg-nnorte-warning/10 text-nnorte-warning hover:border-nnorte-warning/60'
                        : 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success hover:border-nnorte-success/60'
                    }`}
                  >
                    {menu.status === 'active' ? (
                      <Archive size={13} aria-hidden="true" />
                    ) : (
                      <ArchiveRestore size={13} aria-hidden="true" />
                    )}

                    {statusSavingId === menu.id
                      ? 'Menyimpan...'
                      : menu.status === 'active'
                        ? 'Arsipkan'
                        : 'Aktifkan'}
                  </button>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-nnorte-red">
                    {formatRupiah(menu.basePrice)}
                  </span>

                  {(canEdit || isBranchAdmin && branchMenuIds.has(menu.id)) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit ${menu.name}`}
                        onClick={() => openEdit(menu)}
                        className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        aria-label={`Hapus ${menu.name}`}
                        onClick={() => void remove(menu)}
                        className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-red hover:border-nnorte-red"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={close}
        busy={saving}
        title={
          editing
            ? `Edit Menu: ${editing.name}`
            : isBranchAdmin ? 'Tambah Menu Cabang' : 'Tambah Menu Master Baru'
        }
        subtitle={isBranchAdmin ? 'Menu baru hanya ditambahkan ke katalog cabang Anda.' : 'Harga dasar menjadi harga awal cabang; harga cabang yang sudah diubah tidak tertimpa.'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={close}
              disabled={saving}
            >
              Batal
            </Button>

            <Button
              type="submit"
              form="menu-form"
              loading={saving}
              loadingText={
                file ? 'Mengunggah & menyimpan...' : 'Menyimpan...'
              }
            >
              {editing ? 'Simpan Perubahan' : 'Tambah Menu'}
            </Button>
          </>
        }
      >
        <form
          id="menu-form"
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error"
            >
              {formError}
            </p>
          )}

          {canEdit && <Field
            label="Foto Menu"
            error={errors.image}
            hint={`JPEG, PNG, atau WebP, maksimal ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`}
          >
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={(event) => void onPickFile(event)}
              className="block w-full cursor-pointer text-xs text-nnorte-muted file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border file:border-nnorte-border file:bg-nnorte-surface-2 file:px-3 file:text-xs file:font-semibold file:text-nnorte-text"
            />
          </Field>}

          {canEdit ? (shownPreview ? (
            <div className="flex items-center gap-3">
              <img
                src={shownPreview}
                alt="Pratinjau foto menu"
                className="h-24 w-32 rounded-lg border border-nnorte-border object-cover"
              />

              <Button
                variant="secondary"
                size="sm"
                icon={<X size={12} />}
                disabled={saving}
                onClick={() => {
                  if (file) {
                    resetImage(editing?.image || '');
                  } else {
                    setRemoveImage(true);
                  }
                }}
              >
                {file ? 'Batalkan foto baru' : 'Hapus foto'}
              </Button>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-nnorte-border text-xs text-nnorte-muted">
              <ImagePlus size={16} aria-hidden="true" />
              {removeImage
                ? 'Foto akan dihapus saat disimpan'
                : 'Belum ada foto'}
            </div>
          )) : null}

          <Field
            label="Nama Menu"
            required
            error={errors.name}
          >
            <input
              type="text"
              className={inputClass(!!errors.name)}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              maxLength={100}
            />
          </Field>

          <Field
            label="SKU"
            required
            error={errors.sku}
            hint="Dibuat otomatis berdasarkan kategori. Kamu masih bisa mengubahnya secara manual."
          >
            <div className="flex gap-2">
              <input
                type="text"
                className={`${inputClass(!!errors.sku)} min-w-0 font-mono uppercase`}
                value={form.sku}
                onChange={(event) => {
                  set('sku', event.target.value.toUpperCase());
                  setErrors((current) => ({
                    ...current,
                    sku: undefined,
                  }));
                }}
                maxLength={40}
                autoCapitalize="characters"
              />

              {!editing && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    set(
                      'sku',
                      generateSku(form.category, masterMenus),
                    );
                    setErrors((current) => ({
                      ...current,
                      sku: undefined,
                    }));
                  }}
                >
                  Buat ulang
                </Button>
              )}
            </div>
          </Field>

          
          
         



          <Field
            label="Kategori"
            required
            error={errors.category}
            hint={
              categories.length === 0
                ? 'Belum ada kategori. Tambahkan kategori baru.'
                : 'Pilih kategori untuk membuat SKU otomatis.'
            }
          >
            <select
              className={`${inputClass(!!errors.category)} theme-input`}
              value={form.category}
              onChange={(event) =>
                handleCategoryChange(event.target.value)
              }
              style={{
                backgroundColor: 'var(--c-input)',
                color: 'var(--c-text)',
                borderColor: 'var(--c-border)',
                colorScheme: 'dark',
              }}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>



          {canEdit && <button
            type="button"
            onClick={openAddCategory}
            className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg border border-dashed border-nnorte-border px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text"
          >
            <Plus size={12} aria-hidden="true" />
            Tambah kategori baru
          </button>}

          <Field
            label="Harga Dasar (Rp)"
            required
            error={errors.basePrice}
          >
            <input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              className={inputClass(!!errors.basePrice)}
              value={form.basePrice}
              onChange={(event) =>
                set('basePrice', event.target.value)
              }
            />
          </Field>

          <Field
            label="Waktu Saji (menit)"
            error={errors.prepTime}
          >
            <input
              type="number"
              min={1}
              max={240}
              className={inputClass(!!errors.prepTime)}
              value={form.prepTime}
              onChange={(event) =>
                set('prepTime', event.target.value)
              }
            />
          </Field>

          <Field label="Deskripsi">
            <textarea
              rows={3}
              className={inputClass()}
              value={form.description}
              onChange={(event) =>
                set('description', event.target.value)
              }
              maxLength={500}
            />
          </Field>

          {canCreate && <fieldset className="space-y-2 rounded-xl border border-nnorte-border p-3">
            <legend className="px-1 text-xs font-semibold text-nnorte-text">
              Bahan per Porsi
            </legend>

            {canEdit && <p className="text-[11px] leading-relaxed text-nnorte-muted">
              Stok bahan di cabang berkurang sesuai takaran ini setiap
              satu porsi terjual. Nama dan satuan harus sama dengan
              stok bahan di cabang.
            </p>}

            {form.ingredients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-nnorte-border p-3 text-center text-[11px] text-nnorte-muted">
                Belum ada bahan. Menu tanpa resep tidak akan memotong
                stok.
              </p>
            ) : (
              <div className="space-y-2">
                {form.ingredients.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_auto] items-center gap-1.5"
                  >
                    <input
                      type="text"
                      aria-label={`Nama bahan ${index + 1}`}
                      placeholder="Nama bahan"
                      className={inputClass()}
                      value={row.name}
                      onChange={(event) =>
                        updateRecipeRow(index, {
                          name: event.target.value,
                        })
                      }
                      maxLength={100}
                    />

                    <input
                      type="number"
                      aria-label={`Jumlah bahan ${index + 1}`}
                      placeholder="Qty"
                      min={0.001}
                      step={0.001}
                      className={inputClass()}
                      value={row.quantity}
                      onChange={(event) =>
                        updateRecipeRow(index, {
                          quantity: event.target.value,
                        })
                      }
                    />

                    <input
                      type="text"
                      aria-label={`Satuan bahan ${index + 1}`}
                      placeholder="Satuan"
                      className={inputClass()}
                      value={row.unit}
                      onChange={(event) =>
                        updateRecipeRow(index, {
                          unit: event.target.value,
                        })
                      }
                      maxLength={30}
                    />

                    <button
                      type="button"
                      aria-label={`Hapus bahan ${index + 1}`}
                      onClick={() => removeRecipeRow(index)}
                      className="nn-press inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted transition-colors hover:border-nnorte-red/50 hover:text-nnorte-red"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.ingredients && (
              <p role="alert" className="text-[11px] text-nnorte-error">
                {errors.ingredients}
              </p>
            )}

            {canEdit && <button
              type="button"
              onClick={addRecipeRow}
              className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg border border-dashed border-nnorte-border px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text"
            >
              <Plus size={12} aria-hidden="true" />
              Tambah bahan
            </button>}
          </fieldset>}

          {canEdit && <Field label="Alergen">
            <input
              type="text"
              className={inputClass()}
              value={form.allergens}
              onChange={(event) =>
                set('allergens', event.target.value)
              }
              placeholder="Contoh: susu, kacang, gluten"
            />
          </Field>}

          {canEdit && <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-nnorte-text">
            <input
              type="checkbox"
              checked={form.isPopular}
              onChange={(event) =>
                set('isPopular', event.target.checked)
              }
              className="h-5 w-5 accent-[var(--c-red)]"
            />
            Tandai sebagai menu populer (Best Seller)
          </label>}

          {!editing && canCreate && (
            <fieldset className="space-y-2 rounded-xl border border-nnorte-border p-3">
              <legend className="px-1 text-xs font-semibold text-nnorte-text">
                {isBranchAdmin ? 'Cabang' : 'Distribusi ke Cabang'}
              </legend>

              {isBranchAdmin ? (
                <p className="text-xs text-nnorte-muted">Menu akan ditambahkan hanya ke {branches.find((branch) => branch.id === branchId)?.name ?? 'cabang Anda'}.</p>
              ) : branches.length === 0 ? (
                <p className="text-xs text-nnorte-muted">
                  Belum ada cabang. Menu tetap tersimpan di katalog.
                </p>
              ) : (
                branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-nnorte-text"
                  >
                    <input
                      type="checkbox"
                      checked={targets.includes(branch.id)}
                      onChange={() =>
                        setTargets((current) =>
                          current.includes(branch.id)
                            ? current.filter((id) => id !== branch.id)
                            : [...current, branch.id],
                        )
                      }
                      className="h-5 w-5 accent-[var(--c-red)]"
                    />
                    {branch.name}
                  </label>
                ))
              )}
            </fieldset>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={categoryOpen}
        onClose={closeCategory}
        busy={categorySaving}
        title="Kelola Kategori"
        subtitle="Kategori baru langsung tersedia di filter dan form menu."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeCategory}
              disabled={categorySaving}
            >
              Batal
            </Button>

            <Button type="submit" form="category-form" loading={categorySaving} loadingText="Menyimpan...">
              Tambah Kategori
            </Button>
          </>
        }
      >
        <form
          id="category-form"
          onSubmit={submitCategory}
          noValidate
          className="space-y-3"
        >
          {categoryError && (
            <p
              role="alert"
              className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error"
            >
              {categoryError}
            </p>
          )}

          <Field label="Nama Kategori" required error={categoryError || undefined}>
            <input
              type="text"
              className={inputClass(!!categoryError)}
              value={categoryName}
              onChange={(event) => {
                setCategoryName(event.target.value);
                if (categoryError) setCategoryError(null);
              }}
              maxLength={60}
              autoFocus
              placeholder="Contoh: Dessert"
            />
          </Field>

          <p className="text-[11px] leading-relaxed text-nnorte-muted">
            {isBranchAdmin ? 'Kategori yang dihapus akan memindahkan menu cabang ini ke kategori Lainnya; cabang lain tidak berubah.' : 'Kategori yang digunakan menu tidak dapat dihapus.'}
          </p>
          <div className="space-y-1 border-t border-nnorte-border pt-3">
            <p className="text-xs font-semibold text-nnorte-text">Kategori tersedia</p>
            {categories.length === 0 ? <p className="text-[11px] text-nnorte-muted">Belum ada kategori.</p> : categories.map((category) => {
              const usedByMenu = isBranchAdmin
                ? masterMenus.some((menu) => branchMenuIds.has(menu.id) && menu.category.trim().toLowerCase() === category.toLowerCase())
                : masterMenus.some((menu) => menu.category.trim().toLowerCase() === category.toLowerCase());
              return <div key={category} className="flex items-center justify-between gap-2 rounded-lg bg-nnorte-surface-2 px-3 py-2">
                <span className="truncate text-xs text-nnorte-text">{category}</span>
                <button type="button" disabled={!isBranchAdmin && usedByMenu || categoryDeleteBusy === category} title={usedByMenu && !isBranchAdmin ? 'Masih digunakan oleh menu' : 'Hapus kategori'} onClick={() => void removeCategory(category)} className="nn-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nnorte-border text-nnorte-muted hover:border-nnorte-red/50 hover:text-nnorte-red disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Hapus kategori ${category}`}>
                  {categoryDeleteBusy === category ? <span className="text-[10px]">…</span> : <Trash2 size={13} />}
                </button>
              </div>;
            })}
          </div>
        </form>
      </Modal>

      <AiMenuAssistant
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={handleAiApply}
        categories={categories}
      />
    </div>
  );
};
