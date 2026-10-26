import { Component, Suspense, lazy, useState, type ReactNode } from 'react'

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

// Cadangan bila WebGL tidak tersedia / gagal: panel sederhana dengan logo.
function Fallback() {
  return (
    <div className="cafe3d cafe3d-fallback">
      <img src="/nnorte-logo-transparent.svg" alt="NNORTE Coffee & Hangout" className="cafe3d-fallback-logo" />
    </div>
  )
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('Cafe3D gagal dimuat, memakai tampilan cadangan.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Rumah kafe 2 tingkat (siang/malam mengikuti tema aplikasi), memenuhi parent-nya.
export default function Cafe3DLazy() {
  const [webgl] = useState(hasWebGL)
  const [lost, setLost] = useState(false)

  if (!webgl || lost) return <Fallback />

  return (
    <Boundary fallback={<Fallback />}>
      <Suspense
        fallback={
          <div className="cafe3d-loading" role="status" aria-label="Memuat model 3D">
            <span className="cafe3d-spinner" aria-hidden="true" />
          </div>
        }
      >
        <Cafe3D onError={() => setLost(true)} />
      </Suspense>
    </Boundary>
  )
}
