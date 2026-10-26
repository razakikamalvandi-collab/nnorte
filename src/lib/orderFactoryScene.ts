import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Scene mesin 3D untuk Live Order Progress NNORTE.
 *
 * - Foto menu = kartu yang berjalan di conveyor. Posisi kartu HANYA mengikuti
 *   setStatus() (dari database). Tidak ada timer yang memajukan tahap.
 * - Satu animation controller (loop `animate`) memegang semua transform kartu:
 *   perjalanan berbasis waktu (delta time), easing masuk-keluar, lintasan spline.
 * - Tema siang (merah-putih-biru) dan malam (merah-hitam-biru) hanya mengubah
 *   warna material dan cahaya secara halus; geometri dan posisi tidak berubah.
 */
export type SceneStatus =
  | 'pending_payment' | 'received' | 'preparing' | 'ready' | 'serving' | 'completed'
  | 'cancelled' | 'payment_failed'
export type SceneTheme = 'light' | 'dark'

export type SceneItem = { id: string; name: string; qty: number; imageUrl?: string | null; emoji?: string }
export type SceneOptions = {
  items: SceneItem[]
  status: SceneStatus
  theme?: SceneTheme
  tableLabel?: string
  fontFamily?: string
  /** true (default): saat scene dibuat, kartu berjalan dari tahap awal ke tahap terkini. */
  replay?: boolean
  onStageLabel?: (i: number, x: number, y: number, visible: boolean) => void
  /** Semua kartu sudah berhenti setelah perubahan status (dipakai untuk memunculkan rating). */
  onSettled?: (s: SceneStatus) => void
  /** Mesin sedang menggerakkan kartu atau tidak. */
  onRunning?: (running: boolean) => void
  /** Kartu diklik (id item) atau area kosong diklik (null). x,y relatif ke elemen scene. */
  onCardClick?: (id: string | null, x: number, y: number) => void
}
export type SceneApi = {
  setStatus: (s: SceneStatus) => void
  setTheme: (t: SceneTheme) => void
  setCamera: (name: 'overview' | 'side' | 'top' | 'follow') => void
  setPaused: (p: boolean) => void
  selectItem: (id: string | null) => void
  dispose: () => void
}

export const STAGE_OF: Partial<Record<SceneStatus, number>> = {
  received: 0, preparing: 1, ready: 2, serving: 3, completed: 4,
}
export const STAGE_NAMES = ['Pesanan diterima', 'Sedang dimasak', 'Pesanan siap', 'Diantar / diambil', 'Selesai']



// Palet NNORTE: [siang, malam]
const PAL: Record<string, [number, number]> = {
  body: [0xf2f4f8, 0x13151c],
  base: [0xc3cad5, 0x1a1d26],
  edge: [0xa7afba, 0x292d36],
  chrome: [0xe1e5eb, 0x6a7280],
  dark: [0x2b3447, 0x090b10],
  rubber: [0x1a1f2b, 0x0b0d12],
  ivory: [0xffffff, 0x242836],
  red: [0xe53945, 0xff3548],
  blue: [0x246bfd, 0x287bff],
  slat: [0xdde2ea, 0x1b1e28],
}

export function createOrderFactory(root: HTMLElement, opt: SceneOptions): SceneApi {
  const cleanups: Array<() => void> = []
  const W = () => root.clientWidth || 1
  const H = () => root.clientHeight || 1
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  let pixelRatio = Math.min(devicePixelRatio, 1.75)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(W(), H())
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  root.appendChild(renderer.domElement)
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(33, W() / H(), 0.1, 150)
  const controls = new OrbitControls(camera, renderer.domElement)
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.065, enablePan: false, minDistance: 7, maxDistance: 55,
    minPolarAngle: 0.09, maxPolarAngle: Math.PI * 0.475, rotateSpeed: 0.48, zoomSpeed: 0.7,
  })

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pmrem.fromScene(room, 0.04)
  scene.environment = env.texture
  room.dispose(); pmrem.dispose()
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfd6e2, 2.4); scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffffff, 4.6)
  key.position.set(-4, 12, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.5, far: 35 })
  key.shadow.normalBias = 0.035
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xdbe7ff, 3.0); rim.position.set(3, 7, -8); scene.add(rim)
  const accent = new THREE.PointLight(0xdfe8ff, 10, 20, 2); accent.position.set(-4, 5, 3); scene.add(accent)

  // ---------- material & helper geometri ----------
  const mat = (color: number, metalness = 0.1, roughness = 0.4, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })
  const M = {
    body: mat(0xffffff, 0.55, 0.3), base: mat(0xffffff, 0.8, 0.32), edge: mat(0xffffff, 0.85, 0.24),
    chrome: mat(0xffffff, 0.92, 0.18), dark: mat(0xffffff, 0.45, 0.38), rubber: mat(0xffffff, 0.1, 0.6),
    ivory: mat(0xffffff, 0.35, 0.28), red: mat(0xffffff, 0.45, 0.28, { emissive: 0xffffff, emissiveIntensity: 0.1 }),
    blue: mat(0xffffff, 0.4, 0.3, { emissive: 0xffffff, emissiveIntensity: 0.25 }),
    slat: mat(0xffffff, 0.55, 0.35),
    green: mat(0x7fd39b, 0.1, 0.3, { emissive: 0x3fa864, emissiveIntensity: 0.8 }),
  }
  const geos = new Map<string, THREE.BufferGeometry>()
  const boxGeo = (w: number, h: number, d: number, r = 0.04) => {
    const k = `b${w},${h},${d},${r}`
    if (!geos.has(k)) geos.set(k, r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d))
    return geos.get(k) as THREE.BufferGeometry
  }
  const box = (p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = M.body, r = 0.04) => {
    const o = new THREE.Mesh(boxGeo(w, h, d, r), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o
  }
  const cyl = (p: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, m: THREE.Material = M.chrome, r2 = r) => {
    const k = `c${r},${r2},${h}`
    if (!geos.has(k)) geos.set(k, new THREE.CylinderGeometry(r, r2, h, 24))
    const o = new THREE.Mesh(geos.get(k) as THREE.BufferGeometry, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o
  }
  const font = opt.fontFamily || 'system-ui, sans-serif'
  const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d') as CanvasRenderingContext2D; draw(ctx, w, h)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    return { t, c, ctx }
  }
  const txt = (c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#f4f1ea', weight = 600) => {
    c.fillStyle = color; c.font = `${weight} ${size}px ${font}`; c.fillText(s, x, y)
  }
  const plane = (p: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, tex: THREE.Texture, side: THREE.Side = THREE.FrontSide) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side }))
    o.position.set(x, y, z); p.add(o); return o
  }
  const TAU = Math.PI * 2
  // Panel label selalu navy gelap agar terbaca di siang maupun malam.
  const PANEL = '#101a2e'

  // ---------- lantai & pelat ----------
  const machine = new THREE.Group(); scene.add(machine)
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.18 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat)
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.43; floor.receiveShadow = true; scene.add(floor)
  box(machine, 12.8, 0.38, 8.25, 0, -0.09, 0, M.base, 0.17)
  box(machine, 12.6, 0.055, 8.08, 0, 0.13, 0, M.edge, 0.11)
  box(machine, 12.49, 0.09, 7.96, 0, 0.19, 0, M.body, 0.1)
  box(machine, 11.9, 0.03, 0.04, 0, -0.17, 4.12, M.blue, 0.01)
  box(machine, 0.04, 0.03, 7.4, 6.26, -0.17, 0, M.red, 0.01)
  box(machine, 0.04, 0.03, 7.4, -6.26, -0.17, 0, M.red, 0.01)
  for (const x of [-5.6, 5.6]) for (const z of [-3.35, 3.35]) cyl(machine, 0.39, 0.25, x, -0.31, z, M.rubber)
  const engr = canvasTex(1536, 176, (c, w, h) => {
    c.fillStyle = PANEL; c.fillRect(0, 0, w, h)
    c.strokeStyle = '#2b4a8a'; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4)
    txt(c, 'NNORTE', 45, 79, 44, '#ffffff', 700)
    txt(c, 'dapur  ·  kasir  ·  antar ke meja', 285, 79, 34, '#b8c4dc', 450)
    txt(c, 'LIVE ORDER PROGRESS', 47, 133, 19, '#7f93b8', 500)
    txt(c, opt.tableLabel || '', 1300, 130, 26, '#ff5a67')
  })
  const plate = plane(machine, 7.35, 0.84, -0.4, 0.25, 3.51, engr.t); plate.rotation.x = -Math.PI / 2

  // ---------- lima stasiun (urutan sepanjang conveyor = urutan tahap) ----------
  const defs = [
    { name: 'Diterima', pos: [-4.15, 0.29, -0.65], port: [-3.1, -0.1] },
    { name: 'Dapur', pos: [-1.65, 0.29, -2.03], port: [-1.65, -0.7] },
    { name: 'Siap', pos: [1.5, 0.29, -2.08], port: [1.5, -0.7] },
    { name: 'Antar', pos: [4.03, 0.29, 0.12], port: [3.3, 0.19] },
    { name: 'Selesai', pos: [0.93, 0.29, 1.85], port: [0.93, 2.65] },
  ]
  const glowMats: THREE.MeshStandardMaterial[] = []
  const rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = []
  const stGroups = defs.map((d, i) => {
    const g = new THREE.Group(); g.position.set(d.pos[0], d.pos[1], d.pos[2]); machine.add(g)
    const glow = new THREE.MeshStandardMaterial({ color: 0xff3548, metalness: 0.2, roughness: 0.25, emissive: 0xff3548, emissiveIntensity: 0.4 })
    glowMats.push(glow)
    box(g, 2.05, 0.12, 1.78, 0, 0.03, 0, M.dark, 0.1)
    box(g, 1.97, 0.03, 1.7, 0, 0.12, 0, glow, 0.09)
    box(g, 2.03, 0.17, 1.75, 0, 0.215, 0, M.body, 0.1)
    box(g, 1.9, 0.03, 0.03, 0, 0.06, 0.9, M.blue, 0.01)
    const plq = canvasTex(512, 116, (c, w, h) => {
      c.fillStyle = PANEL; c.fillRect(0, 0, w, h)
      txt(c, String(i + 1).padStart(2, '0'), 24, 76, 42, '#ff5a67', 650)
      txt(c, d.name.toUpperCase(), 111, 73, 35, '#ffffff', 650)
    })
    plane(g, 1.54, 0.345, 0, 0.27, 0.891, plq.t)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.86, 56),
      new THREE.MeshBasicMaterial({ color: 0xff3548, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.34; g.add(ring); rings.push(ring)
    return g
  })
  const arrivedAt = defs.map(() => -10)

  // 1 Diterima: kabinet pesanan masuk
  { const g = stGroups[0]
    box(g, 1.75, 1.6, 1.0, 0, 1.12, -0.13, M.body, 0.12); box(g, 1.58, 0.13, 1.09, 0, 1.98, -0.13, M.red, 0.04)
    const t = canvasTex(480, 400, (c, w, h) => { c.fillStyle = PANEL; c.fillRect(0, 0, w, h)
      txt(c, 'PESANAN MASUK', 30, 60, 30, '#ffffff'); txt(c, 'Pembayaran tercatat', 30, 95, 18, '#8fa3c8', 450)
      for (let k = 0; k < 3; k++) { c.fillStyle = '#1b2a48'; c.fillRect(24, 130 + k * 80, 432, 62); txt(c, ['Nasi', 'Minuman', 'Camilan'][k] + ' →', 44, 170 + k * 80, 22, '#e6ecf8', 500) } })
    plane(g, 1.31, 1.09, 0, 1.2, 0.381, t.t) }

  // 2 Dapur: kompor + cerobong + panci + wajan + uap + lampu indikator
  const kitchen = stGroups[1]
  const burnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff3548, emissiveIntensity: 0.1, metalness: 0.3, roughness: 0.4 })
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xff3548, emissive: 0xff3548, emissiveIntensity: 0.1 })
  const pan = new THREE.Group(), pot = new THREE.Group(), lid = new THREE.Group()
  { const g = kitchen
    box(g, 1.9, 0.7, 1.36, 0, 0.67, -0.04, M.body, 0.11); box(g, 1.76, 0.08, 1.27, 0, 1.06, -0.04, M.ivory, 0.04)
    for (const x of [-0.45, 0.45]) { cyl(g, 0.3, 0.05, x, 1.13, 0.1, M.dark); cyl(g, 0.2, 0.02, x, 1.16, 0.1, burnerMat) }
    pot.position.set(-0.45, 1.3, 0.1); g.add(pot)
    cyl(pot, 0.24, 0.26, 0, 0, 0, M.chrome); lid.position.set(0, 0.14, 0); pot.add(lid)
    cyl(lid, 0.25, 0.04, 0, 0, 0, M.chrome); cyl(lid, 0.04, 0.06, 0, 0.05, 0, M.red)
    pan.position.set(0.45, 1.24, 0.1); g.add(pan)
    cyl(pan, 0.27, 0.07, 0, 0, 0, M.dark); box(pan, 0.42, 0.04, 0.07, 0.4, 0, 0, M.chrome, 0.01)
    cyl(g, 0.22, 1.1, -0.55, 1.65, -0.5, M.chrome); box(g, 1.1, 0.2, 0.6, 0, 2.3, -0.5, M.edge, 0.05)
    for (let k = 0; k < 7; k++) box(g, 0.55, 0.027, 0.02, 0, 0.46 + k * 0.05, 0.655, M.dark, 0.003)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), lampMat); lamp.position.set(0.75, 1.5, -0.5); g.add(lamp)
    box(g, 0.08, 0.5, 0.08, 0.75, 1.2, -0.5, M.chrome, 0.01) }
  // uap ringan (hanya saat status benar-benar "sedang dimasak")
  const STEAM_N = 28
  const steamPos = new Float32Array(STEAM_N * 3), steamPhase = new Float32Array(STEAM_N), steamX = new Float32Array(STEAM_N)
  for (let i = 0; i < STEAM_N; i++) { steamPhase[i] = Math.random(); steamX[i] = i < STEAM_N / 2 ? -0.45 : 0.45 }
  const steamGeo = new THREE.BufferGeometry(); steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3))
  const puff = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64) })
  const steamMat = new THREE.PointsMaterial({ map: puff.t, size: 0.6, transparent: true, opacity: 0, depthWrite: false, color: 0x9aa7bd })
  const steam = new THREE.Points(steamGeo, steamMat); steam.frustumCulled = false; kitchen.add(steam)

  // 3 Siap: meja pass dengan lonceng dan lampu hijau
  { const g = stGroups[2]
    box(g, 1.9, 0.62, 1.2, 0, 0.64, 0, M.ivory, 0.1); box(g, 1.96, 0.1, 1.28, 0, 0.98, 0, M.edge, 0.04)
    cyl(g, 0.3, 0.05, 0.5, 1.07, 0.1, M.chrome); cyl(g, 0.25, 0.22, 0.5, 1.2, 0.1, M.chrome, 0.08)
    box(g, 0.1, 0.9, 0.1, -0.8, 1.5, -0.45, M.chrome, 0.02); cyl(g, 0.16, 0.08, -0.8, 2.0, -0.45, M.green) }
  // 4 Antar: troli saji + layar nomor meja
  { const g = stGroups[3]
    box(g, 1.5, 0.12, 0.95, 0, 0.62, 0, M.ivory, 0.04); box(g, 1.5, 0.12, 0.95, 0, 1.05, 0, M.ivory, 0.04)
    for (const x of [-0.65, 0.65]) cyl(g, 0.04, 0.9, x, 0.82, -0.4, M.chrome)
    box(g, 1.2, 0.7, 0.1, 0, 1.9, -0.4, M.dark, 0.04)
    const t = canvasTex(480, 290, (c, w, h) => { c.fillStyle = '#0c1a33'; c.fillRect(0, 0, w, h)
      txt(c, 'ANTAR KE', 30, 70, 28, '#8fa3c8', 500); txt(c, opt.tableLabel || 'MEJA', 30, 190, 80, '#ffffff', 650) })
    plane(g, 1.12, 0.62, 0, 1.9, -0.34, t.t) }
  // 5 Selesai: gerbang centang
  { const g = stGroups[4]
    box(g, 1.9, 0.6, 1.3, 0, 0.64, -0.06, M.ivory, 0.12)
    for (const x of [-0.7, 0.7]) box(g, 0.14, 1.6, 0.14, x, 1.3, -0.1, M.body, 0.03)
    box(g, 1.54, 0.14, 0.14, 0, 2.1, -0.1, M.red, 0.03)
    const t = canvasTex(256, 256, (c) => { c.clearRect(0, 0, 256, 256); c.strokeStyle = '#2f8cff'; c.lineWidth = 22; c.lineCap = 'round'; c.lineJoin = 'round'
      c.beginPath(); c.arc(128, 128, 96, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(80, 130); c.lineTo(115, 165); c.lineTo(180, 92); c.stroke() })
    const chk = plane(g, 0.8, 0.8, 0, 1.3, -0.04, t.t, THREE.DoubleSide); (chk.material ).transparent = true }

  // ---------- conveyor ----------
  const path = new THREE.CatmullRomCurve3(
    ([[-3.95, 0.84, 0.65], [-3.1, 0.84, -0.12], [-1.45, 0.84, -0.79], [1.32, 0.84, -0.8], [3.3, 0.84, 0.19], [3.43, 0.84, 1.21], [1.35, 0.84, 2.7], [-1.4, 0.84, 2.52], [-3.54, 0.84, 1.65]] )
      .map((p) => new THREE.Vector3(...p)), true, 'catmullrom', 0.25)
  const pathLen = path.getLength()
  const WALK_SPEED = 0.5 // satuan/detik (rata-rata). Naikkan untuk jalan lebih cepat.
  const MIN_TRAVEL = 8 // detik: perjalanan antar stasiun tidak pernah lebih singkat dari ini
  const STARTUP = 2.2 // detik: mesin menyala dulu sebelum kartu mulai berjalan
  const belt = new THREE.Group(); machine.add(belt)
  const fm = new THREE.Mesh(new THREE.TubeGeometry(path, 150, 0.35, 8, true), M.dark); fm.scale.y = 0.3; fm.position.y = 0.51; belt.add(fm)
  const BELT_N = 148
  const slats = new THREE.InstancedMesh(boxGeo(0.135, 0.065, 0.63, 0.012), M.slat, BELT_N)
  slats.receiveShadow = true; slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage); belt.add(slats)
  const dummy = new THREE.Object3D(), pv = new THREE.Vector3(), tv = new THREE.Vector3()
  const updateBelt = (t: number) => {
    for (let i = 0; i < BELT_N; i++) {
      const u = (((i / BELT_N + t * 0.012) % 1) + 1) % 1
      path.getPointAt(u, pv); path.getTangentAt(u, tv)
      dummy.position.copy(pv); dummy.rotation.set(0, -Math.atan2(tv.z, tv.x), 0); dummy.updateMatrix(); slats.setMatrixAt(i, dummy.matrix)
    }
    slats.instanceMatrix.needsUpdate = true
  }
  for (const side of [-1, 1]) {
    const pts = []
    for (let i = 0; i <= 160; i++) { path.getPointAt(i / 160, pv); path.getTangentAt(i / 160, tv); pts.push(pv.clone().add(new THREE.Vector3(-tv.z * 0.36 * side, 0.09, tv.x * 0.36 * side))) }
    belt.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.028, 6, false), M.blue))
  }
  for (let i = 0; i < 16; i++) { const p = path.getPointAt(i / 16); cyl(belt, 0.045, 0.43, p.x, 0.53, p.z, M.chrome) }

  const nearest = (x: number, z: number) => {
    let best = 0, dist = Infinity
    for (let i = 0; i < 400; i++) { const p = path.getPointAt(i / 400), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < dist) { dist = d; best = i / 400 } }
    return best
  }
  const ports = defs.map((d) => nearest(d.port[0], d.port[1]))

  // ---------- kartu foto menu ----------
  const CARD_W = 0.62, CARD_H = 0.82
  type Packet = {
    group: THREE.Group; item: SceneItem; u: number; from: number; to: number; t0: number; delay: number; dur: number
    stage: number; appear: boolean; enter: boolean; vanish: number; legs: THREE.Group[]; halo: THREE.Mesh
    tex: ReturnType<typeof canvasTex>; img: HTMLImageElement | null
  }

                                       

                                                                                                         

   
  const paint = (p: Packet) => {
    const { ctx: c, c: cv } = p.tex, w = cv.width, h = cv.height
    c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h)
    const ph = h * 0.74
    if (p.img && p.img.complete && p.img.naturalWidth) {
      const s = Math.max(w / p.img.naturalWidth, ph / p.img.naturalHeight), iw = p.img.naturalWidth * s, ih = p.img.naturalHeight * s
      c.save(); c.beginPath(); c.rect(0, 0, w, ph); c.clip(); c.drawImage(p.img, (w - iw) / 2, (ph - ih) / 2, iw, ih); c.restore()
    } else {
      c.fillStyle = '#e53945'; c.fillRect(0, 0, w, ph); c.font = `${ph * 0.5}px ${font}`; c.textAlign = 'center'; c.fillStyle = '#fff'
      c.fillText(p.item.emoji || '🍽️', w / 2, ph * 0.66); c.textAlign = 'left'
    }
    c.fillStyle = '#101a2e'; c.font = `700 ${w * 0.1}px ${font}`
    let name = p.item.name; while (c.measureText(name).width > w * 0.9 && name.length > 3) name = name.slice(0, -2)
    c.fillText(name === p.item.name ? name : name + '…', w * 0.05, ph + h * 0.1)
    c.fillStyle = '#e53945'; c.font = `700 ${w * 0.12}px ${font}`; c.fillText(`×${p.item.qty}`, w * 0.05, ph + h * 0.2)
    p.tex.t.needsUpdate = true
  }
  const packets = opt.items.map((item) => {
    const group = new THREE.Group(); machine.add(group)
    box(group, CARD_W, CARD_H, 0.05, 0, 0, 0, M.ivory, 0.025)
    const tex = canvasTex(256, 340, () => {})
    plane(group, CARD_W - 0.05, CARD_H - 0.05, 0, 0, 0.028, tex.t, THREE.DoubleSide)
    // Kaki kecil: berayun bergantian saat kartu berjalan
    const legs = [-0.13, 0.13].map((x) => {
      const lg = new THREE.Group(); lg.position.set(x, -CARD_H / 2 + 0.02, 0); group.add(lg)
      cyl(lg, 0.035, 0.16, 0, -0.08, 0, M.chrome); box(lg, 0.1, 0.04, 0.13, 0, -0.17, 0.02, M.red, 0.015)
      return lg
    })
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 40),
      new THREE.MeshBasicMaterial({ color: 0x246bfd, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
    halo.rotation.x = -Math.PI / 2; halo.position.y = -CARD_H / 2 - 0.12; halo.visible = false; group.add(halo)
    group.userData.packet = true
    const p: Packet = { group, item, u: 0, from: 0, to: 0, t0: -1, delay: 0, dur: 2.4, stage: -2, appear: false, enter: false, vanish: -1, legs, halo, tex, img: null }
    if (item.imageUrl) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => paint(p); im.src = item.imageUrl; p.img = im }
    paint(p); return p
  })

  // ---------- jejak rute: titik-titik di sabuk dari stasiun asal ke tujuan ----------
  const TRAIL_N = 140
  const trail = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), TRAIL_N)
  trail.frustumCulled = false; trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage); machine.add(trail)
  const trailPts = Array.from({ length: TRAIL_N }, (_, i) => path.getPointAt(i / TRAIL_N).clone().setY(0.9))
  const trailDummy = new THREE.Object3D(), trailC = new THREE.Color()
  let trailOn = false
  const updateTrail = (lead: Packet | null, t: number) => {
    if (!lead) {
      if (trailOn) { trailOn = false; for (let i = 0; i < TRAIL_N; i++) { trailDummy.scale.setScalar(0.0001); trailDummy.position.copy(trailPts[i]); trailDummy.updateMatrix(); trail.setMatrixAt(i, trailDummy.matrix) } trail.instanceMatrix.needsUpdate = true }
      return
    }
    trailOn = true
    const lo = Math.min(lead.from, lead.to), hi = Math.max(lead.from, lead.to), fwd = lead.to >= lead.from
    for (let i = 0; i < TRAIL_N; i++) {
      const ui = i / TRAIL_N
      trailDummy.position.copy(trailPts[i]); trailDummy.rotation.set(0, 0, 0)
      if (ui < lo || ui > hi) trailDummy.scale.setScalar(0.0001)
      else {
        const ahead = fwd ? ui > lead.u : ui < lead.u
        const pulse = 0.5 + 0.5 * Math.sin(t * 6 - ui * 60)
        trailDummy.scale.setScalar(ahead ? 0.9 + 0.5 * pulse : 0.5)
        trailC.copy(ahead ? M.blue.color : M.red.color)
        if (!ahead) trailC.multiplyScalar(0.7)
        trail.setColorAt(i, trailC)
      }
      trailDummy.updateMatrix(); trail.setMatrixAt(i, trailDummy.matrix)
    }
    trail.instanceMatrix.needsUpdate = true
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true
  }

  // ---------- status → posisi ----------
  let status = opt.status
  let simTime = 0, paused = false, notify = false, userTook = false, follow = false
  const fx = reduceMotion ? 0 : 1 // reduce-motion: tetap berjalan, tanpa putar/hop/getar
  const spacing = 0.026
  const slotU = (stage: number, i: number) => ports[stage] + (i - (packets.length - 1) / 2) * spacing
  const apply = (s: SceneStatus, animate: boolean) => {
    status = s
    userTook = false
    const st = STAGE_OF[s] ?? -1
    packets.forEach((p, i) => {
      if (st < 0) {
        // dibatalkan / gagal bayar: kartu mengecil halus, bukan hilang mendadak
        if (p.stage >= 0) { p.vanish = animate ? simTime : -2; p.t0 = -1 }
        else p.group.visible = false
        p.stage = -1; return
      }
      p.vanish = -1; p.group.visible = true
      const target = slotU(st, i)
      if (!animate) { p.u = p.from = p.to = target; p.t0 = -1; p.appear = false; p.enter = false }
      else if (p.stage < 0) {
        // Kartu masuk BERJALAN dari awal sabuk menuju stasiun pertama (bukan muncul tiba-tiba).
        p.from = p.u = target - 0.12; p.to = target; p.t0 = simTime; p.delay = STARTUP + i * 0.9; p.dur = 6.5
        p.appear = false; p.enter = true
      } else if (p.stage !== st) {
        // Mesin menyala dulu (STARTUP). Jika kartu sudah berjalan lalu status berubah lagi, lanjut tanpa jeda panjang.
        const dist = Math.abs(target - p.u) * pathLen
        const wasMoving = p.t0 >= 0
        p.appear = false; p.enter = false; p.from = p.u; p.to = target; p.t0 = simTime
        p.delay = (wasMoving ? 0.3 : STARTUP) + i * 0.9
        p.dur = THREE.MathUtils.clamp(dist / WALK_SPEED, MIN_TRAVEL, 30)
      }
      p.stage = st
    })
    if (animate) notify = true
  }
  apply(status, false)
  // Saat pelanggan membuka kembali halaman, kartu berjalan dari stasiun pertama ke tahap terkini
  // (bukan langsung muncul di tempat). onSettled dipanggil setelah semua kartu berhenti.
  const startSt = STAGE_OF[status] ?? -1
  if (opt.replay !== false && startSt >= 0) {
    packets.forEach((p, i) => {
      const target = slotU(startSt, i)
      p.t0 = simTime; p.delay = 0.8 + i * 0.5; p.appear = false
      if (startSt === 0) { p.from = p.u = target - 0.12; p.to = target; p.dur = 5; p.enter = true }
      else {
        const from = slotU(0, i)
        p.from = p.u = from; p.to = from + ((((target - from) % 1) + 1) % 1); p.enter = false
        p.dur = THREE.MathUtils.clamp(((p.to - p.from) * pathLen) / 1.1, 5, 16)
      }
    })
    notify = true
  }

  // ---------- tema ----------
  const cA = new THREE.Color(), cB = new THREE.Color(), cT = new THREE.Color()
  let tt = opt.theme === 'dark' ? 1 : 0, ttTarget = tt
  const mix = (pair: [number, number], k: number) => cT.copy(cA.set(pair[0])).lerp(cB.set(pair[1]), k)
  const L = THREE.MathUtils.lerp
  const applyTheme = (k: number) => {
    for (const name of Object.keys(PAL)) {
      const m = (M as unknown as Record<string, THREE.MeshStandardMaterial>)[name]
      m.color.copy(mix(PAL[name], k))
      if (name === 'red') { m.emissive.copy(m.color); m.emissiveIntensity = L(0.1, 0.55, k) }
      if (name === 'blue') { m.emissive.copy(m.color); m.emissiveIntensity = L(0.25, 1.1, k) }
    }
    const red = mix(PAL.red, k).clone()
    glowMats.forEach((g) => { g.color.copy(red); g.emissive.copy(red) })
    rings.forEach((r) => r.material.color.copy(red))
    burnerMat.emissive.copy(red); lampMat.color.copy(red); lampMat.emissive.copy(red)
    hemi.intensity = L(2.4, 1.3, k)
    hemi.color.copy(cA.set(0xffffff).lerp(cB.set(0x3a5aa8), k)); hemi.groundColor.copy(cA.set(0xcfd6e2).lerp(cB.set(0x14161d), k))
    key.intensity = L(4.6, 2.3, k); key.color.copy(cA.set(0xffffff).lerp(cB.set(0xaec4ff), k))
    rim.intensity = L(3.0, 4.8, k); rim.color.copy(cA.set(0xdbe7ff).lerp(cB.set(0x287bff), k))
    accent.intensity = L(10, 34, k); accent.color.copy(cA.set(0xdfe8ff).lerp(cB.set(0xff3548), k))
    scene.environmentIntensity = L(0.9, 0.35, k)
    renderer.toneMappingExposure = L(1.12, 1.05, k)
    floorMat.opacity = L(0.18, 0.45, k)
    steamMat.color.copy(cA.set(0x9aa7bd).lerp(cB.set(0xdbe6ff), k))
  }
  applyTheme(tt)

  // ---------- kamera ----------
  let camMode = 'overview', animating = false, dragging = false
  const goalPos = new THREE.Vector3(), goalTgt = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(10.5, 10.8, 17).normalize()
  let baseDist = 25
  const layout = () => {
    const w = W(), h = H(); renderer.setSize(w, h); camera.aspect = w / h
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    baseDist = Math.max(17.3 / (2 * half * camera.aspect * (w < 700 ? 0.95 : 0.62)), 11.5 / (2 * half * 0.62))
    controls.maxDistance = Math.max(55, baseDist * 1.6); camera.updateProjectionMatrix(); setGoal()
  }
  const setGoal = () => {
    goalTgt.set(0, 1, 0)
    if (camMode === 'side') goalPos.set(13, 5, 20).normalize().multiplyScalar(baseDist).add(goalTgt)
    else if (camMode === 'top') goalPos.set(0.01, baseDist, 0.8).add(goalTgt)
    else if (camMode === 'follow' && packets[0].stage >= 0) { goalTgt.copy(stGroups[packets[0].stage].position).add(new THREE.Vector3(0, 1.2, 0)); goalPos.copy(goalTgt).addScaledVector(dir, 12) }
    else goalPos.copy(dir).multiplyScalar(baseDist).add(goalTgt)
  }
  layout(); camera.position.copy(goalPos); controls.target.copy(goalTgt); controls.update()
  const ro = new ResizeObserver(layout); ro.observe(root); cleanups.push(() => ro.disconnect())
  controls.addEventListener('start', () => { dragging = true; animating = false; userTook = true; follow = false })
  controls.addEventListener('end', () => { dragging = false })

  // ---------- loop (satu-satunya pemegang transform kartu) ----------
  let last = performance.now(), raf = 0, visible = true, lastDraw = 0
  let cook = 0, frames = 0, measure = 0, beltPhase = 0, run = 0, wasRunning = false, selected = -1
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; last = performance.now() }, { threshold: 0.01 })
  io.observe(renderer.domElement); cleanups.push(() => io.disconnect())
  const easeInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2 // lembut: tidak 'melesat' di tengah
  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
  const anchor = new THREE.Vector3()
  const animate = (now: number) => {
    raf = requestAnimationFrame(animate)
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.045)); last = now
    if (!visible) return
    if (!paused) simTime += dt
    const t = simTime

    if (Math.abs(ttTarget - tt) > 0.0005) { tt += (ttTarget - tt) * (1 - Math.exp(-dt * 3.5)); if (Math.abs(ttTarget - tt) <= 0.0005) tt = ttTarget; applyTheme(tt) }
    // sabuk makin cepat saat mesin berjalan
    if (!paused) beltPhase += dt * (0.012 + run * 0.04)
    if (t - lastDraw > 1 / 30) { updateBelt(beltPhase); lastDraw = t }

    const st = STAGE_OF[status] ?? -1
    // mesin menyala: lampu stasiun berlari berurutan, sabuk dipercepat, bodi bergetar tipis
    const moving = packets.some((p) => p.t0 >= 0 && p.stage >= 0)
    run = L(run, moving ? 1 : 0, 1 - Math.exp(-dt * (moving ? 2.2 : 1.2)))
    if (moving !== wasRunning) { wasRunning = moving; opt.onRunning?.(moving) }
    machine.position.y = Math.sin(t * 38) * 0.004 * run * fx
    glowMats.forEach((m, i) => {
      const base = i === st ? 2.6 + Math.sin(t * 3) * 0.5 : 0.4
      m.emissiveIntensity = L(m.emissiveIntensity, base + run * 0.9 * (0.5 + 0.5 * Math.sin(t * 7 - i * 1.2)), 1 - Math.exp(-dt * 8))
    })

    // kartu
    packets.forEach((p, i) => {
      let lift = 0, sc = 1, spin = 0, walk = 0, roll = 0
      if (p.vanish >= 0 || p.vanish === -2) {
        const k = p.vanish === -2 ? 1 : THREE.MathUtils.clamp((t - p.vanish) / 0.6, 0, 1)
        sc = Math.max(1 - easeOut(k), 0.001); lift = easeOut(k) * 0.8
        if (k >= 1) { p.group.visible = false; p.vanish = -1 }
      } else if (p.t0 >= 0 && p.stage >= 0) {
        const k = THREE.MathUtils.clamp((t - p.t0 - p.delay) / p.dur, 0, 1)
        if (p.appear) {
          const e = easeOut(k); lift = (1 - e) * 2.4; sc = Math.max(e, 0.001); spin = (1 - e) * Math.PI
        } else {
          p.u = p.from + (p.to - p.from) * easeInOut(k) // akselerasi lalu melambat di tujuan
          sc = p.enter ? 1.1 * Math.min(1, k / 0.2) + 0.0001 : 1.1   // kartu masuk: membesar di awal jalan
          // Berjalan: hop dan goyang mengikuti jarak tempuh (satu langkah ≈ 0,8 unit), mereda saat berangkat dan tiba.
          const dist = Math.abs(p.to - p.from) * pathLen
          walk = Math.sqrt(Math.sin(k * Math.PI))
          const ph = (p.u * pathLen * TAU) / 0.8
          lift = fx * (Math.sin(k * Math.PI) * 0.4 + Math.abs(Math.sin(ph / 2)) * 0.14 * walk)
          roll = fx * Math.sin(ph) * 0.14 * walk
          // Berputar: satu putaran penuh (lebih panjang untuk jarak jauh), berhenti menghadap depan.
          spin = fx * easeInOut(k) * TAU * Math.max(1, Math.round(dist / 7))
          p.legs[0].rotation.x = Math.sin(ph) * 0.8 * walk; p.legs[1].rotation.x = -Math.sin(ph) * 0.8 * walk
        }
        if (k >= 1) { p.t0 = -1; p.appear = false; arrivedAt[p.stage] = t }
      }
      p.halo.visible = selected === i && p.group.visible
      if (selected === i) { sc *= 1.12; lift += 0.08 + Math.sin(t * 3) * 0.03; p.halo.rotation.z = t }
      const u = ((p.u % 1) + 1) % 1
      path.getPointAt(u, p.group.position)
      path.getTangentAt(u, tv)
      const heading = -Math.atan2(tv.z, tv.x) * 0.15 // sedikit menoleh mengikuti lintasan
      p.group.position.y += 0.6 + lift + Math.sin(t * 1.6 + i) * 0.015
      p.group.rotation.set(0, 0.18 + spin + heading + Math.sin(t * 0.8 + i) * 0.04, roll + Math.sin(t * 1.2 + i) * 0.02 * (p.t0 >= 0 ? 2 : 0.5))
      if (walk === 0) { p.legs[0].rotation.x *= 0.85; p.legs[1].rotation.x *= 0.85 }  // kaki kembali tegak saat berhenti
      p.group.scale.setScalar(sc)
    })

    updateTrail(packets.find((p) => p.t0 >= 0 && !p.appear && p.stage >= 0) ?? null, t)

    // animasi saat tiba: cincin cahaya di stasiun
    rings.forEach((r, i) => {
      const a = (t - arrivedAt[i]) / 1.3
      r.material.opacity = a >= 0 && a < 1 ? (1 - a) * 0.9 : 0
      r.scale.setScalar(1 + Math.max(a, 0) * 0.35)
    })

    // memasak: hanya aktif saat status benar-benar "preparing"
    cook = L(cook, status === 'preparing' && !moving ? 1 : 0, 1 - Math.exp(-dt * 2.5))
    burnerMat.emissiveIntensity = 0.1 + cook * (1.6 + Math.sin(t * 6) * 0.3)
    lampMat.emissiveIntensity = 0.1 + cook * (0.9 + Math.sin(t * 4) * 0.7)
    pan.rotation.z = Math.sin(t * 14) * 0.035 * cook; pan.position.y = 1.24 + Math.abs(Math.sin(t * 9)) * 0.03 * cook
    lid.position.y = 0.14 + Math.abs(Math.sin(t * 11)) * 0.018 * cook
    steamMat.opacity = cook * 0.55
    if (cook > 0.01) {
      for (let i = 0; i < STEAM_N; i++) {
        const k = (t * 0.45 + steamPhase[i]) % 1
        steamPos[i * 3] = steamX[i] + Math.sin(t * 1.5 + i * 2.1) * 0.12 * k
        steamPos[i * 3 + 1] = 1.4 + k * 1.1
        steamPos[i * 3 + 2] = 0.1 + Math.cos(t * 1.2 + i) * 0.1 * k
      }
      steamGeo.attributes.position.needsUpdate = true
    }

    // kamera ikut mendekat ke kartu yang sedang berjalan, lalu kembali ke overview setelah berhenti
    if (camMode === 'overview' && !userTook && fx) {
      if (moving) {
        follow = true
        let n = 0; goalTgt.set(0, 0, 0)
        packets.forEach((p) => { if (p.t0 >= 0 && p.stage >= 0 && !p.appear) { goalTgt.add(p.group.position); n++ } })
        if (n) { goalTgt.multiplyScalar(1 / n); goalTgt.y += 0.3; goalPos.copy(goalTgt).addScaledVector(dir, Math.min(13, baseDist * 0.55)); animating = true }
      } else if (follow) { follow = false; setGoal(); animating = true }
    }
    // kamera
    if (camMode === 'follow' && !dragging) { setGoal(); animating = true }
    if (animating && !dragging) {
      const sp = 1 - Math.exp(-dt * 3)
      camera.position.lerp(goalPos, sp); controls.target.lerp(goalTgt, sp)
      if (camMode !== 'follow' && camera.position.distanceTo(goalPos) < 0.02) animating = false
    }
    controls.autoRotate = !paused && !reduceMotion && !dragging && !animating && camMode === 'overview'
    controls.autoRotateSpeed = 0.24
    controls.update(dt)
    defs.forEach((_, i) => {
      anchor.copy(stGroups[i].position).add(new THREE.Vector3(0, 2.7, 0)).project(camera)
      opt.onStageLabel?.(i, (anchor.x * 0.5 + 0.5) * W(), (-anchor.y * 0.5 + 0.5) * H(), anchor.z < 1)
    })
    renderer.render(scene, camera)

    // semua kartu sudah berhenti → animasi untuk status ini selesai
    if (notify && packets.every((p) => p.t0 < 0 && p.vanish === -1)) { notify = false; opt.onSettled?.(status) }

    // performa: turunkan resolusi bila FPS rendah (geometri & timing tetap sama)
    if (!paused) {
      frames++; measure += dt
      if (measure > 4) {
        if (frames / measure < 40 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio) }
        frames = 0; measure = 0
      }
    }
  }
  // ---------- klik kartu menu ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const pick = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObjects(packets.filter((p) => p.group.visible).map((p) => p.group), true)
    if (!hits.length) return -1
    let o = hits[0].object
    while (o && !o.userData.packet) o = o.parent as THREE.Object3D
    return packets.findIndex((p) => p.group === o)
  }
  let downX = 0, downY = 0, dragged = false
  const dom = renderer.domElement
  const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; dragged = false }
  const onMove = (e: PointerEvent) => {
    if (e.buttons) { if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) dragged = true; return }
    dom.style.cursor = pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab'
  }
  const onUp = (e: PointerEvent) => {
    if (dragged || Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
    const i = pick(e.clientX, e.clientY)
    selected = i
    const rect = root.getBoundingClientRect()
    opt.onCardClick?.(i >= 0 ? packets[i].item.id : null, e.clientX - rect.left, e.clientY - rect.top)
  }
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp)
  cleanups.push(() => { dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp) })

  raf = requestAnimationFrame(animate)

  return {
    setStatus: (s) => apply(s, true),
    setTheme: (th) => { ttTarget = th === 'dark' ? 1 : 0 },
    setCamera: (n) => { camMode = n; animating = true; setGoal() },
    setPaused: (p) => { paused = p },
    selectItem: (id) => { selected = id == null ? -1 : packets.findIndex((p) => p.item.id === id) },
    dispose: () => {
      cancelAnimationFrame(raf); cleanups.forEach((f) => f()); controls.dispose()
      const tx = new Set<THREE.Texture>()
      scene.traverse((o) => {
        const m = o as THREE.Mesh; m.geometry?.dispose?.()
        for (const mm of ([] as THREE.Material[]).concat(m.material ?? [])) { for (const v of Object.values(mm)) if (v instanceof THREE.Texture) tx.add(v); mm.dispose() }
      })
      tx.forEach((x) => x.dispose()); geos.forEach((g) => g.dispose()); env.dispose()
      renderer.dispose(); renderer.domElement.remove()
    },
  }
}
