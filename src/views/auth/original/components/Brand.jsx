import { useAuthNav } from '../lib/authAdapter'

// Logo/brand. Di NNORTE tidak ada router; "beranda" = portal pelanggan publik.
export default function Brand({ to = '/', size = 'md' }) {
  const { goHome } = useAuthNav()
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault()
        goHome()
      }}
      className={`brand brand-${size}`}
      aria-label="NNORTE Coffee & Hangout — ke beranda"
    >
      <img src="/logo.png" alt="" className="brand-logo" width="44" height="44" />
      <span className="brand-text">
        <strong>NNORTE</strong>
        <small>Coffee &amp; Hangout</small>
      </span>
    </a>
  )
}
