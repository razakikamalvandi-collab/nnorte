import React, { cloneElement, isValidElement, useId } from 'react';

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
}

export const inputClass = (hasError = false, muted = false) =>
  `w-full min-h-11 rounded-lg border bg-nnorte-input px-3 py-2 text-sm placeholder-nnorte-subtle transition-colors focus:outline-none sm:min-h-10 sm:text-xs ${
    hasError ? 'border-nnorte-error focus:border-nnorte-error' : 'border-nnorte-border focus:border-nnorte-blue'
  } ${muted ? 'text-nnorte-subtle' : 'text-nnorte-text'} disabled:cursor-not-allowed disabled:opacity-60 read-only:opacity-80`;

/** Label di atas input, pesan error/hint di bawah; id & aria otomatis diteruskan ke anak. */
export const Field: React.FC<FieldProps> = ({ label, error, hint, required, children }) => {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-nnorte-text">
        {label}
        {required && <span className="ml-0.5 text-nnorte-red" aria-hidden="true">*</span>}
      </label>
      {child}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[11px] font-medium text-nnorte-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-nnorte-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
