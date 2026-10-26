import { Component, Suspense, lazy, useState } from 'react'
import CafeScene from './CafeScene'

// Three.js + R3F cukup besar, jadi dimuat terpisah (code-splitting) hanya saat dibutuhkan.
const Cafe3D = lazy(() => import('./Cafe3D'))

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch {
    return false
  }
}

class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('Cafe3D gagal dimuat, memakai tampilan CSS 3D sebagai cadangan.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Menampilkan scene R3F; bila WebGL tidak ada / gagal, otomatis jatuh ke CafeScene (CSS 3D) yang lama.
export default function Cafe3DLazy({ compact = false, fill = false }) {
  const [webgl] = useState(hasWebGL)
  const [lost, setLost] = useState(false)
  const fallback = <div className={fill ? 'cafe3d-fallback-fill' : undefined}><CafeScene compact={compact} /></div>

  if (!webgl || lost) return fallback

  return (
    <Boundary fallback={fallback}>
      <Suspense
        fallback={
          <div className={`cafe3d-loading ${compact ? 'cafe3d-compact' : ''} ${fill ? 'cafe3d-fill' : ''}`} role="status" aria-label="Memuat model 3D">
            <span className="spinner spinner-lg" aria-hidden="true" />
          </div>
        }
      >
        <Cafe3D compact={compact} fill={fill} onError={() => setLost(true)} />
      </Suspense>
    </Boundary>
  )
}
