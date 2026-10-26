import React from 'react';
import { AlertTriangle, LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** CTA hanya diberikan bila pengguna berhak melakukannya. */
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact }) => (
  <div
    className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-nnorte-border bg-nnorte-surface-2 px-4 text-center ${
      compact ? 'py-8' : 'py-12'
    }`}
  >
    <div className="mb-3 rounded-full bg-[conic-gradient(from_140deg,var(--c-red),var(--c-blue),var(--c-red))] p-[1.5px] shadow-[0_0_24px_-6px_var(--c-blue-glow)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-nnorte-surface text-nnorte-blue-soft">
        <Icon size={22} aria-hidden="true" />
      </div>
    </div>
    <h4 className="text-sm font-bold text-nnorte-text">{title}</h4>
    {description && <p className="mt-1 max-w-sm text-xs text-nnorte-muted">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-xl border border-nnorte-error/40 bg-nnorte-error/5 px-4 py-8 text-center"
  >
    <AlertTriangle size={22} className="mb-2 text-nnorte-error" aria-hidden="true" />
    <h4 className="text-sm font-bold text-nnorte-text">Data tidak dapat dimuat</h4>
    <p className="mt-1 max-w-md text-xs text-nnorte-muted">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
        Coba lagi
      </Button>
    )}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);
