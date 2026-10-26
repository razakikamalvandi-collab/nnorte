import { useTheme } from "../../../context/ThemeContext";
import { FooterWordmark } from "./FooterWordmark";
import "./footer.css";

export interface FooterProps {
  className?: string;
}

/**
 * Footer portal pelanggan: hanya wordmark raksasa "NNORTE".
 * Warna mengikuti tema aktif lewat `data-theme-mode`.
 */
export function Footer({ className = "" }: FooterProps) {
  const { theme } = useTheme();

  return (
    <footer
      className={`nn-footer ${className}`.trim()}
      data-theme-mode={theme}
      aria-label="NNORTE"
    >
      <div className="nn-footer__inner">
        <FooterWordmark />
      </div>
    </footer>
  );
}

export default Footer;
