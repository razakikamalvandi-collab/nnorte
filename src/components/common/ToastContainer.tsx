import React from "react";
import { useApp } from "../../context/AppContext";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-theme';
        let icon = <Info size={18} className="text-nnorte-blue-hover" />;

        if (toast.type === 'success') {
          borderClass = 'border-nnorte-success/40';
          icon = <CheckCircle2 size={18} className="text-nnorte-success" />;
        } else if (toast.type === 'error') {
          borderClass = 'border-nnorte-error/40';
          icon = <AlertCircle size={18} className="text-nnorte-error" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-nnorte-warning/40';
          icon = <AlertTriangle size={18} className="text-nnorte-warning" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-theme-card border ${borderClass} shadow-2xl transition-all duration-200 animate-slide-in`}
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="text-xs text-theme-main flex-1 leading-relaxed">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-theme-muted hover:text-theme-main p-0.5 rounded cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
