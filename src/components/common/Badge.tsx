import React from "react";

interface BadgeProps {
  variant?: 'red' | 'green' | 'amber' | 'blue' | 'zinc';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'zinc', children, size = 'sm' }) => {
  const styles = {
    red: 'bg-nnorte-red/10 text-nnorte-red border-nnorte-red/30',
    green: 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30',
    amber: 'bg-nnorte-warning/10 text-nnorte-warning border-nnorte-warning/30',
    blue: 'bg-nnorte-blue/10 text-nnorte-blue-soft border-nnorte-blue/30',
    zinc: 'bg-nnorte-surface-2 text-nnorte-muted border-nnorte-border',
  }[variant];

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${styles} ${sizeClass}`}
    >
      {children}
    </span>
  );
};



