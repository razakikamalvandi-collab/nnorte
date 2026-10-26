import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import QRCode from "qrcode";
import { useApp } from "../../context/AppContext";
import { TableInfo } from "../../types";
import { Plus, Download, Printer, Pencil, Trash2, QrCode, ExternalLink } from "lucide-react";
import { Modal } from "../../components/common/Modal";
import { QRCodeImage } from "../../components/common/QRCodeImage";

const getCustomerMenuUrl = (
  qrCodeToken: string,
  branchId: string,
  branchName: string,
  tableNumber: string
) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("qr", qrCodeToken);
  url.searchParams.set("branch", branchId);
  url.searchParams.set("branchName", branchName);
  url.searchParams.set("table", tableNumber);
  return url.toString();
};

const createTableQrToken = () => {
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getDisplayTableCode = (branchCode: string, tableNumber: string) => {
  const tableLabel = tableNumber.trim().replace(/^(meja|table)\s*/i, "");
  const normalizedLabel = tableLabel.replace(/\s+/g, "-").toUpperCase();
  const shortLabel = /^\d+$/.test(normalizedLabel)
    ? normalizedLabel.padStart(2, "0")
    : normalizedLabel;
  return `${branchCode}-${shortLabel}`;
};

const MenuLink: React.FC<{ url: string }> = ({ url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    title={url}
    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-nnorte-blue/25 bg-nnorte-blue/10 px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-blue-soft transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text"
  >
    <ExternalLink size={12} className="shrink-0" />
    <span className="truncate">Buka link menu pelanggan</span>
  </a>
);

export const MejaQRCode: React.FC = () => {
  const {
    currentUser,
    currentBranchId,
    branches,
    tables,
    addTable,
    updateTable,
    deleteTable,
    addToast,
  } = useApp();
  const branchId =
    currentUser?.branchId ||
    (currentBranchId !== "all" ? currentBranchId : branches[0]?.id || "");
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchTables = tables.filter((t) => t.branchId === branchId);

  const [activeQRModal, setActiveQRModal] = useState<TableInfo | null>(null);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInfo | null>(null);
  const [tableNum, setTableNum] = useState("");
  const [capacity, setCapacity] = useState(4);

  const closeTableForm = () => {
    setIsAddTableOpen(false);
    setEditingTable(null);
    setTableNum("");
    setCapacity(4);
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = tableNum.trim();
    if (!normalizedName) return;
    const duplicate = branchTables.some(
      (table) =>
        table.id !== editingTable?.id &&
        table.tableNumber.toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      addToast("warning", "Nama meja sudah digunakan di cabang ini.");
      return;
    }

    if (editingTable) {
      updateTable(editingTable.id, { tableNumber: normalizedName, capacity });
    } else {
      addTable({
        branchId,
        tableNumber: normalizedName,
        capacity,
        status: "available",
        qrCodeToken: createTableQrToken(),
      });
    }
    closeTableForm();
  };

  const openEditTable = (table: TableInfo) => {
    setEditingTable(table);
    setTableNum(table.tableNumber);
    setCapacity(table.capacity);
    setIsAddTableOpen(true);
  };

  const handleDeleteTable = (table: TableInfo) => {
    if (table.status !== "available") {
      addToast("warning", "Kosongkan meja terlebih dahulu sebelum menghapusnya.");
      return;
    }
    if (
      window.confirm(
        `Hapus ${table.tableNumber}? QR meja ini tidak dapat digunakan lagi.`
      )
    ) {
      deleteTable(table.id);
    }
  };

  const downloadQr = async (table: TableInfo) => {
    if (!branch) return;
    const value = getCustomerMenuUrl(
      table.qrCodeToken,
      branch.id,
      branch.name,
      table.tableNumber
    );
    const dataUrl = await QRCode.toDataURL(value, { width: 640, margin: 2 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-${getDisplayTableCode(branch.code, table.tableNumber)}.png`;
    link.click();
  };

  const statusStyle: Record<TableInfo["status"], string> = {
    available: "bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30",
    occupied: "bg-nnorte-red/10 text-nnorte-red border-nnorte-red/30",
    reserved: "bg-nnorte-warning/10 text-nnorte-warning border-nnorte-warning/30",
    billing: "bg-nnorte-blue/10 text-nnorte-blue-soft border-nnorte-blue/30",
  };

  const activeQRModalUrl = activeQRModal
    ? getCustomerMenuUrl(
        activeQRModal.qrCodeToken,
        branch?.id || branchId,
        branch?.name || "",
        activeQRModal.tableNumber
      )
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">
            QR Code Meja
          </h1>
          <p className="mt-1 text-xs text-nnorte-muted">
            Cetak QR unik per meja untuk akses menu pelanggan di{" "}
            {branch ? branch.name : "cabang ini"}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingTable(null);
            setTableNum("");
            setCapacity(4);
            setIsAddTableOpen(true);
          }}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-nnorte-red px-4 py-2.5 text-xs font-semibold text-nnorte-on-brand shadow-lg transition-all hover:bg-nnorte-red-hover"
        >
          <Plus size={16} />
          <span>Tambah Meja</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {branchTables.map((table) => {
          const menuUrl = getCustomerMenuUrl(
            table.qrCodeToken,
            branch?.id || branchId,
            branch?.name || "",
            table.tableNumber
          );

          return (
            <div
              key={table.id}
              className="flex flex-col gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-nnorte-text">
                    {table.tableNumber}
                  </div>
                  <div className="text-[10px] font-mono text-nnorte-muted">
                    {branch ? getDisplayTableCode(branch.code, table.tableNumber) : table.id}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle[table.status]}`}
                >
                  {table.status}
                </span>
              </div>

              <div className="text-[11px] text-nnorte-muted">
                Kapasitas {table.capacity} orang
              </div>

              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={menuUrl}
                aria-label={`Buka menu pelanggan untuk ${table.tableNumber}`}
                className="flex cursor-pointer items-center justify-center rounded-lg bg-white p-2 transition-opacity hover:opacity-90"
              >
                <QRCodeImage
                  value={menuUrl}
                  alt={`QR ${table.tableNumber}`}
                  size={120}
                />
              </a>

              <MenuLink url={menuUrl} />

              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveQRModal(table)}
                  className="flex items-center gap-1 rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-2 py-1.5 text-[11px] text-nnorte-muted transition-colors hover:border-nnorte-blue/40 hover:text-nnorte-text"
                >
                  <QrCode size={13} /> Lihat
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Edit ${table.tableNumber}`}
                    onClick={() => openEditTable(table)}
                    className="rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-1.5 text-nnorte-muted transition-colors hover:border-nnorte-blue/40 hover:text-nnorte-text"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${table.tableNumber}`}
                    onClick={() => handleDeleteTable(table)}
                    className="rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-1.5 text-nnorte-red transition-colors hover:border-nnorte-red"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {branchTables.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-nnorte-border bg-nnorte-surface p-10 text-center text-xs text-nnorte-muted">
            Belum ada meja terdaftar untuk cabang ini.
          </div>
        )}
      </div>

      {/* QR preview modal */}
      {activeQRModal && (
        <Modal
          isOpen={true}
          onClose={() => setActiveQRModal(null)}
          title={`QR ${activeQRModal.tableNumber}`}
          subtitle={branch ? branch.name : ""}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <a
              href={activeQRModalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={activeQRModalUrl}
              aria-label={`Buka menu pelanggan untuk ${activeQRModal.tableNumber}`}
              className="flex cursor-pointer items-center justify-center rounded-xl bg-white p-4 transition-opacity hover:opacity-90"
            >
              <QRCodeImage
                value={activeQRModalUrl}
                alt={`QR ${activeQRModal.tableNumber}`}
                size={220}
              />
            </a>
            <MenuLink url={activeQRModalUrl} />
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => downloadQr(activeQRModal)}
                className="flex items-center gap-1.5 rounded-lg bg-nnorte-red px-3 py-2 text-xs font-semibold text-nnorte-on-brand"
              >
                <Download size={14} /> Unduh QR
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-3 py-2 text-xs font-semibold text-nnorte-text"
              >
                <Printer size={14} /> Cetak
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / edit table modal */}
      {isAddTableOpen && (
        <Modal
          isOpen={true}
          onClose={closeTableForm}
          title={editingTable ? "Edit Meja" : "Tambah Meja Baru"}
          subtitle={branch ? `Cabang: ${branch.name}` : ""}
          maxWidth="sm"
        >
          <form onSubmit={handleAddTable} className="space-y-4 text-xs">
            <div>
              <label className="mb-1 block font-medium text-nnorte-muted">
                Nama / Nomor Meja
              </label>
              <input
                type="text"
                value={tableNum}
                onChange={(event) => setTableNum(event.target.value)}
                placeholder="e.g. Meja A-01"
                className="w-full rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-3 py-2 text-nnorte-text placeholder-nnorte-subtle focus:border-nnorte-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-nnorte-muted">
                Kapasitas
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="w-full rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-3 py-2 text-nnorte-text focus:border-nnorte-blue focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-nnorte-border pt-3">
              <button
                type="button"
                onClick={closeTableForm}
                className="rounded-lg bg-nnorte-surface-2 px-3 py-1.5 text-nnorte-muted hover:text-nnorte-text"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-nnorte-red px-4 py-1.5 font-semibold text-nnorte-on-brand"
              >
                {editingTable ? "Simpan Perubahan" : "Tambah Meja"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
