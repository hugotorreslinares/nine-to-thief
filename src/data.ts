import { LEVELS } from './levels.ts'
import { box, type Box, type Pt } from './logic.ts'

export type Hair = 'short' | 'bald' | 'balding' | 'long' | 'bun' | 'curly'

export interface Look {
  readonly skin: number
  readonly hair: number
  readonly hairStyle: Hair
  readonly top: number
  readonly bottom: number
  readonly tie?: number
  readonly glasses?: boolean
  readonly beard?: boolean
  readonly mustache?: boolean
  readonly skirt?: boolean
  readonly scale?: number
  readonly wide?: number
}

export type Effect =
  | { readonly kind: 'lure'; readonly radius: number; readonly seconds: number; readonly at: 'self' | 'conference' }
  | { readonly kind: 'freeze'; readonly radius: number; readonly seconds: number }
  | { readonly kind: 'blind'; readonly radius: number; readonly seconds: number; readonly factor: number }
  | { readonly kind: 'cloak'; readonly seconds: number }
  | { readonly kind: 'dash'; readonly seconds: number; readonly factor: number }
  | { readonly kind: 'time'; readonly seconds: number }

export interface Character {
  readonly id: string
  readonly name: string
  readonly look: Look
  readonly home: Pt & { readonly dir: number }
  /** Escritorio: centro x, centro z, ancho, fondo. */
  readonly desk: readonly [number, number, number, number]
  /** Multiplicadores pasivos (1 = normal). */
  readonly speed?: number
  readonly grabTime?: number
  /** Escala del alcance de visión de los demás contra este personaje. */
  readonly visibility?: number
  /** Segundos que pueden verlo robando antes de dar la alarma. */
  readonly grace?: number
  readonly ability: {
    readonly name: string
    readonly text: string
    readonly cooldown?: number
    readonly effect?: Effect
  }
}

const S = Math.PI / 2
const SKIN = 0xf1c9a5
const desk = (x: number, z: number): readonly [number, number, number, number] => [x, z, 1.8, 1]

export const CHARACTERS: readonly Character[] = [
  {
    id: 'michael', name: 'Michael', home: { x: 6, z: 1.1, dir: S }, desk: [6, 2.2, 2.4, 1.2],
    look: { skin: SKIN, hair: 0x2b2118, hairStyle: 'short', top: 0x2f3640, bottom: 0x2f3640, tie: 0x8e2430 },
    ability: { name: '¡Reunión!', text: 'Todos miran hacia la sala de reuniones 4 s.', cooldown: 18, effect: { kind: 'lure', radius: 10, seconds: 4, at: 'conference' } },
  },
  {
    id: 'dwight', name: 'Dwight', home: { x: 10.1, z: 10.2, dir: -S }, desk: desk(10.1, 9.2),
    look: { skin: SKIN, hair: 0x5a4630, hairStyle: 'short', top: 0xc9a227, bottom: 0x5b4a32, tie: 0x6b4f1d, glasses: true },
    ability: { name: 'Poder de remolacha', text: 'Corre 80 % más rápido durante 3 s.', cooldown: 14, effect: { kind: 'dash', seconds: 3, factor: 1.8 } },
  },
  {
    id: 'jim', name: 'Jim', home: { x: 10.1, z: 7.2, dir: S }, desk: desk(10.1, 8.2),
    look: { skin: SKIN, hair: 0x4a3624, hairStyle: 'short', top: 0xdfe6f0, bottom: 0x3a3f4a, tie: 0x35507a, scale: 1.08 },
    ability: { name: 'Mirada a cámara', text: 'Congela a los que están cerca 3,5 s.', cooldown: 18, effect: { kind: 'freeze', radius: 6, seconds: 3.5 } },
  },
  {
    id: 'pam', name: 'Pam', home: { x: 3.6, z: 10.2, dir: -S }, desk: [3.6, 9.2, 2.6, 1],
    look: { skin: SKIN, hair: 0xa9643a, hairStyle: 'long', top: 0xf2c6cf, bottom: 0x6b6f7a, skirt: true },
    grabTime: 0.6,
    ability: { name: 'Manos de recepcionista', text: 'Pasiva: roba 40 % más rápido.' },
  },
  {
    id: 'ryan', name: 'Ryan', home: { x: 32.8, z: 11.6, dir: -S }, desk: desk(32.8, 10.6),
    look: { skin: SKIN, hair: 0x1e1a17, hairStyle: 'short', top: 0x1f1f24, bottom: 0x1f1f24, tie: 0x555555, beard: true },
    ability: { name: 'WUPHF', text: 'Toda la oficina mira el celular: ven la mitad 3,5 s.', cooldown: 20, effect: { kind: 'blind', radius: Infinity, seconds: 3.5, factor: 0.5 } },
  },
  {
    id: 'kelly', name: 'Kelly', home: { x: 32.8, z: 8.6, dir: S }, desk: desk(32.8, 9.6),
    look: { skin: 0xb9825a, hair: 0x15110f, hairStyle: 'long', top: 0xe84393, bottom: 0xe84393, skirt: true, scale: 0.92 },
    ability: { name: 'Chisme', text: 'Los cercanos miran donde soltó el chisme 4 s.', cooldown: 15, effect: { kind: 'lure', radius: 8, seconds: 4, at: 'self' } },
  },
  {
    id: 'toby', name: 'Toby', home: { x: 36, z: 16.5, dir: -S }, desk: desk(36, 15.5),
    look: { skin: SKIN, hair: 0xa08060, hairStyle: 'short', top: 0xc8b79a, bottom: 0x6e5e48, tie: 0x7a6a50 },
    grace: 0.7,
    ability: { name: 'Nadie mira a Toby', text: 'Pasiva: tardan 0,7 s en notar que roba.' },
  },
  {
    id: 'angela', name: 'Angela', home: { x: 2.6, z: 12.2, dir: S }, desk: desk(2.6, 13.2),
    look: { skin: SKIN, hair: 0xe8d48a, hairStyle: 'bun', top: 0x9aa5b1, bottom: 0x555c66, skirt: true, scale: 0.86 },
    visibility: 0.75,
    ability: { name: 'Bajo perfil', text: 'Pasiva: la ven 25 % menos lejos.' },
  },
  {
    id: 'oscar', name: 'Oscar', home: { x: 2.6, z: 15.2, dir: -S }, desk: desk(2.6, 14.2),
    look: { skin: 0xc99a72, hair: 0x1a1614, hairStyle: 'short', top: 0x7fa1c9, bottom: 0x3b3b44, tie: 0x2c3e50 },
    ability: { name: 'En realidad…', text: 'Una vez por nivel: +10 s de tiempo.', cooldown: 999, effect: { kind: 'time', seconds: 10 } },
  },
  {
    id: 'kevin', name: 'Kevin', home: { x: 5.3, z: 13.7, dir: Math.PI }, desk: [4.2, 13.7, 1, 1.8],
    look: { skin: SKIN, hair: 0x6b5a48, hairStyle: 'balding', top: 0x556b5a, bottom: 0x3b3b3b, tie: 0x7a2e2e, wide: 1.35 },
    speed: 0.85,
    ability: { name: 'Chili derramado', text: 'Los cercanos miran el piso: ven 60 % menos 5 s. Es lento.', cooldown: 18, effect: { kind: 'blind', radius: 7, seconds: 5, factor: 0.4 } },
  },
  {
    id: 'stanley', name: 'Stanley', home: { x: 14.2, z: 7.2, dir: S }, desk: desk(14.2, 8.2),
    look: { skin: 0x6b4a36, hair: 0x222222, hairStyle: 'balding', top: 0xd8d2c4, bottom: 0x4a4036, tie: 0x7b3f2a, glasses: true, mustache: true, wide: 1.25 },
    ability: { name: '¿Acaso tartamudeé?', text: 'Congela a toda la oficina 2 s.', cooldown: 25, effect: { kind: 'freeze', radius: Infinity, seconds: 2 } },
  },
  {
    id: 'phyllis', name: 'Phyllis', home: { x: 14.2, z: 10.2, dir: -S }, desk: desk(14.2, 9.2),
    look: { skin: SKIN, hair: 0x9c5a3c, hairStyle: 'curly', top: 0x8e6bb0, bottom: 0x5a4a6a, skirt: true, wide: 1.25 },
    visibility: 0.85, grabTime: 0.8,
    ability: { name: 'Inofensiva', text: 'Pasiva: la ven 15 % menos lejos y roba 20 % más rápido.' },
  },
  {
    id: 'creed', name: 'Creed', home: { x: 9.2, z: 14, dir: S }, desk: desk(9.2, 15),
    look: { skin: SKIN, hair: 0xcfcfcf, hairStyle: 'balding', top: 0x6f7f6a, bottom: 0x444444, tie: 0x333333 },
    ability: { name: '¿Quién es Creed?', text: 'Invisible para todos durante 3 s.', cooldown: 18, effect: { kind: 'cloak', seconds: 3 } },
  },
  {
    id: 'meredith', name: 'Meredith', home: { x: 11, z: 16, dir: -S }, desk: desk(11, 15),
    look: { skin: SKIN, hair: 0xb5452c, hairStyle: 'long', top: 0x3f7f6f, bottom: 0x333333, skirt: true },
    ability: { name: 'Happy hour', text: 'Corre 45 % más rápido durante 5 s.', cooldown: 16, effect: { kind: 'dash', seconds: 5, factor: 1.45 } },
  },
  {
    id: 'andy', name: 'Andy', home: { x: 8.3, z: 7.2, dir: S }, desk: desk(8.3, 8.2),
    look: { skin: SKIN, hair: 0x5b4028, hairStyle: 'short', top: 0xf3e9c9, bottom: 0xaa3333, tie: 0x2e5d9f },
    ability: { name: 'Serenata a capela', text: 'Los cercanos miran donde cantó 3 s. Recarga corta.', cooldown: 10, effect: { kind: 'lure', radius: 10, seconds: 3, at: 'self' } },
  },
  {
    id: 'darryl', name: 'Darryl', home: { x: 16, z: 16.3, dir: -S }, desk: desk(16, 15.3),
    look: { skin: 0x5a3d2b, hair: 0x15110f, hairStyle: 'bald', top: 0x35507a, bottom: 0x2b2b2b, beard: true, scale: 1.1 },
    speed: 1.15, grabTime: 0.85,
    ability: { name: 'Paso de bodega', text: 'Pasiva: 15 % más rápido y roba 15 % más rápido.' },
  },
]

// ---------- Oficina (metros; x hacia la derecha, z hacia abajo) ----------
// Sigue el plano de la serie a 1 m ≈ 20 px. De izquierda a derecha: la sala principal con el
// vestíbulo, la oficina de Michael y la sala de reuniones arriba; el bloque central con la
// escalera, la cocina (que conecta ambos lados) y los baños; y a la derecha el anexo con el
// comedor arriba. La escalera y los baños están cerrados: son decorado.

export const MAP = { w: 38, d: 17.5 } as const
export const SPAWN: Pt = { x: 1.5, z: 2 }
export const CONFERENCE: Pt = { x: 13.75, z: 2.7 }

export const ROOMS: readonly { readonly box: Box; readonly color: number }[] = [
  { box: box(1.5, 2.375, 3, 4.75), color: 0x6f7480 }, // vestíbulo
  { box: box(6.05, 2.375, 6.1, 4.75), color: 0x6f7f95 }, // oficina de Michael
  { box: box(13.675, 2.375, 9.15, 4.75), color: 0x8c8474 }, // sala de reuniones
  { box: box(9.125, 11.125, 18.25, 12.75), color: 0x7f8793 }, // sala principal
  { box: box(23.25, 3.25, 10, 6.5), color: 0x4a4d55 }, // escalera
  { box: box(23.25, 8.625, 10, 4.25), color: 0xb9b4a6 }, // cocina
  { box: box(23.25, 14.125, 10, 6.75), color: 0x9fb3b8 }, // baños
  { box: box(30, 3.25, 3.5, 6.5), color: 0x7f8793 }, // pasillo del anexo
  { box: box(34.875, 3.25, 6.25, 6.5), color: 0x8f9a8a }, // comedor
  { box: box(33.125, 12, 9.75, 11), color: 0x97907d }, // anexo
]

const T = 0.3
const hWall = (x1: number, x2: number, z: number): Box => box((x1 + x2) / 2, z, x2 - x1 + T, T)
const vWall = (x: number, z1: number, z2: number): Box => box(x, (z1 + z2) / 2, T, z2 - z1 + T)

export const WALLS: readonly Box[] = [
  hWall(0, 38, 0), hWall(0, 38, 17.5), vWall(0, 0, 17.5), vWall(38, 0, 17.5),
  // vestíbulo, oficina de Michael y sala de reuniones: una puerta cada uno hacia la sala principal
  vWall(3, 0, 4.75), vWall(9.1, 0, 4.75),
  hWall(0, 1, 4.75), hWall(2.4, 7.5, 4.75), hWall(8.9, 9.3, 4.75), hWall(10.7, 18.25, 4.75),
  // despacho de la esquina
  vWall(13.25, 13, 17.5), hWall(13.25, 14.4, 13), hWall(15.8, 18.25, 13),
  // bloque central: la cocina es el único paso entre la sala principal y el anexo
  vWall(18.25, 0, 8.8), vWall(18.25, 10.2, 17.5),
  vWall(28.25, 0, 8.8), vWall(28.25, 10.2, 17.5),
  hWall(18.25, 28.25, 6.5), hWall(18.25, 28.25, 10.75), vWall(23.25, 10.75, 17.5),
  // comedor
  vWall(31.75, 0, 6.5), hWall(31.75, 32, 6.5), hWall(33.4, 38, 6.5),
]

export type FurnitureKind = 'desk' | 'block' | 'plant' | 'copier' | 'cooler'

export interface Furniture {
  readonly box: Box
  readonly h: number
  readonly color: number
  readonly kind: FurnitureKind
  /** Suficientemente alto para tapar la vista. */
  readonly sight?: boolean
}

const block = (cx: number, cz: number, w: number, d: number, h: number, color: number, sight = false, kind: FurnitureKind = 'block'): Furniture =>
  ({ box: box(cx, cz, w, d), h, color, kind, sight })

const COLUMN = 0xd8d2c2
const CABINET = 0x9aa0a6
const WOOD = 0x4b3a2a
const TABLE = 0xc9c2b0
const plant = (x: number, z: number): Furniture => block(x, z, 0.45, 0.45, 0.4, 0x7a4a2a, false, 'plant')

export const FURNITURE: readonly Furniture[] = [
  ...CHARACTERS.map((c): Furniture => ({ box: box(...c.desk), h: 0.75, color: 0x8a6a48, kind: 'desk' })),
  // sala de reuniones y oficina de Michael
  block(13.75, 2.7, 5, 1.8, 0.75, 0x5c4630), // mesa de reuniones
  block(13.75, 0.45, 2.4, 0.4, 0.7, WOOD), // aparador
  block(3.5, 2.4, 0.6, 2, 1.7, WOOD, true), // estante de Michael
  // sala principal
  block(3, 11.4, 5.4, 0.25, 1, CABINET), // mampara entre recepción y contabilidad
  block(17.6, 11.5, 1, 1.4, 1.1, 0xd9d9d9, false, 'copier'),
  block(14, 5.2, 3, 0.7, 1.2, CABINET), block(3.8, 5.25, 2.4, 0.6, 1.2, CABINET), // archivadores
  block(9, 17.1, 2.4, 0.6, 1.8, 0x70777f, true), // armario alto
  block(17.7, 8.2, 0.5, 0.5, 0.9, 0xf2f2f2, false, 'cooler'),
  block(5.9, 11.4, 0.5, 0.5, 2.4, COLUMN, true), block(12.9, 12.4, 0.5, 0.5, 2.4, COLUMN, true),
  block(1, 6.6, 0.9, 2.2, 0.45, 0x2f6f73), block(0.45, 6.6, 0.3, 2.2, 0.95, 0x285e62), // sofá: asiento y espaldar
  // escalera (cerrada): peldaños
  ...[0, 1, 2, 3, 4, 5].map((i) => block(20.75 + i, 3.25, 0.9, 4.6, 0.15 * (i + 1), 0x5a5d66)),
  // cocina
  block(21.5, 6.95, 5, 0.6, 0.9, 0xdedede), // mesón
  block(24.9, 7.1, 0.9, 0.9, 1.9, 0xe9edf0, true), // nevera
  block(26.4, 8.2, 1.3, 1.3, 0.75, TABLE), // mesita
  // baños (cerrados): lavamanos e inodoros
  block(19.4, 11.3, 1.4, 0.5, 0.85, 0xf2f2f2), block(22.4, 16.8, 0.5, 0.7, 0.45, 0xf2f2f2),
  block(24.4, 11.3, 1.4, 0.5, 0.85, 0xf2f2f2), block(27.4, 16.8, 0.5, 0.7, 0.45, 0xf2f2f2),
  // anexo
  block(31.2, 1.5, 0.7, 2.4, 1.2, CABINET), // archivadores del pasillo
  block(28.9, 14.5, 0.7, 3.5, 1.8, WOOD, true), // estantes
  block(33.4, 15.2, 0.6, 2.6, 1.8, WOOD, true), // estantes que aíslan a Toby
  // comedor
  block(35, 1.75, 1.4, 1.4, 0.75, TABLE), block(33, 3.5, 1.4, 1.4, 0.75, TABLE), block(35, 5, 1.4, 1.4, 0.75, TABLE),
  block(37.3, 1.3, 1, 1.6, 2, 0xb03a2e, true), // máquina de snacks
  block(37.3, 3.1, 1, 1.6, 2, 0x2e5fb0, true), // máquina de bebidas
  plant(0.6, 0.6), plant(0.6, 8.3), plant(0.6, 16.9), plant(17.6, 5.3), plant(17.7, 12.5), plant(17.7, 16.9),
  plant(29, 0.6), plant(37.4, 7.1), plant(37.4, 16.9),
]

export const CHAIR_R = 0.3

/** Sillas con ruedas que el jugador puede empujar. `dir` es hacia dónde miran. */
export const CHAIRS: readonly (Pt & { readonly dir: number })[] = [
  // sala de reuniones
  { x: 12.3, z: 1.35, dir: S }, { x: 13.75, z: 1.35, dir: S }, { x: 15.2, z: 1.35, dir: S },
  { x: 12.3, z: 4.05, dir: -S }, { x: 13.75, z: 4.05, dir: -S }, { x: 15.2, z: 4.05, dir: -S },
  { x: 10.8, z: 2.7, dir: 0 }, { x: 16.7, z: 2.7, dir: Math.PI },
  // visitas de Michael
  { x: 5.4, z: 3.5, dir: -S }, { x: 6.6, z: 3.5, dir: -S },
  // comedor
  { x: 33.95, z: 1.75, dir: 0 }, { x: 36.05, z: 1.75, dir: Math.PI }, { x: 33, z: 2.4, dir: S },
  { x: 34.1, z: 3.5, dir: Math.PI }, { x: 36.05, z: 5, dir: Math.PI },
  // cocina
  { x: 25.4, z: 8.2, dir: 0 }, { x: 26.4, z: 7.2, dir: S },
  // sueltas
  { x: 16.5, z: 12.3, dir: 0 }, { x: 1.2, z: 8.6, dir: 0 },
]

export interface OfficeObject extends Pt {
  /** Nivel (desde 1) en el que se roba, e índice dentro de ese nivel. */
  readonly level: number
  readonly index: number
  readonly y: number
  /** Giro para alinearse con su escritorio. */
  readonly turn: number
}

/** Punto sobre el escritorio de un personaje: `a` a lo largo (monitor en negativo), `f` hacia su silla. */
function onDesk(c: Character, [a, f]: readonly [number, number]): Pt & { readonly turn: number } {
  const [x, z, w, d] = c.desk
  const along = w >= d
  const long = (along ? w : d) / 1.8
  const short = along ? d : w
  const side = Math.sign(along ? c.home.z - z : c.home.x - x) || 1
  return along
    ? { x: x + a * long, z: z + f * short * side, turn: 0 }
    : { x: x + f * short * side, z: z + a * long, turn: S }
}

/** Todos los objetos robables de la oficina, en su sitio fijo. */
export const OBJECTS: readonly OfficeObject[] = LEVELS.flatMap((kind, i) =>
  kind.places.map((place, index): OfficeObject => {
    if (typeof place !== 'string') return { level: i + 1, index, ...place, turn: 0 }
    const owner = CHARACTERS.find((c) => c.id === place)
    if (!owner) throw new Error(`Nivel ${i + 1}: no existe el escritorio de ${place}`)
    return { level: i + 1, index, y: 0.75, ...onDesk(owner, kind.slot) }
  }))

/** Rutas de patrulla en bucle por pasillos libres (lo comprueba logic.check.ts). */
export const ROUTES: readonly (readonly Pt[])[] = [
  // vuelta a la sala principal
  [{ x: 6.4, z: 6.2 }, { x: 16.5, z: 6.2 }, { x: 16.5, z: 11 }, { x: 6.4, z: 11 }],
  // oficina de Michael y sala de reuniones
  [{ x: 8.2, z: 6.2 }, { x: 8.2, z: 3.9 }, { x: 7.6, z: 3.9 }, { x: 8.2, z: 3.9 }, { x: 8.2, z: 6.2 }, { x: 10, z: 6.2 }, { x: 10, z: 1.5 }, { x: 10, z: 6.2 }],
  // sala principal, cocina y anexo
  [{ x: 16.5, z: 9.5 }, { x: 19.5, z: 9.5 }, { x: 27, z: 9.5 }, { x: 29.8, z: 9.5 }, { x: 29.8, z: 12.4 }, { x: 29.8, z: 9.5 }, { x: 27, z: 9.5 }, { x: 19.5, z: 9.5 }],
  // anexo y comedor
  [{ x: 30, z: 7.5 }, { x: 32.7, z: 7.5 }, { x: 32.7, z: 5.3 }, { x: 32.7, z: 7.5 }, { x: 35.5, z: 7.5 }, { x: 35.5, z: 12.7 }, { x: 30, z: 12.7 }],
  // recepción y contabilidad
  [{ x: 6.4, z: 11 }, { x: 6.4, z: 16.4 }, { x: 1.2, z: 16.4 }, { x: 6.4, z: 16.4 }],
]

/** Quién sale a patrullar primero al subir de nivel. */
export const PATROL_ORDER: readonly string[] = ['dwight', 'michael', 'kelly', 'darryl', 'creed', 'angela', 'andy']

export interface LevelConfig {
  readonly range: number
  readonly halfAngle: number
  readonly sweepSpeed: number
  readonly sweepAmp: number
  readonly patrols: number
  readonly walk: number
}

export const LEVEL_SECONDS = 60

export function levelConfig(n: number): LevelConfig {
  return {
    range: Math.min(3.5 + 0.5 * n, 7.5),
    halfAngle: (Math.min(22 + 3 * n, 42) * Math.PI) / 180,
    sweepSpeed: 0.5 + 0.12 * n,
    sweepAmp: Math.min(0.5 + 0.12 * n, 1.3),
    patrols: Math.min(n - 1, 6),
    walk: Math.min(1.2 + 0.15 * n, 2.4),
  }
}
