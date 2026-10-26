import { useEffect, useRef } from 'react'

// Kotak 3D generik (CSS 3D murni, tanpa library). `faces` mengisi konten tiap sisi.
function Box({ w, h, d, x = 0, y = 0, z = 0, cls = '', faces = {} }) {
  return (
    <div
      className={`box ${cls}`}
      style={{ '--w': `${w}px`, '--h': `${h}px`, '--d': `${d}px`, transform: `translate3d(${x}px, ${y}px, ${z}px)` }}
    >
      <div className="f front">{faces.front}</div>
      <div className="f back">{faces.back}</div>
      <div className="f left">{faces.left}</div>
      <div className="f right">{faces.right}</div>
      <div className="f top">{faces.top}</div>
      <div className="f bottom" />
    </div>
  )
}

function Window({ className = '' }) {
  return (
    <div className={`win ${className}`}>
      <span /><span /><span /><span />
    </div>
  )
}

// Bangunan kafe NNORTE dalam CSS 3D, dengan parallax mengikuti pointer.
export default function CafeScene({ compact = false }) {
  const wrapRef = useRef(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    let frame = 0
    let nextX = 0
    let nextY = 0

    const apply = () => {
      frame = 0
      el.style.setProperty('--px', nextX.toFixed(2))
      el.style.setProperty('--py', nextY.toFixed(2))
    }
    const onMove = (e) => {
      nextX = (e.clientX / window.innerWidth - 0.5) * 2
      nextY = (e.clientY / window.innerHeight - 0.5) * 2
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      nextX = 0
      nextY = 0
      if (!frame) frame = requestAnimationFrame(apply)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className={`scene ${compact ? 'scene-compact' : ''}`} ref={wrapRef} role="img" aria-label="Ilustrasi 3D bangunan kafe NNORTE">
      <div className="scene-glow" aria-hidden="true" />
      <div className="scene-float">
        <div className="stage">
          {/* Lantai / teras */}
          <Box w={400} h={14} d={320} y={92} cls="ground" />

          {/* Bangunan utama */}
          <Box
            w={240}
            h={170}
            d={170}
            cls="building"
            faces={{
              front: (
                <>
                  <div className="facade-band" />
                  <Window className="w1" />
                  <Window className="w2" />
                  <div className="door"><span /></div>
                  <div className="awning" />
                </>
              ),
              left: (
                <>
                  <Window className="sw1" />
                  <Window className="sw2" />
                </>
              ),
              right: <div className="glass-wall"><span /><span /><span /></div>,
              top: <div className="roof-lines" />,
            }}
          />

          {/* Atap & papan nama */}
          <Box w={258} h={12} d={188} y={-91} cls="roof" />
          <Box
            w={170}
            h={38}
            d={10}
            y={-116}
            z={66}
            cls="signboard"
            faces={{ front: <div className="sign-text">NNORTE<i>★</i></div> }}
          />

          {/* Area duduk luar */}
          <Box w={30} h={20} d={30} x={-124} y={75} z={128} cls="stool" />
          <Box w={30} h={20} d={30} x={-56} y={75} z={152} cls="stool" />
          <Box w={8} h={28} d={8} x={-90} y={71} z={140} cls="pole" />
          <Box w={52} h={6} d={52} x={-90} y={56} z={140} cls="table" />
          <Box w={30} h={20} d={30} x={78} y={75} z={150} cls="stool navy" />
          <Box w={30} h={20} d={30} x={134} y={75} z={118} cls="stool navy" />
          <Box w={8} h={28} d={8} x={106} y={71} z={134} cls="pole" />
          <Box w={52} h={6} d={52} x={106} y={56} z={134} cls="table" />

          {/* Tiang lampu */}
          <Box w={6} h={92} d={6} x={-176} y={40} z={-20} cls="pole" />
          <Box w={16} h={16} d={16} x={-176} y={-14} z={-20} cls="lamp" />
          <Box w={6} h={92} d={6} x={176} y={40} z={-20} cls="pole" />
          <Box w={16} h={16} d={16} x={176} y={-14} z={-20} cls="lamp" />
        </div>
      </div>
    </div>
  )
}
