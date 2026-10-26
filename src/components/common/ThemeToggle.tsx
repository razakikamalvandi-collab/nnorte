import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

type Props = {
  className?: string;
  /** Renders the button as a labelled pill instead of a bare icon button. */
  withLabel?: boolean;
};

export function ThemeToggle({ className = '', withLabel = false }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const label = isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap';

  const button = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl border transition-colors',
        'border-nnorte-border bg-nnorte-surface text-nnorte-text hover:border-nnorte-blue/40 hover:bg-nnorte-surface-2',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-nnorte-blue',
        withLabel ? 'px-3 py-2 text-xs font-semibold' : 'h-9 w-9',
        className,
      ].join(' ')}
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      {withLabel && <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>}
    </button>
  );

  return button;
}

export default ThemeToggle;
