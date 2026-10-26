import { useEffect } from 'react'

// Efek tilt tombol mengikuti posisi pointer (event delegation, satu listener untuk seluruh aplikasi).
// Hanya menulis variabel CSS --btx / --bty; efek visualnya ada di animations.css.
export default function useButtonTilt() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return undefined

    let active = null

    const reset = (btn) => {
      btn?.style.removeProperty('--btx')
      btn?.style.removeProperty('--bty')
    }

    const onMove = (e) => {
      const btn = e.target instanceof Element ? e.target.closest('.btn') : null
      if (active && active !== btn) reset(active)
      active = btn
      if (!btn || btn.disabled) return
      const r = btn.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width - 0.5) * 2
      const y = ((e.clientY - r.top) / r.height - 0.5) * 2
      btn.style.setProperty('--btx', x.toFixed(2))
      btn.style.setProperty('--bty', y.toFixed(2))
    }
    const onLeave = () => {
      reset(active)
      active = null
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])
}
