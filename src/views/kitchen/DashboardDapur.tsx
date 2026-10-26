import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatTimeOnly } from "../../utils/formatters";
import { OrderStatus, Order } from "../../types";
import {
  ChefHat,
  Flame,
  Clock,
  Sparkles,
  CheckCircle2,
  Printer,
  AlertCircle,
  Timer,
  Utensils,
} from "lucide-react";

interface DashboardDapurProps {
  initialSubTab?: string;
}

const STAGES = [
  { id: "antrean_baru", label: "Antrean Baru", icon: AlertCircle },
  { id: "sedang_diproses", label: "Sedang Diproses", icon: Flame },
  { id: "siap_disajikan", label: "Siap Disajikan", icon: Sparkles },
  { id: "riwayat_pesanan", label: "Riwayat", icon: CheckCircle2 },
] as const;

export const DashboardDapur: React.FC<DashboardDapurProps> = ({
  initialSubTab = "antrean_baru",
}) => {
  const { currentUser, orders, updateOrderStatus, branches } = useApp();
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const [activeStage, setActiveStage] = useState<string>(initialSubTab);

  const branchOrders = orders.filter((o) => o.branchId === branchId);

  const newOrders = branchOrders.filter(
    (o) => o.status === "pending" || o.status === "kitchen_queue"
  );
  const cookingOrders = branchOrders.filter((o) => o.status === "cooking");
  const readyOrders = branchOrders.filter((o) => o.status === "ready_to_serve");
  const historyOrders = branchOrders.filter((o) => o.status === "completed");

  const visibleOrders =
    activeStage === "antrean_baru"
      ? newOrders
      : activeStage === "sedang_diproses"
        ? cookingOrders
        : activeStage === "siap_disajikan"
          ? readyOrders
          : historyOrders;

  const stageCount: Record<string, number> = {
    antrean_baru: newOrders.length,
    sedang_diproses: cookingOrders.length,
    siap_disajikan: readyOrders.length,
    riwayat_pesanan: historyOrders.length,
  };

  const nextStatus: Record<string, { status: OrderStatus; label: string }> = {
    antrean_baru: { status: "cooking", label: "Mulai Masak" },
    sedang_diproses: { status: "ready_to_serve", label: "Siap Disajikan" },
    siap_disajikan: { status: "completed", label: "Selesaikan" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">
            Dapur &amp; Antrean
          </h1>
          <p className="mt-1 text-xs text-nnorte-muted">
            Kitchen display system {branch ? `- ${branch.name}` : ""}. Pantau dan
            perbarui status pesanan secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-nnorte-border bg-nnorte-surface px-3 py-2 text-xs text-nnorte-muted">
          <Timer size={14} className="text-nnorte-red" />
          {branchOrders.filter((o) => o.status === "cooking").length} pesanan sedang
          dimasak
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-nnorte-border pb-3">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const active = activeStage === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveStage(stage.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-nnorte-red text-nnorte-on-brand"
                  : "border border-nnorte-border bg-nnorte-surface text-nnorte-muted hover:text-nnorte-text"
              }`}
            >
              <Icon size={14} />
              {stage.label}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active ? "bg-black/20" : "bg-nnorte-surface-2"
                }`}
              >
                {stageCount[stage.id]}
              </span>
            </button>
          );
        })}
      </div>

      {visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-nnorte-border bg-nnorte-surface p-12 text-center">
          <ChefHat size={36} className="mx-auto mb-2 text-nnorte-muted" />
          <h4 className="text-sm font-bold text-nnorte-text">
            Tidak ada pesanan pada tahap ini
          </h4>
          <p className="mt-0.5 text-xs text-nnorte-muted">
            Semua pesanan berjalan terpantau aman.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order: Order) => {
            const action = nextStatus[activeStage];
            return (
              <div
                key={order.id}
                className="flex flex-col gap-3 rounded-2xl border border-nnorte-border bg-nnorte-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-bold text-nnorte-red">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-nnorte-muted">
                      {order.tableNumber
                        ? `Meja ${order.tableNumber}`
                        : order.orderType === "takeaway"
                          ? "Bawa Pulang"
                          : "Dine-In"}{" "}
                      &bull; {order.customerName}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-nnorte-border bg-nnorte-surface-2 px-2 py-0.5 text-[10px] font-semibold text-nnorte-muted">
                    <Clock size={10} />
                    {formatTimeOnly(order.createdAt)}
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-nnorte-border pt-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-nnorte-text">
                          <span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-nnorte-red/15 px-1 text-[10px] font-bold text-nnorte-red">
                            {item.quantity}x
                          </span>
                          {item.name}
                        </div>
                        {item.variantChoice && (
                          <div className="text-[10px] text-nnorte-muted">
                            {item.variantChoice}
                          </div>
                        )}
                        {item.notes && (
                          <div className="mt-0.5 flex items-start gap-1 text-[10px] italic text-nnorte-warning">
                            <Utensils size={10} className="mt-0.5 shrink-0" />
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-nnorte-border pt-3">
                  {action && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(order.id, action.status)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-nnorte-red px-3 py-2 text-xs font-semibold text-nnorte-on-brand transition-colors hover:bg-nnorte-red-hover"
                    >
                      {action.status === "cooking" ? (
                        <Flame size={14} />
                      ) : action.status === "ready_to_serve" ? (
                        <Sparkles size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {action.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    aria-label={`Cetak tiket ${order.orderNumber}`}
                    className="rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-2 text-nnorte-muted transition-colors hover:border-nnorte-blue/40 hover:text-nnorte-text"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
