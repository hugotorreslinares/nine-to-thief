import * as THREE from 'three'
import { LITE } from './device.ts'

/** Chispas y confeti: un solo Points con reserva fija = 1 llamada de dibujo y cero asignaciones por cuadro. */

const POOL = LITE ? 40 : 120
const GRAVITY = 9
const SPARK_COLORS = [0xfde047, 0xffffff, 0x67e8f9] as const
const DUST_COLOR = 0x9ca3af
const CONFETTI_COLORS = [0xfde047, 0xf472b6, 0x67e8f9, 0xa3e635, 0xffffff] as const

const positions = new Float32Array(POOL * 3).fill(-999)
const colors = new Float32Array(POOL * 3)
const velocity = new Float32Array(POOL * 3)
const gravity = new Float32Array(POOL)
const life = new Float32Array(POOL) // segundos restantes; 0 = libre
const total = new Float32Array(POOL)

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
const material = new THREE.PointsMaterial({ size: LITE ? 6 : 7, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true })
export const fx = new THREE.Points(geometry, material)
fx.frustumCulled = false
fx.renderOrder = 10

let cursor = 0
const tint = new THREE.Color()

function spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, seconds: number, pull = GRAVITY): void {
  const i = cursor
  cursor = (cursor + 1) % POOL
  positions.set([x, y, z], i * 3)
  velocity.set([vx, vy, vz], i * 3)
  tint.set(color)
  colors.set([tint.r, tint.g, tint.b], i * 3)
  gravity[i] = pull
  life[i] = seconds
  total[i] = seconds
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Chispas al robar: salen en abanico desde el objeto. */
export function burstSparks(at: THREE.Vector3): void {
  if (LITE) return
  const n = LITE ? 8 : 18
  for (let k = 0; k < n; k++) {
    const a = rand(0, Math.PI * 2)
    const speed = rand(1.5, 4)
    spawn(at.x, at.y, at.z, Math.cos(a) * speed, rand(2, 5), Math.sin(a) * speed, SPARK_COLORS[k % SPARK_COLORS.length] ?? 0xffffff, rand(0.5, 0.9))
  }
}

/** Polvo bajo los pies al correr: sube un poco y se asienta. Se omite en dispositivos lentos. */
export function puffDust(x: number, z: number): void {
  if (LITE) return
  spawn(x + rand(-0.15, 0.15), 0.1, z + rand(-0.15, 0.15), rand(-0.4, 0.4), rand(0.5, 1), rand(-0.4, 0.4), DUST_COLOR, rand(0.3, 0.5), 2)
}

/** Confeti al superar el nivel: lluvia amplia desde arriba del jugador. */
export function burstConfetti(at: THREE.Vector3): void {
  if (LITE) return
  const n = LITE ? 30 : 90
  for (let k = 0; k < n; k++) {
    spawn(at.x + rand(-3, 3), at.y + rand(2, 4), at.z + rand(-3, 3), rand(-1.5, 1.5), rand(1, 4), rand(-1.5, 1.5), CONFETTI_COLORS[k % CONFETTI_COLORS.length] ?? 0xffffff, rand(1.4, 2.4))
  }
}

export function tickFx(dt: number): void {
  let any = false
  for (let i = 0; i < POOL; i++) {
    if (life[i] === 0) continue
    any = true
    life[i] = Math.max(0, (life[i] ?? 0) - dt)
    if (life[i] === 0) {
      positions.set([0, -999, 0], i * 3)
      continue
    }
    velocity[i * 3 + 1] = (velocity[i * 3 + 1] ?? 0) - (gravity[i] ?? GRAVITY) * dt
    for (let a = 0; a < 3; a++) positions[i * 3 + a] = (positions[i * 3 + a] ?? 0) + (velocity[i * 3 + a] ?? 0) * dt
    // Hacia el final de su vida se oscurecen, y sobre el fondo oscuro eso se ve como un desvanecido.
    const fade = Math.min(1, ((life[i] ?? 0) / (total[i] ?? 1)) * 3)
    if (fade < 1) for (let a = 0; a < 3; a++) colors[i * 3 + a] = (colors[i * 3 + a] ?? 0) * (0.85 + 0.15 * fade)
  }
  if (!any) return
  geometry.getAttribute('position').needsUpdate = true
  geometry.getAttribute('color').needsUpdate = true
}
