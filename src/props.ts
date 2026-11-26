import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CHARACTERS, onDesk, type Character } from './data.ts'
import { LITE } from './device.ts'
import { surface, type Surface } from './surface.ts'

// Utilería y detalles de la oficina. Todo es visual (sin colisiones ni visibilidad) y barato:
// las piezas se añaden a los arrays que main.ts funde después, y solo quedan 4 mallas propias
// (pantallas, cristales, franjas de luz y polvo).

const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, LITE ? 6 : 10)
const ICO = new THREE.IcosahedronGeometry(0.5, 0)

const materials = new Map<number, Surface>()
const material = (color: number): Surface => {
  const cached = materials.get(color)
  if (cached) return cached
  const created = surface(color, 0.7)
  materials.set(color, created)
  return created
}

type Vec3 = readonly [number, number, number]

/** Añade una pieza de color plano; `yaw` gira sobre Y y `rotZ` sobre Z (para cilindros tumbados sobre una pared). */
function put(parts: THREE.Mesh[], geo: THREE.BufferGeometry, color: number, size: Vec3, at: Vec3, yaw = 0, rotZ = 0): void {
  const mesh = new THREE.Mesh(geo, material(color))
  mesh.scale.set(...size)
  mesh.position.set(...at)
  mesh.rotation.set(0, yaw, rotZ)
  parts.push(mesh)
}

const DESK_TOP = 0.75
const WALL_FACE = 0.15 // las paredes miden 0,3 de grosor: la cara interior queda a 0,15
const WIN_W = 1.2
const WIN_Y = 0.75
const WIN_H = 0.7

// ---------- Plantas ----------

/** Planta con maceta de borde, tierra y varias copas de verdes distintos. `top` es la altura de la maceta. */
export function addPlant(parts: THREE.Mesh[], x: number, z: number, top: number): void {
  put(parts, CYL, 0x9a6038, [0.52, 0.06, 0.52], [x, top - 0.03, z]) // borde
  put(parts, CYL, 0x3a2a1c, [0.4, 0.02, 0.4], [x, top + 0.01, z]) // tierra
  put(parts, CYL, 0x5a3a22, [0.06, 0.4, 0.06], [x, top + 0.2, z]) // tallo
  put(parts, ICO, 0x2f8f4e, [0.8, 0.9, 0.8], [x, top + 0.75, z])
  put(parts, ICO, 0x45ad66, [0.5, 0.5, 0.5], [x + 0.2, top + 0.6, z + 0.1])
  put(parts, ICO, 0x23773e, [0.5, 0.55, 0.5], [x - 0.18, top + 0.88, z - 0.1])
  put(parts, ICO, 0x5cbf74, [0.35, 0.35, 0.35], [x + 0.05, top + 1.05, z + 0.15])
}

// ---------- Escritorios ----------

const SCREEN_CELL = 128
const SCREEN_W = 0.46
const SCREEN_H = 0.26
const SCREEN_ROWS = 80 // alto útil de cada celda del atlas (relación 16:10)

/** Atlas 2x2 de pantallas: documento, hoja de cálculo, código y salvapantallas. */
function screenAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SCREEN_CELL * 2
  const g = canvas.getContext('2d')
  if (!g) throw new Error('Canvas 2D no disponible para las pantallas')
  const tile = (i: number, paint: () => void): void => {
    g.save()
    g.translate((i % 2) * SCREEN_CELL, (i >> 1) * SCREEN_CELL)
    g.beginPath()
    g.rect(0, 0, SCREEN_CELL, SCREEN_ROWS)
    g.clip()
    paint()
    g.restore()
  }
  const bar = (color: string, x: number, y: number, w: number, h: number): void => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }
  tile(0, () => { // documento
    bar('#f4f6fa', 0, 0, 128, 80)
    bar('#2b579a', 0, 0, 128, 9)
    bar('#1f3f73', 10, 17, 60, 6)
    for (let y = 30, k = 0; y < 76; y += 6, k++) bar('#b9c0cc', 10, y, k % 4 === 3 ? 60 : 108, 3)
  })
  tile(1, () => { // hoja de cálculo
    bar('#ffffff', 0, 0, 128, 80)
    bar('#1e7145', 0, 0, 128, 9)
    g.fillStyle = '#c8d0c8'
    for (let x = 0; x < 128; x += 20) g.fillRect(x, 9, 1, 71)
    for (let y = 17; y < 80; y += 9) g.fillRect(0, y, 128, 1)
    bar('#cfe2f7', 21, 27, 19, 8)
    bar('#cfe2f7', 41, 36, 19, 8)
    bar('#d9ead3', 81, 45, 39, 8)
    bar('#cfe2f7', 61, 63, 19, 8)
  })
  tile(2, () => { // código
    bar('#1e222a', 0, 0, 128, 80)
    const colors = ['#7ec8e3', '#e5a8ff', '#a6e3a1', '#f2a7a7', '#c7ccd6']
    for (let i = 0, y = 6; y < 76; i++, y += 7) bar(colors[i % colors.length] ?? '#c7ccd6', 8 + ((i * 7) % 3) * 10, y, 22 + ((i * 37) % 60), 3)
  })
  tile(3, () => { // salvapantallas
    bar('#05060c', 0, 0, 128, 80)
    const colors = ['#2ee6d6', '#ff5fa2', '#7cf06a', '#6f8cff']
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = colors[i] ?? '#ffffff'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(10 + i * 12, 70 - i * 6)
      g.lineTo(40 + i * 18, 14 + i * 4)
      g.lineTo(100 - i * 6, 52 - i * 8)
      g.stroke()
    }
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

/** Rectángulo de pantalla ya orientado, con los uv recortados a la celda `variant` del atlas. */
function screenQuad(variant: number, yaw: number, at: Vec3): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)
  const uv = geo.getAttribute('uv')
  const cx = (variant % 2) * SCREEN_CELL
  const cy = (variant >> 1) * SCREEN_CELL
  const size = SCREEN_CELL * 2
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (cx + uv.getX(i) * SCREEN_CELL) / size, 1 - (cy + (1 - uv.getY(i)) * SCREEN_ROWS) / size)
  }
  geo.rotateY(yaw)
  geo.translate(...at)
  return geo
}

/** Monitor, lámpara, post-its, teléfono, bandeja, papeles y cable. Evita los sitios de los objetos robables (levels.ts) y el amarillo. */
function addDesk(parts: THREE.Mesh[], screens: THREE.BufferGeometry[], c: Character, index: number): void {
  const at = (a: number, f: number, y: number): Vec3 => {
    const { x, z } = onDesk(c, [a, f])
    return [x, y, z]
  }
  const front = onDesk(c, [0, 1])
  const origin = onDesk(c, [0, 0])
  const yaw = Math.atan2(front.x - origin.x, front.z - origin.z) // hacia donde mira quien se sienta
  const top = DESK_TOP
  const A = -0.45 // el monitor queda en la mitad opuesta a los objetos

  // Monitor: peana, cuello, marco y pantalla encendida
  put(parts, BOX, 0x2a2d34, [0.2, 0.02, 0.14], at(A, 0, top + 0.01), yaw)
  put(parts, BOX, 0x3a3e46, [0.04, 0.1, 0.03], at(A, 0, top + 0.07), yaw)
  put(parts, BOX, 0x1d1f25, [0.5, 0.3, 0.03], at(A, 0, top + 0.27), yaw)
  screens.push(screenQuad(index % 4, yaw, at(A, 0.017, top + 0.27)))
  // Post-its en el borde del monitor (nada de amarillo: son los marcadores)
  put(parts, BOX, 0xff7eb6, [0.05, 0.05, 0.006], at(A + 0.2, 0.017, top + 0.4), yaw)
  put(parts, BOX, 0x4cc9f0, [0.045, 0.045, 0.006], at(A + 0.14, 0.017, top + 0.425), yaw)
  put(parts, BOX, 0xb8f08a, [0.045, 0.045, 0.006], at(A - 0.21, 0.017, top + 0.2), yaw)
  // Cable del monitor hacia el borde trasero
  put(parts, BOX, 0x15161a, [0.012, 0.012, 0.4], at(A, -0.3, top + 0.006), yaw)
  // Lámpara de brazo en la esquina del monitor
  put(parts, BOX, 0xd0d4d8, [0.1, 0.02, 0.1], at(-0.84, 0.05, top + 0.01), yaw)
  put(parts, BOX, 0xc2c7cd, [0.02, 0.3, 0.02], at(-0.84, 0.05, top + 0.17), yaw)
  put(parts, BOX, 0xe6e9ec, [0.14, 0.03, 0.06], at(-0.8, 0.05, top + 0.32), yaw)
  // Teléfono y bandeja con papeles (zonas libres entre los slots de levels.ts)
  put(parts, BOX, 0x3a3f55, [0.12, 0.04, 0.15], at(0.55, -0.02, top + 0.02), yaw)
  put(parts, BOX, 0x4b5270, [0.13, 0.025, 0.04], at(0.55, -0.02, top + 0.052), yaw)
  put(parts, BOX, 0x5f7f8a, [0.16, 0.04, 0.14], at(0.78, -0.02, top + 0.02), yaw)
  put(parts, BOX, 0xf2f2f2, [0.13, 0.025, 0.1], at(0.78, -0.02, top + 0.052), yaw)
  put(parts, BOX, 0xf2f2f2, [0.2, 0.06, 0.12], at(0.5, -0.43, top + 0.03), yaw) // pila de papeles
  put(parts, BOX, 0xd8dce6, [0.19, 0.01, 0.11], at(0.5, -0.43, top + 0.045), yaw)
}

const WINDOWS_Z = [5, 7.6, 11.2, 29.6, 33.6] as const // ventanas de la pared norte (z = 0)
const WINDOWS_X = [2.4, 9.8, 13.2] as const // ventanas de la pared oeste (x = 0)
const STRIP_DEPTH = 1.9

function addWindow(parts: THREE.Mesh[], glass: THREE.BufferGeometry[], strips: THREE.BufferGeometry[], onXWall: boolean, c: number): void {
  const yaw = onXWall ? Math.PI / 2 : 0
  const pos = (n: number): Vec3 => (onXWall ? [WALL_FACE + n, WIN_Y, c] : [c, WIN_Y, WALL_FACE + n])
  put(parts, BOX, 0xf4f1ea, [WIN_W + 0.1, WIN_H + 0.1, 0.04], pos(0.02), yaw) // marco
  put(parts, BOX, 0xf4f1ea, [0.04, WIN_H, 0.03], pos(0.035), yaw)
  put(parts, BOX, 0xf4f1ea, [WIN_W, 0.04, 0.03], pos(0.035), yaw)
  const pane = new THREE.PlaneGeometry(WIN_W, WIN_H)
  pane.rotateY(yaw)
  pane.translate(...pos(0.042))
  glass.push(pane)
  // Franja de luz sobre el suelo: más intensa pegada a la pared y desvanecida hacia dentro
  const strip = onXWall ? new THREE.PlaneGeometry(STRIP_DEPTH, WIN_W) : new THREE.PlaneGeometry(WIN_W, STRIP_DEPTH)
  strip.rotateX(-Math.PI / 2)
  if (onXWall) strip.translate(WALL_FACE + STRIP_DEPTH / 2, 0.035, c)
  else strip.translate(c, 0.035, WALL_FACE + STRIP_DEPTH / 2)
  const p = strip.getAttribute('position')
  const colors = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const near = (onXWall ? p.getX(i) : p.getZ(i)) < WALL_FACE + STRIP_DEPTH / 2
    colors.set(near ? [0.2, 0.17, 0.1] : [0, 0, 0], i * 3)
  }
  strip.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  strips.push(strip)
}

// ---------- Polvo en el aire (solo GPU potente) ----------

const DUST_PER_WINDOW = 7
let dust: THREE.Points | undefined
let dustBase: Float32Array = new Float32Array(0)

function addDust(scene: THREE.Scene, spots: readonly (readonly [boolean, number])[]): void {
  const base = new Float32Array(spots.length * DUST_PER_WINDOW * 3)
  spots.forEach(([onXWall, c], w) => {
    for (let k = 0; k < DUST_PER_WINDOW; k++) {
      const along = c + (Math.random() - 0.5) * WIN_W
      const depth = WALL_FACE + 0.2 + Math.random() * (STRIP_DEPTH - 0.2)
      base.set(onXWall ? [depth, 0.3 + Math.random() * 1.1, along] : [along, 0.3 + Math.random() * 1.1, depth], (w * DUST_PER_WINDOW + k) * 3)
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
  dustBase = base
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff6dd, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }))
  dust.frustumCulled = false
  scene.add(dust)
}

/** Mece suavemente las motas de polvo; no hace nada en GPU débil. */
export function tickDust(now: number): void {
  if (!dust) return
  const pos = dust.geometry.getAttribute('position')
  const t = now / 1000
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, (dustBase[i * 3 + 1] ?? 0) + Math.sin(t * 0.4 + i) * 0.12)
    pos.setX(i, (dustBase[i * 3] ?? 0) + Math.cos(t * 0.3 + i * 1.7) * 0.05)
  }
  pos.needsUpdate = true
}

// ---------- Oficina ----------

const WALL_METAL = 0xaeb4bc

/** Alfombras, papeleras, extintor, reloj, tablones, ventanas, escritorios y polvo. Llamar tras armar muebles y antes de fundir. */
export function addOffice(solid: THREE.Mesh[], floor: THREE.Mesh[], scene: THREE.Scene): void {
  // Alfombras (borde más oscuro y centro)
  const rug = (cx: number, cz: number, w: number, d: number, edge: number, color: number): void => {
    put(floor, BOX, edge, [w, 0.02, d], [cx, 0.01, cz])
    put(floor, BOX, color, [w - 0.3, 0.024, d - 0.3], [cx, 0.012, cz])
  }
  rug(13.75, 2.7, 6.4, 3.2, 0x2e3447, 0x3f4a63) // bajo la mesa de reuniones
  rug(9.4, 11.6, 6.6, 2.4, 0x3d535e, 0x4f6a78) // sala principal

  // Papeleras
  for (const [x, z] of [[0.5, 4.2], [17.7, 15], [37.4, 12.5]] as const) {
    put(solid, CYL, 0x4a4f58, [0.3, 0.35, 0.3], [x, 0.175, z])
    put(solid, CYL, 0x2c2f35, [0.26, 0.02, 0.26], [x, 0.36, z])
  }

  // Extintor y reloj en la pared oeste (cara que mira a la cámara)
  put(solid, CYL, 0xc0392b, [0.13, 0.4, 0.13], [WALL_FACE + 0.08, 0.3, 11.4])
  put(solid, BOX, 0x1d1f25, [0.06, 0.06, 0.06], [WALL_FACE + 0.08, 0.53, 11.4])
  put(solid, CYL, 0x2a2d33, [0.44, 0.03, 0.44], [WALL_FACE + 0.015, 0.85, 4.2], 0, Math.PI / 2)
  put(solid, CYL, 0xf3f1ea, [0.38, 0.04, 0.38], [WALL_FACE + 0.02, 0.85, 4.2], 0, Math.PI / 2)
  put(solid, BOX, 0x1d1f25, [0.012, 0.14, 0.02], [WALL_FACE + 0.045, 0.91, 4.2])
  put(solid, BOX, 0x1d1f25, [0.012, 0.02, 0.1], [WALL_FACE + 0.045, 0.85, 4.15])

  // Tablón de corcho y pizarra en la pared norte (sala de reuniones)
  put(solid, BOX, WALL_METAL, [0.9, 0.6, 0.03], [9.9, 0.75, WALL_FACE + 0.015])
  put(solid, BOX, 0xc08a55, [0.82, 0.52, 0.035], [9.9, 0.75, WALL_FACE + 0.02])
  put(solid, BOX, 0xff7eb6, [0.12, 0.12, 0.04], [9.65, 0.82, WALL_FACE + 0.03])
  put(solid, BOX, 0x4cc9f0, [0.12, 0.1, 0.04], [9.95, 0.7, WALL_FACE + 0.03])
  put(solid, BOX, 0xf2f2f2, [0.14, 0.18, 0.04], [10.15, 0.83, WALL_FACE + 0.03])
  put(solid, BOX, WALL_METAL, [1.5, 0.64, 0.03], [16.5, 0.75, WALL_FACE + 0.015])
  put(solid, BOX, 0xf7f7f5, [1.42, 0.56, 0.035], [16.5, 0.75, WALL_FACE + 0.02])
  put(solid, BOX, 0x3b6fd1, [0.7, 0.03, 0.04], [16.2, 0.9, WALL_FACE + 0.03])
  put(solid, BOX, 0xd1493b, [0.5, 0.03, 0.04], [16.1, 0.78, WALL_FACE + 0.03])
  put(solid, BOX, 0x3b6fd1, [0.9, 0.03, 0.04], [16.3, 0.66, WALL_FACE + 0.03])

  // Ventanas: marco en las piezas fundidas; cristal y franja de luz en una malla cada una
  const glass: THREE.BufferGeometry[] = []
  const strips: THREE.BufferGeometry[] = []
  for (const x of WINDOWS_Z) addWindow(solid, glass, strips, false, x)
  for (const z of WINDOWS_X) addWindow(solid, glass, strips, true, z)
  const glassMesh = new THREE.Mesh(mergeGeometries(glass), new THREE.MeshBasicMaterial({ color: 0xcfe9ff }))
  const stripMesh = new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  scene.add(glassMesh, stripMesh)
  if (!LITE) addDust(scene, [...WINDOWS_Z.map((c) => [false, c] as const), ...WINDOWS_X.map((c) => [true, c] as const)])

  // Escritorios
  const screens: THREE.BufferGeometry[] = []
  CHARACTERS.forEach((c, i) => addDesk(solid, screens, c, i))
  const screenMesh = new THREE.Mesh(mergeGeometries(screens), new THREE.MeshBasicMaterial({ map: screenAtlas() }))
  scene.add(screenMesh)
}
