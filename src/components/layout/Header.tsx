import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  Menu,
  Building2,
  Bell,
} from "lucide-react";
import { ThemeToggle } from "../common/ThemeToggle";

interface HeaderProps {
  onOpenMobileMenu: () => void;
  activeTabTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, activeTabTitle }) => {
  const { currentUser, branches, orders, dataLoading } = useApp();

  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'pending' || o.status === 'kitchen_queue'
  ).length;
  const previousPendingCount = useRef(pendingOrdersCount);
  const observedInitialLoad = useRef(false);
  const notificationsInitialized = useRef(false);
  const [badgeAnimationId, setBadgeAnimationId] = useState(0);
  const [notificationAnnouncement, setNotificationAnnouncement] = useState('');

  useEffect(() => {
    if (!notificationsInitialized.current) {
      if (dataLoading) {
        observedInitialLoad.current = true;
        previousPendingCount.current = pendingOrdersCount;
        return;
      }
      if (!observedInitialLoad.current) return;
      notificationsInitialized.current = true;
      previousPendingCount.current = pendingOrdersCount;
      return;
    }
    if (pendingOrdersCount > previousPendingCount.current) {
      setBadgeAnimationId((current) => current + 1);
      setNotificationAnnouncement(`Notifikasi baru. Total ${pendingOrdersCount} pesanan menunggu.`);
    } else if (pendingOrdersCount < previousPendingCount.current) {
      setNotificationAnnouncement('');
    }
    previousPendingCount.current = pendingOrdersCount;
  }, [pendingOrdersCount, dataLoading]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-nnorte-border bg-nnorte-bg px-4 lg:px-8">
      {/* Left side: Hamburger + Breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="shrink-0 rounded-lg border border-nnorte-border bg-nnorte-surface p-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="hidden min-w-0 sm:block">
          <div className="flex items-center gap-2 text-xs text-nnorte-muted">
            <span className="shrink-0">NNORTE</span>
            <span>/</span>
            <span className="truncate font-semibold text-nnorte-text">{activeTabTitle}</span>
          </div>
        </div>
      </div>

      {/* Right side: Theme, Notifications */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Non-owner: cabang terkunci. Owner memilih cabang/periode di filter tiap halaman. */}
        {currentUser && currentUser.role !== 'owner' && (
          <div className="hidden items-center gap-2 rounded-lg border border-nnorte-border bg-nnorte-surface px-3 py-1.5 text-xs text-nnorte-muted md:flex">
            <Building2 size={13} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" />
            <span className="max-w-[180px] truncate font-medium text-nnorte-text">
              {branches.find((b) => b.id === currentUser.branchId)?.name || 'Cabang'}
            </span>
            <span className="rounded border border-nnorte-blue/30 bg-nnorte-blue/10 px-1.5 py-0.5 text-[10px] text-nnorte-blue-soft">Terkunci</span>
          </div>
        )}

        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            aria-label={`Notifikasi, ${pendingOrdersCount} pesanan menunggu`}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"
          >
            <Bell size={16} aria-hidden="true" />
            {pendingOrdersCount > 0 && (
              <span key={badgeAnimationId} data-new={badgeAnimationId > 0} aria-hidden="true" className="nn-notification-badge absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-nnorte-red text-[10px] font-bold text-nnorte-on-brand shadow-md">
                {pendingOrdersCount}
              </span>
            )}
          </button>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{notificationAnnouncement}</span>
        </div>
      </div>
    </header>
  );
};
