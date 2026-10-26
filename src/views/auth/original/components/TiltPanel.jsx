import { useEffect, useRef } from 'react'

// Pembungkus efek tilt 3D. Hanya mengubah transform CSS wrapper; form di dalamnya tidak disentuh.
// Aktif hanya pada perangkat dengan mouse dan tanpa `prefers-reduced-motion`.
export default function TiltPanel({ children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return undefined

    const MAX_X = 4 // derajat (naik/turun)
    const MAX_Y = 6 // derajat (kiri/kanan)
    let frame = 0
    let last = null

    const clamp = (v) => Math.max(-1, Math.min(1, v))

    const apply = () => {
      frame = 0
      if (!last) return
      const r = el.getBoundingClientRect()
      const nx = clamp((last.x - (r.left + r.width / 2)) / (window.innerWidth * 0.4))
      const ny = clamp((last.y - (r.top + r.height / 2)) / (window.innerHeight * 0.4))
      el.style.setProperty('--tilt-x', `${(-ny * MAX_X).toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${(nx * MAX_Y).toFixed(2)}deg`)
      el.style.setProperty('--gx', `${(((last.x - r.left) / r.width) * 100).toFixed(1)}%`)
      el.style.setProperty('--gy', `${(((last.y - r.top) / r.height) * 100).toFixed(1)}%`)
      el.classList.add('is-tilting')
    }

    const onMove = (e) => {
      last = { x: e.clientX, y: e.clientY }
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const reset = () => {
      last = null
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
      el.classList.remove('is-tilting')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', reset)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', reset)
      window.removeEventListener('blur', reset)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} className="tilt-panel">
      {children}
    </div>
  )
}
