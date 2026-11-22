import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Look } from './data.ts'
import { LITE } from './device.ts'
import { surface, type Surface } from './surface.ts'

// En GPU débil (LITE) todo se dibuja con muchos menos polígonos.
const RADIAL = LITE ? 8 : 16
const SPHERE = new THREE.SphereGeometry(1, LITE ? 10 : 24, LITE ? 6 : 16)
const CAP = new THREE.SphereGeometry(1, LITE ? 10 : 24, LITE ? 4 : 12, 0, Math.PI * 2, 0, Math.PI * 0.5)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, RADIAL)
const BODY = new THREE.CylinderGeometry(0.2, 0.26, 0.45, RADIAL)
const SKIRT = new THREE.CylinderGeometry(0.22, 0.34, 0.28, RADIAL)
const LENS = new THREE.TorusGeometry(0.09, 0.015, LITE ? 3 : 6, RADIAL).rotateY(Math.PI / 2)
// Corona de pelo centrada en la nuca (-x).
const CROWN = new THREE.TorusGeometry(0.34, 0.1, LITE ? 4 : 8, RADIAL, Math.PI * 1.2).rotateZ(Math.PI * 0.4).rotateX(Math.PI / 2)

const HEADSET_ARC = new THREE.TorusGeometry(0.45, 0.02, LITE ? 3 : 6, RADIAL, Math.PI).rotateY(Math.PI / 2)

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
const MASKS = new WeakMap<THREE.Group, THREE.Group>()
/** Boca y signo de exclamación de las figuras de piezas, para la reacción al ver a un ladrón. */
interface Reaction {
  readonly mouth: THREE.Mesh
  readonly bang: THREE.Group
}
const REACTIONS = new WeakMap<THREE.Group, Reaction>()
// Banda del antifaz: aro tumbado alrededor de la cabeza, para que se vea también de espaldas.
const BAND = new THREE.TorusGeometry(0.41, 0.075, LITE ? 4 : 8, LITE ? 12 : 24).rotateX(Math.PI / 2)
const MASK = 0x16161a

/** Figuras hechas con un modelo 3D: cuerpo de una pieza y, si las trae, dos piernas que se balancean al caminar. */
interface ModelRig {
  readonly lean: THREE.Group
  /** Piernas del modelo (pivote en la cadera); vacío si el modelo no las trae separadas. */
  readonly legs: readonly THREE.Object3D[]
}
const MODELS = new WeakMap<THREE.Group, ModelRig>()

/**
 * Carga un modelo GLB como figura: mira a +x como las demás y mide `height` metros.
 * Devuelve undefined si no se pudo cargar: el juego usa entonces la figura de piezas.
 */
export async function loadModelFigure(url: string, height: number): Promise<THREE.Group | undefined> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url)
    const g = new THREE.Group()
    const lean = new THREE.Group()
    const facing = new THREE.Group()
    facing.rotation.y = Math.PI / 2 // los modelos de Blender miran a +z; las figuras, a +x
    gltf.scene.scale.setScalar(height)
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.castShadow = true
      // En GPU débil, sombreado simple con la misma textura.
      if (LITE && o.material instanceof THREE.MeshStandardMaterial) o.material = new THREE.MeshLambertMaterial({ map: o.material.map })
    })
    facing.add(gltf.scene)
    lean.add(facing)
    g.add(lean)
    const legs = ['leg_l', 'leg_r'].flatMap((name) => gltf.scene.getObjectByName(name) ?? [])
    MODELS.set(g, { lean, legs })
    return g
  } catch (err) {
    console.warn(`No se pudo cargar el modelo ${url}`, err)
    return undefined
  }
}

/** Pone o quita el antifaz de ladrón. */
export function setMask(fig: THREE.Group, on: boolean): void {
  if (MODELS.has(fig)) return // el modelo lleva el antifaz puesto siempre
  const mask = MASKS.get(fig)
  if (!mask) throw new Error('Figura sin antifaz registrado')
  mask.visible = on
}

/** Balancea piernas y brazos opuestos; ángulo 0 = quieto. */
export function swingLimbs(fig: THREE.Group, angle: number): void {
  // Un modelo mueve las piernas desde la cadera (si las trae) y se inclina un poco, como una figura de vinilo.
  const rig = MODELS.get(fig)
  if (rig) {
    rig.lean.rotation.x = angle * 0.1
    const [left, right] = rig.legs
    if (left) left.rotation.x = angle * 0.8
    if (right) right.rotation.x = -angle * 0.8
    return
  }
  const limbs = LIMBS.get(fig)
  if (!limbs) throw new Error('Figura sin extremidades registradas')
  limbs.legs[0].rotation.z = angle
  limbs.legs[1].rotation.z = -angle
  limbs.arms[0].rotation.z = -angle * 0.8
  limbs.arms[1].rotation.z = angle * 0.8
}

/** Sorpresa de 0 (nada) a 1 (alarmado): abre la boca, levanta los brazos y muestra un "!" que rebota. No afecta a los modelos 3D. */
export function reactFigure(fig: THREE.Group, k: number, clock: number): void {
  const reaction = REACTIONS.get(fig)
  const limbs = LIMBS.get(fig)
  if (!reaction || !limbs) return
  reaction.mouth.scale.y = 0.012 + 0.05 * k
  reaction.bang.visible = k > 0.3
  reaction.bang.position.y = HEAD_Y + 0.62 + Math.abs(Math.sin(clock * 9)) * 0.06
  if (k > 0.01) for (const arm of limbs.arms) arm.rotation.z = 2.3 * k + Math.sin(clock * 20) * 0.1 * k
}

/** Figura cabezona tipo vinilo, ~1,55 m, mirando hacia +x. */
export function buildFigure(look: Look): THREE.Group {
  const g = new THREE.Group()
  const mats = new Map<number, Surface>()
  const mat = (color: number): Surface => {
    let m = mats.get(color)
    if (!m) {
      m = surface(color, 0.4)
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
    if (look.loot) {
      if (side > 0) {
        // Engrapador en la mano: base oscura y tapa amarilla.
        part(BOX, 0x2f2f33, [0.3, 0.07, 0.13], [0.15, -0.37, 0], shoulder)
        part(BOX, 0xf2c015, [0.32, 0.08, 0.14], [0.15, -0.3, 0], shoulder).rotation.z = 0.14
      } else {
        // Carpeta de cartón bajo el brazo.
        part(BOX, 0xd9b98a, [0.26, 0.34, 0.045], [0.14, -0.27, 0.05], shoulder)
        part(BOX, 0xc8a574, [0.26, 0.04, 0.047], [0.14, -0.11, 0.05], shoulder) // pestaña
      }
    }
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

  // Boca (se abre al asustarse) y "!" sobre la cabeza.
  const mouth = part(SPHERE, 0x5a1d1d, [0.025, 0.012, 0.05], [0.385, HEAD_Y - 0.12, 0])
  const bang = new THREE.Group()
  bang.visible = false
  g.add(bang)
  part(BOX, 0xff3b30, [0.07, 0.2, 0.07], [0, 0.07, 0], bang)
  part(SPHERE, 0xff3b30, [0.05, 0.05, 0.05], [0, -0.08, 0], bang)
  REACTIONS.set(g, { mouth, bang })

  // Accesorios
  for (const item of look.gear ?? []) {
    if (item === 'earrings') for (const side of [1, -1]) part(SPHERE, 0xd4af37, [0.025, 0.04, 0.025], [-0.02, HEAD_Y - 0.12, side * 0.42])
    else if (item === 'lanyard') {
      for (const side of [1, -1]) part(BOX, 0xd62828, [0.02, 0.4, 0.03], [chest + 0.02, 0.64, side * 0.08]).rotation.x = side * 0.18
      part(BOX, 0xffffff, [0.02, 0.12, 0.09], [chest + 0.03, 0.43, 0])
    } else if (item === 'headset') {
      part(HEADSET_ARC, 0x2b2b30, [1, 1, 1], [0, HEAD_Y, 0])
      for (const side of [1, -1]) part(BOX, 0x2b2b30, [0.07, 0.15, 0.1], [-0.02, HEAD_Y, side * 0.45])
    } else if (item === 'cap') {
      part(CAP, 0x1d4ed8, [0.43, 0.43, 0.44], [-0.02, HEAD_Y + 0.06, 0])
      part(BOX, 0x1d4ed8, [0.22, 0.025, 0.34], [0.4, HEAD_Y + 0.17, 0])
    } else if (item === 'scarf') {
      part(CYLINDER, 0xe11d48, [0.17, 0.07, 0.17], [0, 0.82, 0])
      part(BOX, 0xe11d48, [0.04, 0.28, 0.09], [chest + 0.03, 0.64, 0.09])
    } else {
      for (const side of [1, -1]) part(BOX, 0xe11d48, [0.03, 0.06, 0.07], [chest + 0.02, 0.78, side * 0.06]).rotation.x = side * 0.5
      part(SPHERE, 0xe11d48, [0.025, 0.025, 0.025], [chest + 0.03, 0.78, 0])
    }
  }

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

  // Antifaz de ladrón, oculto hasta que roba: banda negra con los ojos asomando y nudo en la nuca.
  const mask = new THREE.Group()
  mask.visible = false
  g.add(mask)
  MASKS.set(g, mask)
  part(BAND, MASK, [1.02, 0.95, 1.08], [0, HEAD_Y + 0.02, 0], mask)
  part(SPHERE, MASK, [0.07, 0.07, 0.07], [-0.56, HEAD_Y + 0.02, 0], mask)
  for (const side of [1, -1]) part(BOX, MASK, [0.05, 0.26, 0.09], [-0.6, HEAD_Y - 0.1, side * 0.07], mask).rotation.x = side * 0.35
  for (const side of [1, -1]) {
    part(SPHERE, 0xffffff, [0.03, 0.05, 0.06], [0.49, HEAD_Y + 0.02, side * 0.15], mask)
    part(SPHERE, 0x111111, [0.02, 0.025, 0.028], [0.513, HEAD_Y + 0.015, side * 0.15], mask)
  }

  g.scale.setScalar(look.scale ?? 1)
  return g
}
