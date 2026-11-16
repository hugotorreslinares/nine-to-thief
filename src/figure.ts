import * as THREE from 'three'
import type { Look } from './data.ts'

const SPHERE = new THREE.SphereGeometry(1, 24, 16)
const CAP = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 16)
const BODY = new THREE.CylinderGeometry(0.2, 0.26, 0.45, 16)
const SKIRT = new THREE.CylinderGeometry(0.22, 0.34, 0.28, 16)
const LENS = new THREE.TorusGeometry(0.09, 0.015, 6, 16).rotateY(Math.PI / 2)
// Corona de pelo centrada en la nuca (-x).
const CROWN = new THREE.TorusGeometry(0.34, 0.1, 8, 16, Math.PI * 1.2).rotateZ(Math.PI * 0.4).rotateX(Math.PI / 2)

const HEAD_Y = 1.18
const HIP_Y = 0.36
const SHOULDER_Y = 0.76
const SHOE = 0x1a1a1a
const SHIRT = 0xf4f4f4

type Vec = readonly [number, number, number]

interface Limbs {
  readonly legs: readonly [THREE.Group, THREE.Group]
  readonly arms: readonly [THREE.Group, THREE.Group]
}
const LIMBS = new WeakMap<THREE.Group, Limbs>()

/** Balancea piernas y brazos opuestos; ángulo 0 = quieto. */
export function swingLimbs(fig: THREE.Group, angle: number): void {
  const limbs = LIMBS.get(fig)
  if (!limbs) throw new Error('Figura sin extremidades registradas')
  limbs.legs[0].rotation.z = angle
  limbs.legs[1].rotation.z = -angle
  limbs.arms[0].rotation.z = -angle * 0.8
  limbs.arms[1].rotation.z = angle * 0.8
}

/** Figura cabezona tipo vinilo, ~1,55 m, mirando hacia +x. */
export function buildFigure(look: Look): THREE.Group {
  const g = new THREE.Group()
  const mats = new Map<number, THREE.MeshStandardMaterial>()
  const mat = (color: number): THREE.MeshStandardMaterial => {
    let m = mats.get(color)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
      mats.set(color, m)
    }
    return m
  }
  const part = (geo: THREE.BufferGeometry, color: number, s: Vec, p: Vec, parent: THREE.Object3D = g): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat(color))
    m.scale.set(...s)
    m.position.set(...p)
    m.castShadow = true
    parent.add(m)
    return m
  }
  const pivot = (p: Vec): THREE.Group => {
    const group = new THREE.Group()
    group.position.set(...p)
    g.add(group)
    return group
  }

  const wide = look.wide ?? 1
  const formal = look.tie !== undefined

  // Piernas con zapatos, colgando de la cadera para poder balancearlas.
  const leg = (side: number): THREE.Group => {
    const hip = pivot([0, HIP_Y, side * 0.1])
    part(BOX, look.skirt ? look.skin : look.bottom, [0.15, 0.3, 0.15], [0, -0.15, 0], hip)
    part(BOX, SHOE, [0.24, 0.08, 0.16], [0.04, -0.32, 0], hip)
    return hip
  }

  // Brazos con hombro redondo y mano, colgando del hombro.
  const armZ = 0.24 * wide + 0.07
  const arm = (side: number): THREE.Group => {
    const shoulder = pivot([0, SHOULDER_Y, side * armZ])
    part(SPHERE, look.top, [0.075, 0.075, 0.075], [0, 0, 0], shoulder)
    part(BOX, look.top, [0.1, 0.3, 0.1], [0, -0.16, 0], shoulder)
    part(SPHERE, look.skin, [0.065, 0.065, 0.065], [0, -0.35, 0], shoulder)
    return shoulder
  }
  LIMBS.set(g, { legs: [leg(1), leg(-1)], arms: [arm(1), arm(-1)] })

  // Torso
  part(BODY, look.top, [wide, 1, wide], [0, 0.58, 0])
  if (look.skirt) part(SKIRT, look.bottom, [wide, 1, wide], [0, 0.44, 0])
  else part(CYLINDER, 0x15151a, [0.265 * wide, 0.05, 0.265 * wide], [0, 0.39, 0]) // cinturón
  const chest = 0.21 * wide
  if (formal && look.tie !== undefined) {
    part(BOX, SHIRT, [0.03, 0.3, 0.15], [chest, 0.63, 0])
    part(BOX, look.tie, [0.03, 0.05, 0.07], [chest + 0.02, 0.76, 0]) // nudo
    part(BOX, look.tie, [0.03, 0.24, 0.06], [chest + 0.025, 0.62, 0])
  } else {
    for (const y of [0.7, 0.6, 0.5]) part(SPHERE, SHIRT, [0.018, 0.018, 0.018], [chest + 0.02 * (0.7 - y) * 5 + 0.005, y, 0])
  }
  part(CYLINDER, formal ? SHIRT : look.top, [0.13, 0.05, 0.13], [0, 0.82, 0]) // cuello de la camisa
  part(CYLINDER, look.skin, [0.09, 0.08, 0.09], [0, 0.85, 0])

  // Cabeza
  part(SPHERE, look.skin, [0.4, 0.38, 0.42], [0, HEAD_Y, 0])
  part(SPHERE, look.skin, [0.05, 0.045, 0.05], [0.39, HEAD_Y - 0.06, 0]) // nariz
  for (const side of [1, -1]) {
    part(SPHERE, look.skin, [0.05, 0.09, 0.04], [-0.02, HEAD_Y - 0.01, side * 0.41]) // oreja
    part(SPHERE, 0x111111, [0.06, 0.06, 0.06], [0.345, HEAD_Y + 0.02, side * 0.15])
    part(SPHERE, 0xffffff, [0.018, 0.018, 0.018], [0.398, HEAD_Y + 0.045, side * 0.13]) // brillo del ojo
    part(BOX, look.hair, [0.03, 0.025, 0.13], [0.355, HEAD_Y + 0.13, side * 0.15]).rotation.x = side * 0.15
    if (look.glasses) {
      part(LENS, 0x222222, [1, 1, 1], [0.41, HEAD_Y + 0.02, side * 0.15])
      part(BOX, 0x222222, [0.34, 0.015, 0.015], [0.24, HEAD_Y + 0.03, side * 0.33]) // patilla
    }
  }
  if (look.glasses) part(BOX, 0x222222, [0.015, 0.015, 0.12], [0.415, HEAD_Y + 0.03, 0])
  if (look.mustache) part(BOX, look.hair, [0.04, 0.05, 0.22], [0.385, HEAD_Y - 0.13, 0])
  if (look.beard) part(SPHERE, look.hair, [0.2, 0.16, 0.26], [0.2, HEAD_Y - 0.24, 0])

  // Pelo
  const style = look.hairStyle
  if (style === 'balding') part(CROWN, look.hair, [1, 1, 1], [-0.04, HEAD_Y + 0.08, 0])
  else if (style !== 'bald') {
    const r = style === 'curly' ? 0.46 : 0.43
    part(CAP, look.hair, [r, r, r + 0.02], [-0.03, HEAD_Y + 0.02, 0]).rotation.z = 0.3
    if (style === 'curly') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        part(SPHERE, look.hair, [0.13, 0.13, 0.13], [-0.06 + Math.cos(a) * 0.3, HEAD_Y + 0.3 - Math.cos(a) * 0.08, Math.sin(a) * 0.32])
      }
    } else {
      part(SPHERE, look.hair, [0.16, 0.08, 0.3], [0.25, HEAD_Y + 0.3, 0]) // flequillo
    }
    if (style === 'long') {
      part(SPHERE, look.hair, [0.26, 0.5, 0.42], [-0.22, HEAD_Y - 0.15, 0])
      for (const side of [1, -1]) part(SPHERE, look.hair, [0.1, 0.32, 0.09], [0.1, HEAD_Y - 0.14, side * 0.4]) // mechones
    }
    if (style === 'bun') part(SPHERE, look.hair, [0.14, 0.14, 0.14], [-0.3, HEAD_Y + 0.36, 0])
  }

  g.scale.setScalar(look.scale ?? 1)
  return g
}
