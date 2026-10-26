import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-nnorte-red text-nnorte-on-brand hover:bg-nnorte-red-hover shadow-md border border-transparent',
  accent: 'bg-nnorte-blue text-nnorte-on-brand hover:bg-nnorte-blue-hover shadow-md border border-transparent',
  secondary:
    'bg-nnorte-surface-2 text-nnorte-text border border-nnorte-border hover:border-nnorte-blue',
  danger: 'bg-transparent text-nnorte-red border border-nnorte-red/50 hover:bg-nnorte-red/10',
  ghost: 'bg-transparent text-nnorte-muted border border-transparent hover:text-nnorte-text',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  loadingText,
  icon,
  size = 'md',
  disabled,
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`nn-press inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-55 ${
      size === 'sm' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-11 px-4 py-2 text-xs sm:min-h-10'
    } ${VARIANT[variant]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 size={14} className="nn-spin" aria-hidden="true" /> : icon}
    <span>{loading && loadingText ? loadingText : children}</span>
  </button>
);
