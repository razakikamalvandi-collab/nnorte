import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleClassName?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Tombol aksi (Batal/Simpan). Tetap terlihat saat isi modal di-scroll. */
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Saat true (mis. sedang menyimpan) modal tidak bisa ditutup. */
  busy?: boolean;
}

const EXIT_MS = 150;

// --- kunci scroll halaman latar (aman untuk modal bertumpuk) ------------------
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll() {
  if (lockCount === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// Hanya modal paling atas yang merespons Esc.
const modalStack: string[] = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  titleClassName = 'text-base',
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  busy = false,
}) => {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const [rendered, setRendered] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const downOnOverlay = useRef(false);

  // Mount / unmount dengan animasi keluar ketika isOpen berubah dari luar.
  useEffect(() => {
    if (isOpen) {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
      exitTimer.current = window.setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, EXIT_MS);
    }
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (busyRef.current) return;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  // Kunci scroll, fokus, Esc, dan jebakan Tab selama modal tampil.
  useEffect(() => {
    if (!rendered) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();
    modalStack.push(id);
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>('[data-autofocus], input:not([type="hidden"]), select, textarea');
    (firstField || panel)?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (nodes.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.lastIndexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
      unlockScroll();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [rendered, id, requestClose]);

  if (!rendered) return null;

  const widthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  }[maxWidth];

  return (
    <div
      className="nn-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      data-state={closing ? 'closing' : 'open'}
      onMouseDown={(e) => {
        downOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnOverlay.current) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={closing ? 'closing' : 'open'}
        className={`nn-modal relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-nnorte-border bg-nnorte-surface shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${widthClasses}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-nnorte-border bg-nnorte-sidebar px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className={`${titleClassName} font-bold tracking-tight text-nnorte-text`}>
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-xs text-nnorte-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Tutup"
            className="nn-press flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-nnorte-border bg-nnorte-sidebar px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
