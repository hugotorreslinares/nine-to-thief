export interface Box {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface Pt {
  readonly x: number
  readonly z: number
}

export interface Viewer extends Pt {
  /** Ángulo en radianes: dirección = (cos, sin) sobre el plano XZ. */
  readonly dir: number
  readonly range: number
  readonly halfAngle: number
}

export const box = (cx: number, cz: number, w: number, d: number): Box => ({
  minX: cx - w / 2,
  maxX: cx + w / 2,
  minZ: cz - d / 2,
  maxZ: cz + d / 2,
})

export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))

export function turnToward(from: number, to: number, maxStep: number): number {
  const diff = wrapAngle(to - from)
  return Math.abs(diff) <= maxStep ? to : from + Math.sign(diff) * maxStep
}

/** Intervalo [entrada, salida] del rayo en un eje, o null si nunca entra. */
function slab(o: number, d: number, min: number, max: number): readonly [number, number] | null {
  if (Math.abs(d) < 1e-9) return o < min || o > max ? null : [-Infinity, Infinity]
  const t1 = (min - o) / d
  const t2 = (max - o) / d
  return t1 < t2 ? [t1, t2] : [t2, t1]
}

/** Distancia que recorre un rayo unitario hasta la primera caja, con tope `max`. */
export function rayDistance(ox: number, oz: number, dx: number, dz: number, max: number, boxes: readonly Box[]): number {
  let best = max
  for (const b of boxes) {
    const sx = slab(ox, dx, b.minX, b.maxX)
    if (!sx) continue
    const sz = slab(oz, dz, b.minZ, b.maxZ)
    if (!sz) continue
    const enter = Math.max(sx[0], sz[0], 0)
    const exit = Math.min(sx[1], sz[1])
    if (enter <= exit && enter < best) best = enter
  }
  return best
}

export function canSee(v: Viewer, target: Pt, blockers: readonly Box[]): boolean {
  const dx = target.x - v.x
  const dz = target.z - v.z
  const dist = Math.hypot(dx, dz)
  if (dist > v.range) return false
  if (dist < 1e-6) return true
  if (Math.abs(wrapAngle(Math.atan2(dz, dx) - v.dir)) > v.halfAngle) return false
  return rayDistance(v.x, v.z, dx / dist, dz / dist, dist, blockers) >= dist - 1e-6
}

/** Saca un círculo de las cajas que pisa. */
export function resolveCircle(x: number, z: number, r: number, boxes: readonly Box[]): Pt {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      const cx = Math.min(Math.max(x, b.minX), b.maxX)
      const cz = Math.min(Math.max(z, b.minZ), b.maxZ)
      const dx = x - cx
      const dz = z - cz
      const dist = Math.hypot(dx, dz)
      if (dist >= r) continue
      if (dist > 1e-6) {
        x = cx + (dx / dist) * r
        z = cz + (dz / dist) * r
        continue
      }
      // Centro dentro de la caja: salir por la cara más cercana.
      const left = x - b.minX
      const right = b.maxX - x
      const up = z - b.minZ
      const down = b.maxZ - z
      const m = Math.min(left, right, up, down)
      if (m === left) x = b.minX - r
      else if (m === right) x = b.maxX + r
      else if (m === up) z = b.minZ - r
      else z = b.maxZ + r
    }
  }
  return { x, z }
}

/** Zoom máximo de la cámara compartida (1 = vista normal). */
export const MAX_ZOOM = 2.5

/**
 * Cuánto hay que alejar la cámara isométrica para que los dos jugadores quepan, con la cámara en su punto medio.
 * La cámara mira desde (+x, +z) a 30° de elevación: en pantalla, el ancho sale de (dx − dz) y el alto de (dx + dz) / 2.
 */
export function coopZoom(a: Pt, b: Pt, aspect: number, baseView: number, margin = 2.5): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const halfWidth = Math.abs(dx - dz) / (2 * Math.SQRT2)
  const halfHeight = Math.abs(dx + dz) / (4 * Math.SQRT2)
  const need = Math.max((2 * (halfWidth + margin)) / aspect, 2 * (halfHeight + margin))
  return Math.min(MAX_ZOOM, Math.max(1, need / baseView))
}
