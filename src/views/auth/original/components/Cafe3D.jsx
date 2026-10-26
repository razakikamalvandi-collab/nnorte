import { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor, RoundedBox, useTexture } from '@react-three/drei'
import { useTheme } from '../../../../context/ThemeContext'

/* =========================================================
   Cafe3D — interior kafe NNORTE (React Three Fiber)
   Palet: merah, biru navy, putih, abu-abu (+ hijau untuk tanaman)
   ========================================================= */

const C = {
  red: '#d7262d',
  redDark: '#a51a20',
  navy: '#27347a',
  navyDeep: '#1b2559',
  white: '#f6f4ef',
  wall: '#f1efea',
  wallSide: '#dcdee7',
  grey: '#b9bcc9',
  greyDark: '#7a7f9a',
  glass: '#b9d0ff',
  leaf1: '#3f8a5f',
  leaf2: '#2f7050',
  warm: '#ffd9a8',
}

const MotionCtx = createContext({ reduced: false, mobile: false })
// Ref berisi nilai 0 (siang) .. 1 (malam), dianimasikan halus oleh <Sky />
const NightCtx = createContext({ current: 0 })

/* ---------- Primitif kecil ---------- */
function B({ pos = [0, 0, 0], size = [1, 1, 1], rot = [0, 0, 0], color = C.white, rough = 0.65, metal = 0, round = 0, cast = true, receive = true, opacity = 1, emissive, emissiveIntensity = 1 }) {
  const mat = (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      transparent={opacity < 1}
      opacity={opacity}
      emissive={emissive}
      emissiveIntensity={emissive ? emissiveIntensity : 0}
      depthWrite={opacity >= 1}
    />
  )
  if (round > 0) {
    return (
      <RoundedBox args={size} radius={round} smoothness={2} position={pos} rotation={rot} castShadow={cast} receiveShadow={receive}>
        {mat}
      </RoundedBox>
    )
  }
  return (
    <mesh position={pos} rotation={rot} castShadow={cast} receiveShadow={receive}>
      <boxGeometry args={size} />
      {mat}
    </mesh>
  )
}

function Cyl({ pos = [0, 0, 0], r = 0.5, rTop, h = 1, color = C.white, seg = 28, rot = [0, 0, 0], rough = 0.6, metal = 0, cast = true, open = false, double = false, emissive, emissiveIntensity = 1 }) {
  return (
    <mesh position={pos} rotation={rot} castShadow={cast} receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, seg, 1, open]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} side={double ? THREE.DoubleSide : THREE.FrontSide} emissive={emissive} emissiveIntensity={emissive ? emissiveIntensity : 0} />
    </mesh>
  )
}

/* ---------- Furnitur ---------- */
function Chair({ pos, rotY = 0, color = C.red }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <B pos={[0, 0.45, 0]} size={[0.46, 0.06, 0.46]} color={color} round={0.02} />
      <B pos={[0, 0.78, -0.21]} size={[0.46, 0.58, 0.05]} color={color} round={0.02} />
      {[[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].map(([x, z], i) => (
        <B key={i} pos={[x, 0.21, z]} size={[0.04, 0.42, 0.04]} color={C.navyDeep} metal={0.3} />
      ))}
    </group>
  )
}

function Stool({ pos, color = C.navy, h = 0.74 }) {
  return (
    <group position={pos}>
      <Cyl pos={[0, h, 0]} r={0.21} h={0.07} color={color} />
      <Cyl pos={[0, h / 2, 0]} r={0.03} h={h} color={C.grey} metal={0.6} rough={0.35} />
      <Cyl pos={[0, 0.03, 0]} r={0.2} h={0.05} color={C.greyDark} metal={0.4} />
      <Cyl pos={[0, h * 0.42, 0]} r={0.17} h={0.025} color={C.grey} metal={0.6} rough={0.35} />
    </group>
  )
}

function RoundTable({ pos, r = 0.55 }) {
  return (
    <group position={pos}>
      <Cyl pos={[0, 0.76, 0]} r={r} h={0.06} color={C.white} rough={0.4} />
      <Cyl pos={[0, 0.745, 0]} r={r + 0.015} h={0.02} color={C.navy} />
      <Cyl pos={[0, 0.38, 0]} r={0.05} h={0.76} color={C.navyDeep} metal={0.3} />
      <Cyl pos={[0, 0.03, 0]} r={0.28} h={0.06} color={C.navyDeep} metal={0.3} />
    </group>
  )
}

function Plant({ pos, scale = 1, potColor = C.white, leaves = 9, tall = 0.4 }) {
  const ref = useRef()
  const { reduced } = useContext(MotionCtx)
  useFrame(({ clock }) => {
    if (reduced || !ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.z = Math.sin(t * 1.1 + pos[0] * 2) * 0.025
    ref.current.rotation.x = Math.cos(t * 0.9 + pos[2]) * 0.02
  })
  const items = useMemo(
    () =>
      Array.from({ length: leaves }, (_, i) => {
        const a = (i / leaves) * Math.PI * 2
        return { a, tilt: 0.35 + (i % 3) * 0.2, len: tall * (0.8 + (i % 4) * 0.18), c: i % 2 ? C.leaf1 : C.leaf2 }
      }),
    [leaves, tall],
  )
  return (
    <group position={pos} scale={scale}>
      <Cyl pos={[0, 0.17, 0]} r={0.2} rTop={0.25} h={0.34} color={potColor} rough={0.5} />
      <Cyl pos={[0, 0.33, 0]} r={0.22} h={0.03} color="#4a3b32" />
      <group ref={ref} position={[0, 0.34, 0]}>
        {items.map((l, i) => (
          <group key={i} rotation={[0, l.a, 0]}>
            <mesh position={[Math.sin(l.tilt) * l.len * 0.5, Math.cos(l.tilt) * l.len * 0.5 + 0.02, 0]} rotation={[0, 0, -l.tilt]} scale={[0.09, l.len, 0.035]} castShadow>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={l.c} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function Pendant({ pos, color = C.red, light = true }) {
  const mix = useContext(NightCtx)
  const lightRef = useRef()
  const bulbRef = useRef()
  useFrame(() => {
    const m = mix.current
    if (lightRef.current) lightRef.current.intensity = 4 + m * 12
    if (bulbRef.current) bulbRef.current.emissiveIntensity = 1.6 + m * 3.6
  })
  return (
    <group position={pos}>
      <Cyl pos={[0, 0.62, 0]} r={0.008} h={1.05} color={C.greyDark} seg={6} cast={false} />
      <Cyl pos={[0, 0.06, 0]} r={0.3} rTop={0.1} h={0.26} color={color} open double rough={0.45} />
      <mesh position={[0, -0.03, 0]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial ref={bulbRef} color="#ffffff" emissive={C.warm} emissiveIntensity={1.6} />
      </mesh>
      {light && <pointLight ref={lightRef} position={[0, -0.2, 0]} intensity={5} distance={5} decay={2} color={C.warm} />}
    </group>
  )
}

function Frame({ pos, rot = [0, 0, 0], size = [0.5, 0.65], art = C.red, art2 = C.white }) {
  const [w, h] = size
  return (
    <group position={pos} rotation={rot}>
      <B size={[w, h, 0.05]} color={C.navy} round={0.01} />
      <B pos={[0, 0, 0.03]} size={[w - 0.1, h - 0.1, 0.02]} color={art2} />
      <B pos={[0, -h * 0.08, 0.045]} size={[(w - 0.1) * 0.7, (h - 0.1) * 0.5, 0.02]} color={art} />
      <mesh position={[0, h * 0.2, 0.045]}>
        <circleGeometry args={[(w - 0.1) * 0.16, 24]} />
        <meshStandardMaterial color={C.navy} />
      </mesh>
    </group>
  )
}

/* Tanda bintang merah (ExtrudeGeometry) */
function Star({ pos, size = 0.28 }) {
  const mix = useContext(NightCtx)
  const matRef = useRef()
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    const pts = 5
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 === 0 ? 1 : 0.42
      const a = (i / (pts * 2)) * Math.PI * 2 + Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) sh.moveTo(x, y)
      else sh.lineTo(x, y)
    }
    sh.closePath()
    return new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 })
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    if (matRef.current) matRef.current.emissiveIntensity = 0.55 + mix.current * 1.4
  })
  return (
    <mesh position={pos} scale={size} geometry={geo} castShadow>
      <meshStandardMaterial ref={matRef} color={C.red} emissive={C.red} emissiveIntensity={0.55} roughness={0.4} />
    </mesh>
  )
}

/* ---------- Jendela & pintu ---------- */
function GlassWindow({ pos, size, axis = 'z' }) {
  // axis 'z' = jendela pada dinding belakang (lebar di sumbu X); 'x' = dinding kiri (lebar di sumbu Z)
  const [w, h] = size
  const rot = axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  return (
    <group position={pos} rotation={rot}>
      <B size={[w, h, 0.03]} color={C.glass} opacity={0.22} rough={0.05} metal={0.1} cast={false} />
      <B pos={[0, 0, 0.01]} size={[0.05, h, 0.07]} color={C.navy} />
      <B pos={[0, 0, 0.01]} size={[w, 0.05, 0.07]} color={C.navy} />
      <B pos={[0, h / 2, 0.01]} size={[w + 0.1, 0.07, 0.1]} color={C.navy} />
      <B pos={[0, -h / 2, 0.01]} size={[w + 0.1, 0.07, 0.1]} color={C.navy} />
      <B pos={[-w / 2, 0, 0.01]} size={[0.07, h, 0.1]} color={C.navy} />
      <B pos={[w / 2, 0, 0.01]} size={[0.07, h, 0.1]} color={C.navy} />
      <B pos={[0, -h / 2 - 0.04, 0.1]} size={[w + 0.25, 0.05, 0.24]} color={C.white} />
    </group>
  )
}

/* ---------- Dinding ---------- */
function Walls() {
  const T = 0.15
  return (
    <group>
      {/* Dinding belakang (z = -2.5) dengan bukaan jendela & pintu */}
      <B pos={[-2.6, 1.5, -2.5]} size={[0.8, 3, T]} color={C.wall} />
      <B pos={[-1.5, 0.5, -2.5]} size={[1.4, 1.0, T]} color={C.wall} />
      <B pos={[-1.5, 2.7, -2.5]} size={[1.4, 0.6, T]} color={C.wall} />
      <B pos={[0.2, 1.5, -2.5]} size={[2.0, 3, T]} color={C.wall} />
      <B pos={[1.8, 2.65, -2.5]} size={[1.2, 0.7, T]} color={C.wall} />
      <B pos={[2.7, 1.5, -2.5]} size={[0.6, 3, T]} color={C.wall} />
      <GlassWindow pos={[-1.5, 1.7, -2.5]} size={[1.4, 1.4]} axis="z" />

      {/* Pintu kaca */}
      <group position={[1.8, 0, -2.5]}>
        <B pos={[0, 1.15, 0]} size={[1.0, 2.3, 0.03]} color={C.glass} opacity={0.25} rough={0.05} cast={false} />
        <B pos={[-0.55, 1.15, 0.01]} size={[0.08, 2.3, 0.1]} color={C.navy} />
        <B pos={[0.55, 1.15, 0.01]} size={[0.08, 2.3, 0.1]} color={C.navy} />
        <B pos={[0, 2.3, 0.01]} size={[1.18, 0.08, 0.1]} color={C.navy} />
        <B pos={[0, 1.15, 0.01]} size={[1.0, 0.05, 0.06]} color={C.navy} />
        <Cyl pos={[0.38, 1.1, 0.1]} r={0.02} h={0.4} color={C.grey} metal={0.8} rough={0.25} />
        <B pos={[0, 0.02, 0.2]} size={[1.3, 0.04, 0.4]} color={C.grey} />
      </group>

      {/* Dinding kiri (x = -3) dengan jendela lebar */}
      <B pos={[-3, 1.5, -1.9]} size={[T, 3, 1.2]} color={C.wallSide} />
      <B pos={[-3, 1.5, 1.9]} size={[T, 3, 1.2]} color={C.wallSide} />
      <B pos={[-3, 0.4, 0]} size={[T, 0.8, 2.6]} color={C.wallSide} />
      <B pos={[-3, 2.7, 0]} size={[T, 0.6, 2.6]} color={C.wallSide} />
      <GlassWindow pos={[-3, 1.6, 0]} size={[2.6, 1.6]} axis="x" />

      {/* Lis bawah & atas */}
      <B pos={[0, 0.07, -2.4]} size={[6, 0.14, 0.05]} color={C.navyDeep} />
      <B pos={[-2.9, 0.07, 0]} size={[0.05, 0.14, 5]} color={C.navyDeep} />
      <B pos={[0, 3.02, -2.5]} size={[6.2, 0.1, 0.22]} color={C.navy} />
      <B pos={[-3, 3.02, 0]} size={[0.22, 0.1, 5.2]} color={C.navy} />

      {/* Panel merah di belakang konter */}
      <B pos={[0.2, 0.7, -2.4]} size={[2.0, 1.4, 0.04]} color={C.red} rough={0.5} />
    </group>
  )
}

/* ---------- Lantai ---------- */
function useFloorTex(rx = 3, ry = 2.5) {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const g = cv.getContext('2d')
    g.fillStyle = '#eceae6'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#c7cad8'
    g.fillRect(0, 0, 64, 64)
    g.fillRect(64, 64, 64, 64)
    g.strokeStyle = 'rgba(27,37,89,0.12)'
    g.lineWidth = 2
    g.strokeRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [rx, ry])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Floor() {
  const tex = useFloorTex()
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[6, 0.1, 5]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      <B pos={[0, -0.24, 0]} size={[6.2, 0.28, 5.2]} color={C.navyDeep} rough={0.5} />
      <B pos={[0, -0.4, 0]} size={[6.4, 0.05, 5.4]} color={C.red} rough={0.5} />
    </group>
  )
}

/* ---------- Konter ---------- */
function Counter() {
  return (
    <group position={[0.2, 0, -1.95]}>
      <B pos={[0, 0.525, 0]} size={[2.2, 1.05, 0.65]} color={C.navy} round={0.02} />
      <B pos={[0, 0.72, 0.335]} size={[2.1, 0.3, 0.02]} color={C.red} />
      <B pos={[0, 0.2, 0.335]} size={[2.1, 0.06, 0.02]} color={C.white} />
      <B pos={[0, 1.09, 0.03]} size={[2.4, 0.07, 0.8]} color={C.white} rough={0.3} round={0.015} />
      {/* kotak display kaca */}
      <B pos={[0.65, 1.33, 0]} size={[0.8, 0.4, 0.5]} color={C.glass} opacity={0.28} rough={0.05} cast={false} />
      <B pos={[0.65, 1.14, 0]} size={[0.78, 0.04, 0.48]} color={C.grey} />
      <B pos={[0.5, 1.2, 0]} size={[0.2, 0.08, 0.2]} color={C.red} />
      <B pos={[0.8, 1.2, 0.02]} size={[0.2, 0.08, 0.2]} color={C.navy} />
      {/* mesin kasir */}
      <B pos={[-0.55, 1.18, 0.05]} size={[0.38, 0.14, 0.3]} color={C.greyDark} metal={0.3} />
      <B pos={[-0.55, 1.32, 0.0]} size={[0.3, 0.2, 0.03]} color={C.navyDeep} rot={[-0.25, 0, 0]} emissive={C.navy} emissiveIntensity={0.6} />
      <Plant pos={[-0.15, 1.125, 0.1]} scale={0.45} leaves={7} />
      {/* rak dinding */}
      <B pos={[0, 1.7, -0.28]} size={[1.6, 0.05, 0.28]} color={C.white} />
      <B pos={[0, 2.1, -0.28]} size={[1.6, 0.05, 0.28]} color={C.white} />
      {[-0.6, -0.25, 0.1, 0.45, 0.7].map((x, i) => (
        <B key={x} pos={[x, 1.8, -0.28]} size={[0.16, 0.15, 0.16]} color={[C.red, C.navy, C.grey, C.red, C.navy][i]} />
      ))}
      {[-0.5, -0.1, 0.35, 0.65].map((x, i) => (
        <B key={x} pos={[x, 2.2, -0.28]} size={[0.2, 0.15, 0.18]} color={[C.navy, C.white, C.red, C.grey][i]} />
      ))}
      <B pos={[0, 2.62, -0.3]} size={[1.5, 0.45, 0.04]} color={C.navyDeep} />
      <Star pos={[0, 2.62, -0.25]} size={0.15} />
    </group>
  )
}

/* ---------- Tingkat 2 ---------- */
const Y2 = 3.26 // permukaan lantai tingkat 2

function Armchair({ pos, rotY = 0, color = C.red }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <B pos={[0, 0.3, 0]} size={[0.75, 0.28, 0.7]} color={color} round={0.07} />
      <B pos={[0, 0.66, -0.3]} size={[0.75, 0.55, 0.14]} color={color} round={0.06} />
      <B pos={[-0.4, 0.46, 0]} size={[0.12, 0.34, 0.7]} color={color === C.red ? C.redDark : C.navyDeep} round={0.05} />
      <B pos={[0.4, 0.46, 0]} size={[0.12, 0.34, 0.7]} color={color === C.red ? C.redDark : C.navyDeep} round={0.05} />
      <B pos={[-0.3, 0.08, -0.25]} size={[0.05, 0.16, 0.05]} color={C.navyDeep} />
      <B pos={[0.3, 0.08, -0.25]} size={[0.05, 0.16, 0.05]} color={C.navyDeep} />
      <B pos={[-0.3, 0.08, 0.25]} size={[0.05, 0.16, 0.05]} color={C.navyDeep} />
      <B pos={[0.3, 0.08, 0.25]} size={[0.05, 0.16, 0.05]} color={C.navyDeep} />
    </group>
  )
}

function WinGlow({ pos, size = [0.8, 0.62] }) {
  const mix = useContext(NightCtx)
  const mat = useRef()
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.12 + mix.current * 1.5
  })
  return (
    <group position={pos}>
      <B size={[size[0] + 0.14, size[1] + 0.14, 0.05]} color={C.navyDeep} />
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[size[0], size[1], 0.03]} />
        <meshStandardMaterial ref={mat} color="#e9dcc2" emissive={C.warm} emissiveIntensity={0.12} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Cahaya hangat di dalam ruangan (siang redup, malam terang)
function InteriorLight({ pos, base = 2.5, boost = 9, distance = 8 }) {
  const mix = useContext(NightCtx)
  const { mobile } = useContext(MotionCtx)
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.intensity = base + mix.current * boost
  })
  if (mobile) return null
  return <pointLight ref={ref} position={pos} intensity={base} distance={distance} decay={2} color={C.warm} />
}

function Slab() {
  const tex = useFloorTex(2.6, 2.6)
  return (
    <group>
      {/* Pelat lantai dengan lubang tangga di sisi kanan-belakang */}
      <B pos={[-0.5, 3.15, 0]} size={[5.2, 0.22, 5.2]} color={C.navyDeep} rough={0.5} />
      <B pos={[2.6, 3.15, 1.2]} size={[1.0, 0.22, 2.8]} color={C.navyDeep} rough={0.5} />
      <B pos={[-0.5, 3.03, 0]} size={[5.3, 0.04, 5.3]} color={C.red} rough={0.5} cast={false} />
      <mesh position={[-0.5, Y2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.2, 5.2]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      <mesh position={[2.6, Y2 + 0.002, 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.0, 2.8]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
    </group>
  )
}

function Stairs() {
  const N = 16
  const rise = Y2 / N
  const ang = Math.atan2(Y2, 4.0)
  const len = Math.hypot(Y2, 4.0)
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <B key={i} pos={[2.55, (i + 1) * rise - 0.05, 2.0 - i * 0.25]} size={[0.8, 0.1, 0.27]} color={i % 2 ? C.navy : '#3a4a9a'} rough={0.5} />
      ))}
      {[2.12, 2.98].map((x) => (
        <B key={x} pos={[x, Y2 / 2 - 0.12, 0.125]} rot={[ang, 0, 0]} size={[0.07, 0.24, len]} color={C.navyDeep} />
      ))}
      {/* pegangan tangga di sisi dalam */}
      <B pos={[2.1, Y2 / 2 + 0.78, 0.125]} rot={[ang, 0, 0]} size={[0.05, 0.05, len]} color={C.red} />
      {[-1.5, -0.3, 0.9, 2.0].map((z) => {
        const y = ((2.0 - z) / 4.0) * Y2
        return <B key={z} pos={[2.1, y + 0.4, z]} size={[0.04, 0.8, 0.04]} color={C.navyDeep} />
      })}
    </group>
  )
}

function Upper() {
  const { mobile } = useContext(MotionCtx)
  const mullions = [-3, -1.5, 0, 1.5, 3]
  return (
    <group>
      <Slab />
      <Stairs />

      <group position={[0, Y2, 0]}>
        {/* Dinding belakang (biru navy) + jendela */}
        <B pos={[0, 1.35, -2.52]} size={[6.1, 2.7, 0.16]} color={C.navy} rough={0.6} />
        <WinGlow pos={[-1.9, 1.5, -2.62]} />
        <WinGlow pos={[-0.2, 1.5, -2.62]} />
        <WinGlow pos={[1.5, 1.5, -2.62]} size={[0.6, 0.62]} />

        {/* Dinding kaca kiri, kanan, depan */}
        <B pos={[-3, 1.3, -1.1]} size={[0.03, 2.5, 2.8]} color={C.glass} opacity={0.2} rough={0.05} cast={false} />
        <B pos={[3, 1.3, -1.1]} size={[0.03, 2.5, 2.8]} color={C.glass} opacity={0.2} rough={0.05} cast={false} />
        <B pos={[0, 1.3, 0.3]} size={[6, 2.5, 0.03]} color={C.glass} opacity={0.18} rough={0.05} cast={false} />
        {mullions.map((x) => (
          <B key={x} pos={[x, 1.35, 0.3]} size={[0.08, 2.7, 0.1]} color={C.navy} />
        ))}
        {[-2.5, -1.6, -0.7, 0.3].map((z) => (
          <B key={z} pos={[-3, 1.35, z]} size={[0.1, 2.7, 0.08]} color={C.navy} />
        ))}
        {[-2.5, -1.6, -0.7, 0.3].map((z) => (
          <B key={`r${z}`} pos={[3, 1.35, z]} size={[0.1, 2.7, 0.08]} color={C.navy} />
        ))}
        <B pos={[0, 0.06, 0.3]} size={[6.1, 0.12, 0.12]} color={C.navy} />
        <B pos={[0, 2.64, 0.3]} size={[6.1, 0.12, 0.12]} color={C.navy} />

        {/* Atap */}
        <B pos={[0, 2.79, -1.05]} size={[6.5, 0.2, 3.2]} color={C.navy} rough={0.55} />
        <B pos={[0, 2.67, -1.05]} size={[6.3, 0.04, 3.0]} color={C.red} cast={false} />

        {/* Teras depan: pagar kaca */}
        <B pos={[0, 0.55, 2.5]} size={[6.1, 0.95, 0.03]} color={C.glass} opacity={0.22} rough={0.05} cast={false} />
        <B pos={[0, 1.04, 2.5]} size={[6.2, 0.06, 0.08]} color={C.navy} />
        <B pos={[-3, 0.55, 1.4]} size={[0.03, 0.95, 2.2]} color={C.glass} opacity={0.22} rough={0.05} cast={false} />
        <B pos={[-3, 1.04, 1.4]} size={[0.08, 0.06, 2.3]} color={C.navy} />
        <B pos={[3, 0.55, 1.4]} size={[0.03, 0.95, 2.2]} color={C.glass} opacity={0.22} rough={0.05} cast={false} />
        <B pos={[3, 1.04, 1.4]} size={[0.08, 0.06, 2.3]} color={C.navy} />
        {[-3, -1.5, 0, 1.5, 3].map((x) => (
          <B key={x} pos={[x, 0.55, 2.5]} size={[0.06, 1.0, 0.06]} color={C.navy} />
        ))}
        {[0.3, 1.4, 2.5].map((z) => (
          <group key={z}>
            <B pos={[-3, 0.55, z]} size={[0.06, 1.0, 0.06]} color={C.navy} />
            <B pos={[3, 0.55, z]} size={[0.06, 1.0, 0.06]} color={C.navy} />
          </group>
        ))}

        {/* Ruang santai (dalam) */}
        <Cyl pos={[-1.5, 0.012, -1.2]} r={1.15} h={0.024} color={C.navy} cast={false} />
        <Cyl pos={[-1.5, 0.02, -1.2]} r={0.98} h={0.02} color={C.white} cast={false} />
        <Cyl pos={[-1.5, 0.028, -1.2]} r={0.8} h={0.02} color={C.red} cast={false} />
        <Armchair pos={[-2.25, 0, -1.45]} rotY={Math.PI / 2 - 0.2} color={C.red} />
        <Armchair pos={[-1.2, 0, -2.05]} rotY={0.15} color={C.navy} />
        <Armchair pos={[-1.2, 0, -0.35]} rotY={Math.PI + 0.2} color={C.red} />
        <Cyl pos={[-1.5, 0.22, -1.2]} r={0.32} h={0.05} color={C.white} />
        <Cyl pos={[-1.5, 0.11, -1.2]} r={0.05} h={0.22} color={C.navyDeep} />
        <RoundTable pos={[0.8, 0, -1.2]} r={0.5} />
        <Chair pos={[0.8 + Math.sin(0.5) * 0.8, 0, -1.2 + Math.cos(0.5) * 0.8]} rotY={0.5 + Math.PI} color={C.navy} />
        <Chair pos={[0.8 + Math.sin(3.6) * 0.8, 0, -1.2 + Math.cos(3.6) * 0.8]} rotY={3.6 + Math.PI} color={C.red} />
        <Plant pos={[-2.65, 0, -2.15]} scale={1.7} leaves={11} tall={0.5} potColor={C.white} />
        <Plant pos={[1.65, 0, -2.1]} scale={1.2} leaves={9} tall={0.45} potColor={C.grey} />
        <Plant pos={[0.8, 0.76, -1.2]} scale={0.38} leaves={6} tall={0.38} potColor={C.red} />
        <Pendant pos={[-1.5, 2.15, -1.2]} color={C.red} light={false} />
        <Pendant pos={[0.8, 2.15, -1.2]} color={C.navy} light={false} />
        <Frame pos={[-0.6, 1.7, -2.42]} size={[0.6, 0.46]} art={C.red} rot={[0, 0, 0]} />

        {/* Teras (luar) */}
        <RoundTable pos={[-1.7, 0, 1.55]} r={0.5} />
        <Chair pos={[-1.7 + Math.sin(0.3) * 0.8, 0, 1.55 + Math.cos(0.3) * 0.8]} rotY={0.3 + Math.PI} color={C.red} />
        <Chair pos={[-1.7 + Math.sin(2.2) * 0.8, 0, 1.55 + Math.cos(2.2) * 0.8]} rotY={2.2 + Math.PI} color={C.navy} />
        <Chair pos={[-1.7 + Math.sin(4.4) * 0.8, 0, 1.55 + Math.cos(4.4) * 0.8]} rotY={4.4 + Math.PI} color={C.red} />
        <RoundTable pos={[1.0, 0, 1.6]} r={0.5} />
        <Chair pos={[1.0 + Math.sin(-0.4) * 0.8, 0, 1.6 + Math.cos(-0.4) * 0.8]} rotY={-0.4 + Math.PI} color={C.navy} />
        <Chair pos={[1.0 + Math.sin(1.9) * 0.8, 0, 1.6 + Math.cos(1.9) * 0.8]} rotY={1.9 + Math.PI} color={C.red} />
        <Plant pos={[-2.6, 0, 2.2]} scale={1.0} leaves={8} tall={0.42} potColor={C.white} />
        <Plant pos={[2.6, 0, 2.2]} scale={1.0} leaves={8} tall={0.42} potColor={C.navy} />
        <Plant pos={[-1.7, 0.76, 1.55]} scale={0.36} leaves={6} tall={0.38} potColor={C.red} />

        {!mobile && <InteriorLight pos={[-0.6, 2.2, -1.0]} base={1.5} boost={7} distance={6} />}
      </group>
    </group>
  )
}

/* ---------- Isi ruangan ---------- */
function Room() {
  const { mobile } = useContext(MotionCtx)
  return (
    <group>
      <Floor />
      <Walls />
      <Upper />
      <InteriorLight pos={[0, 2.5, 0.4]} base={3} boost={9} distance={8} />
      <OpenSign pos={[1.9, 2.62, 2.5]} />
      <Outdoor />
      <Counter />

      {/* Karpet */}
      <Cyl pos={[-1.2, 0.012, 0.6]} r={1.3} h={0.024} color={C.navy} cast={false} />
      <Cyl pos={[-1.2, 0.02, 0.6]} r={1.12} h={0.02} color={C.white} cast={false} />
      <Cyl pos={[-1.2, 0.028, 0.6]} r={0.94} h={0.02} color={C.red} cast={false} />

      {/* Meja 1 + kursi */}
      <RoundTable pos={[-1.2, 0, 0.6]} />
      <Chair pos={[-1.2 + Math.sin(0.7) * 0.85, 0, 0.6 + Math.cos(0.7) * 0.85]} rotY={0.7 + Math.PI} color={C.red} />
      <Chair pos={[-1.2 + Math.sin(3.9) * 0.85, 0, 0.6 + Math.cos(3.9) * 0.85]} rotY={3.9 + Math.PI} color={C.navy} />

      {/* Meja 2 + kursi */}
      <RoundTable pos={[0.9, 0, 1.2]} />
      <Chair pos={[0.9 + Math.sin(-0.8) * 0.85, 0, 1.2 + Math.cos(-0.8) * 0.85]} rotY={-0.8 + Math.PI} color={C.navy} />
      <Chair pos={[0.9 + Math.sin(1.4) * 0.85, 0, 1.2 + Math.cos(1.4) * 0.85]} rotY={1.4 + Math.PI} color={C.red} />
      <Chair pos={[0.9 + Math.sin(3.5) * 0.85, 0, 1.2 + Math.cos(3.5) * 0.85]} rotY={3.5 + Math.PI} color={C.navy} />

      {/* Bar jendela */}
      <B pos={[-2.68, 0.96, 0.2]} size={[0.45, 0.06, 2.4]} color={C.white} rough={0.3} round={0.015} />
      <B pos={[-2.9, 0.5, 0.2]} size={[0.04, 0.9, 2.3]} color={C.navyDeep} />
      {[-0.75, 0.2, 1.15].map((z, i) => (
        <Stool key={z} pos={[-2.1, 0, z]} color={i === 1 ? C.red : C.navy} h={0.74} />
      ))}

      {/* Tanaman */}
      <Plant pos={[-2.5, 0, -2.0]} scale={1.9} leaves={11} tall={0.5} potColor={C.white} />
      <Plant pos={[-0.9, 0, 2.2]} scale={1.1} leaves={8} tall={0.42} potColor={C.navy} />
      <Plant pos={[-1.2, 0.8, 0.6]} scale={0.4} leaves={6} tall={0.38} potColor={C.red} />

      {/* Lampu gantung */}
      <Pendant pos={[-1.2, 2.05, 0.6]} color={C.red} light={!mobile} />
      <Pendant pos={[0.9, 2.05, 1.2]} color={C.navy} light={!mobile} />
      <Pendant pos={[-0.3, 2.0, -1.7]} color={C.red} light={false} />
      <Pendant pos={[0.8, 2.0, -1.7]} color={C.navy} light={false} />

      {/* Dekorasi dinding */}
      <Frame pos={[-2.9, 1.95, -1.9]} rot={[0, Math.PI / 2, 0]} size={[0.5, 0.65]} art={C.red} />
      <Frame pos={[-2.9, 1.1, -1.9]} rot={[0, Math.PI / 2, 0]} size={[0.38, 0.38]} art={C.navy} />
      <Frame pos={[-2.9, 1.8, 1.9]} rot={[0, Math.PI / 2, 0]} size={[0.62, 0.45]} art={C.navy} />
      <group position={[-2.6, 2.2, -2.4]} rotation={[Math.PI / 2, 0, 0]}>
        <Cyl r={0.24} h={0.06} color={C.navy} />
        <Cyl pos={[0, 0.035, 0]} r={0.2} h={0.02} color={C.white} />
        <B pos={[0, 0.05, -0.06]} size={[0.02, 0.01, 0.12]} color={C.navyDeep} cast={false} />
        <B pos={[0.04, 0.05, 0.0]} size={[0.09, 0.01, 0.02]} color={C.red} cast={false} />
      </group>
    </group>
  )
}

/* ---------- Lingkungan luar ---------- */
function Tree({ pos, s = 1 }) {
  const ref = useRef()
  const { reduced } = useContext(MotionCtx)
  useFrame(({ clock }) => {
    if (reduced || !ref.current) return
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + pos[0]) * 0.018
  })
  return (
    <group position={pos} scale={s}>
      <Cyl pos={[0, 0.55, 0]} r={0.1} rTop={0.07} h={1.1} color="#6b5a4e" />
      <group ref={ref} position={[0, 1.1, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <icosahedronGeometry args={[0.62, 1]} />
          <meshStandardMaterial color={C.leaf1} roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0.28, 0.98, 0.05]} castShadow>
          <icosahedronGeometry args={[0.42, 1]} />
          <meshStandardMaterial color={C.leaf2} roughness={0.8} flatShading />
        </mesh>
        <mesh position={[-0.27, 0.88, -0.1]} castShadow>
          <icosahedronGeometry args={[0.38, 1]} />
          <meshStandardMaterial color={C.leaf1} roughness={0.8} flatShading />
        </mesh>
      </group>
    </group>
  )
}

function StreetLamp({ pos }) {
  const mix = useContext(NightCtx)
  const { mobile } = useContext(MotionCtx)
  const bulb = useRef()
  const lt = useRef()
  useFrame(() => {
    const m = mix.current
    if (bulb.current) bulb.current.emissiveIntensity = 1 + m * 4
    if (lt.current) lt.current.intensity = m * 9
  })
  return (
    <group position={pos}>
      <Cyl pos={[0, 1.3, 0]} r={0.045} h={2.6} color={C.navyDeep} metal={0.3} />
      <Cyl pos={[0, 0.06, 0]} r={0.14} h={0.12} color={C.navyDeep} />
      <B pos={[-0.22, 2.6, 0]} size={[0.5, 0.05, 0.05]} color={C.navyDeep} />
      <mesh position={[-0.44, 2.5, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial ref={bulb} color="#ffffff" emissive={C.warm} emissiveIntensity={1} />
      </mesh>
      {!mobile && <pointLight ref={lt} position={[-0.44, 2.35, 0]} intensity={0} distance={6} decay={2} color={C.warm} />}
    </group>
  )
}

function Bench({ pos, rotY = 0, color = C.red }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <B pos={[0, 0.45, 0]} size={[1.2, 0.07, 0.4]} color={color} round={0.02} />
      <B pos={[0, 0.75, -0.18]} size={[1.2, 0.4, 0.05]} color={color} round={0.02} />
      {[-0.5, 0.5].map((x) => (
        <B key={x} pos={[x, 0.22, 0]} size={[0.06, 0.44, 0.36]} color={C.navyDeep} />
      ))}
    </group>
  )
}

function Shrub({ pos, s = 1 }) {
  return (
    <mesh position={pos} scale={s} castShadow>
      <icosahedronGeometry args={[0.28, 1]} />
      <meshStandardMaterial color={C.leaf2} roughness={0.85} flatShading />
    </mesh>
  )
}

/* Papan "BUKA 24 JAM" (tekstur canvas, dua sisi) yang tergantung di rangka depan */
function OpenSign({ pos }) {
  const { invalidate } = useThree()
  const mix = useContext(NightCtx)
  const mats = useRef([])
  const tex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 720
    cv.height = 220
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.userData.cv = cv
    return t
  }, [])

  useEffect(() => {
    const cv = tex.userData.cv
    const draw = () => {
      const g = cv.getContext('2d')
      g.clearRect(0, 0, cv.width, cv.height)
      g.fillStyle = '#d7262d'
      g.fillRect(0, 0, cv.width, cv.height)
      g.strokeStyle = '#ffffff'
      g.lineWidth = 8
      g.strokeRect(14, 14, cv.width - 28, cv.height - 28)
      g.fillStyle = '#ffffff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = '800 104px Outfit, system-ui, "Segoe UI", sans-serif'
      g.fillText('BUKA 24 JAM', cv.width / 2, cv.height / 2 + 6)
      tex.needsUpdate = true
      invalidate()
    }
    draw()
    // Gambar ulang setelah font Outfit selesai dimuat
    document.fonts?.load('800 104px Outfit').then(draw).catch(() => {})
    return () => tex.dispose()
  }, [tex, invalidate])

  useFrame(() => {
    const e = 0.22 + mix.current * 0.95
    mats.current.forEach((m) => {
      if (m) m.emissiveIntensity = e
    })
  })

  return (
    <group position={pos}>
      <B size={[1.56, 0.5, 0.06]} color={C.navy} />
      {[-0.6, 0.6].map((x) => (
        <Cyl key={x} pos={[x, 0.37, 0]} r={0.008} h={0.28} color={C.greyDark} seg={6} cast={false} />
      ))}
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[1.5, 0.46]} />
        <meshStandardMaterial ref={(m) => (mats.current[0] = m)} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, -0.034]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.5, 0.46]} />
        <meshStandardMaterial ref={(m) => (mats.current[1] = m)} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.5} />
      </mesh>
    </group>
  )
}

/* Papan nama bundar berlogo NNORTE (dua sisi) */
function LogoFace({ z, flip = false }) {
  const tex = useTexture('/logo-badge.png')
  const mix = useContext(NightCtx)
  const mat = useRef()
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
  }, [tex])
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.14 + mix.current * 0.85
  })
  return (
    <mesh position={[0, 0, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <circleGeometry args={[0.57, 64]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.14} roughness={0.6} />
    </mesh>
  )
}

function RoofSign() {
  return (
    <group position={[0.2, 7.55, -1.2]}>
      <B pos={[-0.3, -0.62, 0]} size={[0.07, 0.6, 0.07]} color={C.navyDeep} />
      <B pos={[0.3, -0.62, 0]} size={[0.07, 0.6, 0.07]} color={C.navyDeep} />
      <Cyl rot={[Math.PI / 2, 0, 0]} r={0.66} h={0.1} color={C.red} seg={48} />
      <Cyl rot={[Math.PI / 2, 0, 0]} r={0.6} h={0.14} color={C.navy} seg={48} />
      <Suspense fallback={null}>
        <LogoFace z={0.075} />
        <LogoFace z={-0.075} flip />
      </Suspense>
    </group>
  )
}

function Outdoor() {
  return (
    <group>
      {/* Plaza */}
      <B pos={[0, -0.6, 0]} size={[8.6, 0.22, 7.6]} color="#cfd2de" rough={0.9} />
      <B pos={[0, -0.485, 0]} size={[8.6, 0.03, 7.6]} color={C.grey} rough={0.9} cast={false} />
      <B pos={[0, -0.47, 3.65]} size={[8.6, 0.03, 0.12]} color={C.red} cast={false} />

      <group position={[0, -0.47, 0]}>
        <Tree pos={[3.6, 0, -3.0]} s={1.15} />
        <Tree pos={[-3.7, 0, 3.0]} s={1.0} />
        <Tree pos={[3.9, 0, 3.1]} s={0.8} />
        <StreetLamp pos={[3.6, 0, 2.2]} />
        <Bench pos={[3.8, 0, 0.3]} rotY={-Math.PI / 2} color={C.navy} />
        <Bench pos={[0.3, 0, 3.3]} rotY={Math.PI} color={C.red} />
        {[[-3.8, -3.0, 1], [-3.4, -3.4, 0.7], [-4.0, -2.4, 0.8], [3.2, 3.4, 0.7]].map(([x, z, s]) => (
          <Shrub key={`${x}${z}`} pos={[x, 0.22, z]} s={s} />
        ))}

        {/* Planter di bawah jendela kiri (luar) */}
        <B pos={[-3.4, 0.18, 0.2]} size={[0.4, 0.36, 2.4]} color={C.white} round={0.02} />
        <B pos={[-3.4, 0.28, 0.2]} size={[0.42, 0.06, 2.42]} color={C.navy} />
        {[-0.7, 0.2, 1.1].map((z) => (
          <Plant key={z} pos={[-3.4, 0.36, z]} scale={0.5} leaves={7} tall={0.4} potColor={C.navy} />
        ))}

        <RoofSign />
      </group>
    </group>
  )
}

/* ---------- Rig: naik-turun, tilt halus & kedalaman (kamera diatur OrbitControls) ---------- */
const TARGET = new THREE.Vector3(0, 3.0, 0)
const BASE_CAM = new THREE.Vector3(7.2, 7.6, 10.2) // arah pandang awal (sedikit dari atas)

function Rig({ pointer, children }) {
  const group = useRef()
  const { reduced, mobile } = useContext(MotionCtx)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const t = state.clock.elapsedTime
    const p = pointer.current
    const px = mobile ? 0 : p.x
    const py = mobile ? 0 : p.y
    const near = mobile ? 0 : p.near

    // Naik-turun perlahan
    const bob = reduced ? 0 : Math.sin(t * 1.1) * (mobile ? 0.1 : 0.14)
    g.position.y = THREE.MathUtils.damp(g.position.y, bob, 6, d)
    // Parallax: model sedikit miring mengikuti mouse
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, py * 0.09, 3.5, d)
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -px * 0.06, 3.5, d)
    // Kedalaman: model "maju" sedikit saat mouse mendekat
    const s = 1 + near * 0.06
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, s, 4, d))
  })

  return <group ref={group}>{children}</group>
}

// Atur jarak kamera agar model selalu muat di kanvas (tanpa mengganggu putaran pengguna)
function Fit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    // Muat seluruh bangunan 2 tingkat (bola pembatas R) di kanvas, baik tinggi maupun lebar.
    const R = 5.7
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2
    const tv = Math.tan(vf)
    const th = tv * aspect
    const dist = R / Math.sin(Math.atan(Math.min(tv, th)))
    const dir = camera.position.clone().sub(TARGET).normalize()
    camera.position.copy(TARGET).addScaledVector(dir, dist)
    camera.lookAt(TARGET)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

// Drag untuk memutar 360° (depan ⇄ belakang). Auto-putar pelan saat tidak disentuh.
function Controls() {
  const ref = useRef()
  const { gl } = useThree()
  const { reduced } = useContext(MotionCtx)

  useEffect(() => {
    // Geser vertikal tetap menggulir halaman di layar sentuh; geser horizontal memutar model.
    const apply = () => {
      gl.domElement.style.touchAction = 'pan-y'
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [gl])

  useEffect(() => {
    const c = ref.current
    if (!c) return undefined
    let timer = 0
    const onStart = () => {
      clearTimeout(timer)
      c.autoRotate = false
    }
    const onEnd = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!reduced) c.autoRotate = true
      }, 2500)
    }
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    return () => {
      clearTimeout(timer)
      c.removeEventListener('start', onStart)
      c.removeEventListener('end', onEnd)
    }
  }, [reduced])

  return (
    <OrbitControls
      ref={ref}
      target={TARGET.toArray()}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.85}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2 - 0.02}
      autoRotate={!reduced}
      autoRotateSpeed={1.1}
    />
  )
}

function Lights({ mobile, mixRef }) {
  const amb = useRef()
  const hemi = useRef()
  const dir = useRef()
  const fill = useRef()
  const dayCol = useMemo(() => new THREE.Color('#fff6e6'), [])
  const nightCol = useMemo(() => new THREE.Color('#8ea2ff'), [])

  useFrame(() => {
    const m = mixRef.current
    if (amb.current) amb.current.intensity = 0.55 - 0.47 * m
    if (hemi.current) hemi.current.intensity = 0.6 - 0.52 * m
    if (dir.current) {
      dir.current.intensity = 2.1 - 1.65 * m
      dir.current.color.copy(dayCol).lerp(nightCol, m)
    }
    if (fill.current) fill.current.intensity = 0.55 - 0.46 * m
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.55} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#8a90b8', 0.6]} />
      <directionalLight
        ref={dir}
        position={[5, 8, 6]}
        intensity={2.1}
        castShadow={!mobile}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={11}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight ref={fill} position={[-5, 4, -3]} intensity={0.55} color="#a8b8ff" />
    </>
  )
}

function makeStarTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.35, 'rgba(255,255,255,0.65)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(cv)
}

function scatterStars(n) {
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 30
    arr[i * 3 + 1] = 0.8 + Math.random() * 12
    arr[i * 3 + 2] = -3 - Math.random() * 6
  }
  return arr
}

// Langit: matahari & bulan bergantian terbit/terbenam, bintang muncul saat malam.
// Seluruh kelompok mengikuti arah kamera sehingga selalu berada di belakang bangunan.
/* Awan low-poly (hanya siang; memudar saat malam) */
function Cloud({ pos, s = 1, speed = 0.12, phase = 0 }) {
  const grp = useRef()
  const mats = useRef([])
  const mix = useContext(NightCtx)
  const { reduced } = useContext(MotionCtx)
  const puffs = [
    [0, 0, 0, 0.62, 0.5],
    [0.62, -0.06, 0.05, 0.5, 0.42],
    [-0.62, -0.08, -0.04, 0.46, 0.4],
    [0.25, 0.3, 0, 0.42, 0.36],
    [-0.25, 0.22, 0.1, 0.36, 0.32],
    [1.05, -0.14, 0, 0.3, 0.26],
  ]
  useFrame(({ clock }) => {
    const g = grp.current
    if (!g) return
    const m = mix.current
    g.visible = m < 0.98
    if (!g.visible) return
    if (!reduced) g.position.x = pos[0] + Math.sin(clock.elapsedTime * speed + phase) * 0.45
    mats.current.forEach((mt) => {
      if (mt) mt.opacity = 1 - m
    })
  })
  return (
    <group ref={grp} position={pos} scale={s}>
      {puffs.map(([x, y, z, r, sy], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, sy / r, 0.85]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial
            ref={(el) => (mats.current[i] = el)}
            color="#ffffff"
            emissive="#dfeaff"
            emissiveIntensity={0.45}
            roughness={1}
            flatShading
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Sky({ night, mixRef }) {
  const { camera, invalidate } = useThree()
  const { reduced } = useContext(MotionCtx)
  const sky = useRef()
  const sun = useRef()
  const moon = useRef()
  const starsA = useRef()
  const starsB = useRef()
  const starTex = useMemo(makeStarTexture, [])
  const posA = useMemo(() => scatterStars(260), [])
  const posB = useMemo(() => scatterStars(120), [])
  const R = 5

  // Saat tema berganti, minta render ulang (penting di mode `demand` / reduced-motion)
  useEffect(() => {
    invalidate()
  }, [night, invalidate])

  useEffect(() => () => starTex.dispose(), [starTex])

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    const target = night ? 1 : 0
    mixRef.current = THREE.MathUtils.damp(mixRef.current, target, reduced ? 80 : 2.2, d)
    const m = mixRef.current
    if (Math.abs(m - target) > 0.002) state.invalidate()
    else mixRef.current = target

    if (sky.current) sky.current.rotation.y = Math.atan2(camera.position.x, camera.position.z)

    const aS = 0.75 * Math.PI - m * 0.95 * Math.PI
    const aM = aS + Math.PI
    if (sun.current) {
      sun.current.position.set(Math.cos(aS) * R, 0.2 + Math.sin(aS) * R, 0)
      sun.current.visible = m < 0.97
    }
    if (moon.current) {
      moon.current.position.set(Math.cos(aM) * R, 0.2 + Math.sin(aM) * R, 0)
      moon.current.visible = m > 0.03
    }

    const t = state.clock.elapsedTime
    const tw = reduced ? 0 : 1
    if (starsA.current) starsA.current.material.opacity = Math.max(0, m * 2 - 1) * (0.75 + tw * 0.25 * Math.sin(t * 1.7))
    if (starsB.current) starsB.current.material.opacity = Math.max(0, m * 2 - 1) * (0.8 + tw * 0.2 * Math.sin(t * 2.3 + 1.7))
  })

  return (
    <group ref={sky}>
      <group position={[0, 0, -12]} scale={2}>
        {/* Matahari */}
        <group ref={sun}>
          <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshBasicMaterial color="#ffcf4a" toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.1, 32, 32]} />
            <meshBasicMaterial color="#ffe08a" transparent opacity={0.32} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.7, 32, 32]} />
            <meshBasicMaterial color="#fff0b8" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>

        {/* Awan */}
        <Cloud pos={[2.7, 3.1, -1]} s={1.0} phase={0} />
        <Cloud pos={[-0.9, 1.9, -2]} s={0.8} speed={0.09} phase={2} />
        <Cloud pos={[3.9, 1.2, -3]} s={0.7} speed={0.1} phase={4} />
        <Cloud pos={[-3.9, 0.6, -3]} s={0.6} speed={0.08} phase={1} />

        {/* Bulan */}
        <group ref={moon}>
          <mesh>
            <sphereGeometry args={[0.55, 32, 32]} />
            <meshBasicMaterial color="#eef2ff" toneMapped={false} />
          </mesh>
          {[[-0.18, 0.15, 0.13], [0.2, -0.05, 0.1], [-0.05, -0.25, 0.08]].map(([x, y, r], i) => (
            <mesh key={i} position={[x, y, 0.5]}>
              <circleGeometry args={[r, 20]} />
              <meshBasicMaterial color="#c4cbe6" toneMapped={false} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[1.0, 32, 32]} />
            <meshBasicMaterial color="#9fb4ff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>

        {/* Bintang */}
        <points ref={starsA} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={posA.length / 3} array={posA} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial map={starTex} size={0.2} sizeAttenuation transparent opacity={0} depthWrite={false} color="#ffffff" toneMapped={false} />
        </points>
        <points ref={starsB} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={posB.length / 3} array={posB} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial map={starTex} size={0.34} sizeAttenuation transparent opacity={0} depthWrite={false} color="#cfe0ff" toneMapped={false} />
        </points>
      </group>
    </group>
  )
}

/* Lahan beton/aspal gelap tempat bangunan berdiri (seperti diorama) */
function Ground() {
  return (
    <group>
      <mesh position={[0, -1.0, 0]} receiveShadow>
        <boxGeometry args={[19, 0.5, 19]} />
        <meshStandardMaterial color="#3f414b" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.745, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[19, 19]} />
        <meshStandardMaterial color="#464853" roughness={1} />
      </mesh>
    </group>
  )
}

/* ---------- Komponen utama ---------- */
export default function Cafe3D({ compact = false, fill = false, onError }) {
  const { theme } = useTheme()
  const wrapRef = useRef(null)
  const pointer = useRef({ x: 0, y: 0, near: 0 })
  const [visible, setVisible] = useState(true)
  const [dpr, setDpr] = useState(1.75)
  const [hinted, setHinted] = useState(false)
  const night = theme === 'dark' // hanya mengikuti tombol tema website
  const mixRef = useRef(theme === 'dark' ? 1 : 0)

  const env = useMemo(() => {
    const mq = (q) => window.matchMedia?.(q).matches
    return {
      reduced: !!mq('(prefers-reduced-motion: reduce)'),
      mobile: !!mq('(max-width: 768px), (pointer: coarse)'),
    }
  }, [])

  const onPointerDown = () => setHinted(true)

  // Pointer → parallax (hanya perangkat dengan mouse & tanpa reduced-motion)
  useEffect(() => {
    if (env.reduced || env.mobile) return undefined
    const el = wrapRef.current
    if (!el) return undefined
    let frame = 0
    let last = null
    const compute = () => {
      frame = 0
      if (!last) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const clamp = (v) => Math.max(-1, Math.min(1, v))
      const dist = Math.hypot(last.x - cx, last.y - cy) / (Math.max(r.width, r.height) * 0.75)
      pointer.current.x = clamp((last.x - cx) / (window.innerWidth * 0.5))
      pointer.current.y = clamp((last.y - cy) / (window.innerHeight * 0.5))
      pointer.current.near = 1 - Math.min(1, dist)
    }
    const onMove = (e) => {
      last = { x: e.clientX, y: e.clientY }
      if (!frame) frame = requestAnimationFrame(compute)
    }
    const onLeave = () => {
      last = null
      pointer.current.x = 0
      pointer.current.y = 0
      pointer.current.near = 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [env])

  // Hemat baterai/GPU: berhenti merender saat di luar layar
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const frameloop = !visible ? 'never' : env.reduced ? 'demand' : 'always'

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      className={`cafe3d ${compact ? 'cafe3d-compact' : ''} ${fill ? 'cafe3d-fill' : ''} ${night ? 'is-night' : ''}`}
      role="img"
      aria-label={`Model 3D interior kafe NNORTE, suasana ${night ? 'malam' : 'siang'}`}
    >
      <div className="cafe3d-sky cafe3d-sky-day" aria-hidden="true" />
      <div className="cafe3d-sky cafe3d-sky-night" aria-hidden="true" />
      <Canvas
        className="cafe3d-canvas"
        shadows={!env.mobile}
        dpr={env.mobile ? [1, 1.25] : [1, dpr]}
        frameloop={frameloop}
        camera={{ position: BASE_CAM.toArray(), fov: 36, near: 0.1, far: 120 }}
        gl={{ antialias: !env.mobile, alpha: true, powerPreference: env.mobile ? 'low-power' : 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            onError?.(new Error('WebGL context lost'))
          })
        }}
      >
        <MotionCtx.Provider value={env}>
          <NightCtx.Provider value={mixRef}>
            {!env.mobile && <PerformanceMonitor onDecline={() => setDpr(1)} />}
            <Lights mobile={env.mobile} mixRef={mixRef} />
            <Sky night={night} mixRef={mixRef} />
            <Ground />
            <Fit />
            <Controls />
            <Rig pointer={pointer}>
              <Room />
            </Rig>
          </NightCtx.Provider>
        </MotionCtx.Provider>
      </Canvas>

      {!hinted && (
        <div className="cafe3d-hint" aria-hidden="true">
          <span>↔</span> Geser untuk memutar · lihat depan &amp; belakang
        </div>
      )}
    </div>
  )
}
