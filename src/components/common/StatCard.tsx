import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  badge?: string;
  /** Urutan kemunculan bertahap (stagger). */
  index?: number;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  change,
  changeType = 'positive',
  icon: Icon,
  badge,
  index = 0,
  loading = false,
}) => {
  return (
    <div
      className="nn-rise nn-lift bg-theme-card border border-theme rounded-xl p-4 hover:border-nnorte-blue/40 min-w-0"
      style={{ ['--i' as string]: index }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-normal leading-tight text-theme-muted">{title}</span>
        {Icon && (
          <div className="w-7 h-7 shrink-0 rounded-lg bg-nnorte-blue/10 border border-nnorte-blue/25 flex items-center justify-center text-nnorte-blue-soft">
            <Icon size={14} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        {loading ? (
          <div className="skeleton h-6 w-28" aria-label="Memuat" />
        ) : (
          <h3 className="text-base xl:text-lg font-bold text-theme-main tracking-tight truncate" title={value}>
            {value}
          </h3>
        )}
        {badge && !loading && (
          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-theme-card-sec text-theme-muted border border-theme whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] min-h-4">
        {change && !loading && (
          <div
            className={`inline-flex items-center gap-1 font-semibold truncate ${
              changeType === 'positive' ? 'text-nnorte-success' : changeType === 'negative' ? 'text-nnorte-error' : 'text-theme-muted'
            }`}
          >
            <span>{change}</span>
            <span className="text-theme-muted font-normal hidden xl:inline">vs periode lalu</span>
          </div>
        )}
        {subtext && !loading && <span className="text-theme-muted text-right ml-auto truncate">{subtext}</span>}
      </div>
    </div>
  );
};
