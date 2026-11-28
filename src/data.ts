import { LEVELS, type Place } from './levels.ts'
import { box, type Box, type Pt } from './logic.ts'

export type Hair = 'short' | 'bald' | 'balding' | 'long' | 'bun' | 'curly'

export type Gear = 'headset' | 'cap' | 'lanyard' | 'scarf' | 'earrings' | 'bowtie' | 'wolf'

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
  /** Accesorios sueltos: auriculares, gorra, credencial, bufanda, aretes o moño. */
  readonly gear?: readonly Gear[]
  /** Lleva un engrapador en una mano y una carpeta bajo el otro brazo. */
  readonly loot?: boolean
}

export type Effect =
  | { readonly kind: 'lure'; readonly radius: number; readonly seconds: number; readonly at: 'self' | 'conference' }
  | { readonly kind: 'freeze'; readonly radius: number; readonly seconds: number }
  | { readonly kind: 'blind'; readonly radius: number; readonly seconds: number; readonly factor: number }
  | { readonly kind: 'cloak'; readonly seconds: number }
  | { readonly kind: 'dash'; readonly seconds: number; readonly factor: number }
  | { readonly kind: 'time'; readonly seconds: number }
  /** Devora al vigilante más cercano dentro de `range`, solo si ningún otro lo está viendo. */
  | { readonly kind: 'devour'; readonly range: number }

export interface Character {
  readonly id: string
  readonly name: string
  /** El protagonista (el art toy): siempre enmascarado, no se sienta en la oficina como vigilante. */
  readonly hero?: boolean
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
    id: 'nine', name: 'Nine', home: { x: 16, z: 16.3, dir: -S }, desk: desk(16, 15.3),
    look: { skin: 0xe3b58a, hair: 0x3b3231, hairStyle: 'short', top: 0x1a1a1f, bottom: 0x1a1a1f, tie: 0xf97316, loot: true },
    hero: true, grabTime: 0.85,
    ability: { name: 'Modo sombra', text: 'Invisible para todos durante 2,5 s. Además roba 15 % más rápido.', cooldown: 20, effect: { kind: 'cloak', seconds: 2.5 } },
  },
  {
    id: 'bea', name: 'Bea', home: { x: 6, z: 1.1, dir: S }, desk: [6, 2.2, 2.4, 1.2],
    look: { skin: 0xd9a87c, hair: 0xb8b8c0, hairStyle: 'long', top: 0x5b2a86, bottom: 0x2b2b35, skirt: true, gear: ['earrings'] },
    ability: { name: '¡Junta de emergencia!', text: 'Todos miran hacia la sala de reuniones 4 s.', cooldown: 18, effect: { kind: 'lure', radius: 10, seconds: 4, at: 'conference' } },
  },
  {
    id: 'marco', name: 'Marco', home: { x: 10.1, z: 10.2, dir: -S }, desk: desk(10.1, 9.2),
    look: { skin: 0xc98f64, hair: 0x1a1612, hairStyle: 'short', top: 0x2f7d6d, bottom: 0x3a3f4a, tie: 0xf2c14e, beard: true, gear: ['lanyard'] },
    ability: { name: 'Café doble', text: 'Corre 80 % más rápido durante 3 s.', cooldown: 14, effect: { kind: 'dash', seconds: 3, factor: 1.8 } },
  },
  {
    id: 'teo', name: 'Teo', home: { x: 10.1, z: 7.2, dir: S }, desk: desk(10.1, 8.2),
    look: { skin: SKIN, hair: 0xc47a3a, hairStyle: 'short', top: 0x7fb2e5, bottom: 0x2e3a52, scale: 1.08, gear: ['headset'] },
    ability: { name: 'Chiste malo', text: 'Congela a los que están cerca 3,5 s.', cooldown: 18, effect: { kind: 'freeze', radius: 6, seconds: 3.5 } },
  },
  {
    id: 'lucia', name: 'Lucía', home: { x: 3.6, z: 10.2, dir: -S }, desk: [3.6, 9.2, 2.6, 1],
    look: { skin: 0xb9825a, hair: 0x2a1a14, hairStyle: 'long', top: 0xf28ab2, bottom: 0x5a4a6a, skirt: true, gear: ['earrings', 'lanyard'] },
    grabTime: 0.6,
    ability: { name: 'Manos ágiles', text: 'Pasiva: roba 40 % más rápido.' },
  },
  {
    id: 'omar', name: 'Omar', home: { x: 32.8, z: 11.6, dir: -S }, desk: desk(32.8, 10.6),
    look: { skin: 0x8d5a3b, hair: 0x15110f, hairStyle: 'short', top: 0x22252b, bottom: 0x22252b, tie: 0x4cc9f0, glasses: true, gear: ['lanyard'] },
    ability: { name: 'Notificación masiva', text: 'Toda la oficina mira el celular: ven la mitad 3,5 s.', cooldown: 20, effect: { kind: 'blind', radius: Infinity, seconds: 3.5, factor: 0.5 } },
  },
  {
    id: 'sara', name: 'Sara', home: { x: 32.8, z: 8.6, dir: S }, desk: desk(32.8, 9.6),
    look: { skin: SKIN, hair: 0xd1495b, hairStyle: 'bun', top: 0xffc857, bottom: 0x6b4f1d, skirt: true, scale: 0.92, gear: ['headset'] },
    ability: { name: 'Rumor de pasillo', text: 'Los cercanos miran donde soltó el chisme 4 s.', cooldown: 15, effect: { kind: 'lure', radius: 8, seconds: 4, at: 'self' } },
  },
  {
    id: 'felix', name: 'Félix', home: { x: 36, z: 16.5, dir: -S }, desk: desk(36, 15.5),
    look: { skin: 0xe0b48a, hair: 0x7a6a50, hairStyle: 'balding', top: 0x8a8f99, bottom: 0x555a64, tie: 0x6b7280, gear: ['lanyard'] },
    grace: 0.7,
    ability: { name: 'Invisible por costumbre', text: 'Pasiva: tardan 0,7 s en notar que roba.' },
  },
  {
    id: 'elsa', name: 'Elsa', home: { x: 2.6, z: 12.2, dir: S }, desk: desk(2.6, 13.2),
    look: { skin: 0xd8a47f, hair: 0xece7dc, hairStyle: 'short', top: 0x2d6a4f, bottom: 0x3d405b, skirt: true, glasses: true, scale: 0.88, gear: ['scarf'] },
    visibility: 0.75,
    ability: { name: 'Bajo perfil', text: 'Pasiva: la ven 25 % menos lejos.' },
  },
  {
    id: 'pablo', name: 'Pablo', home: { x: 2.6, z: 15.2, dir: -S }, desk: desk(2.6, 14.2),
    look: { skin: 0xc99a72, hair: 0x1a1614, hairStyle: 'short', top: 0x6d597a, bottom: 0x3b3b44, tie: 0x2a9d8f, glasses: true, gear: ['headset'] },
    ability: { name: 'Dato curioso', text: 'Una vez por nivel: +10 s de tiempo.', cooldown: 999, effect: { kind: 'time', seconds: 10 } },
  },
  {
    id: 'dani', name: 'Dani', home: { x: 5.3, z: 13.7, dir: Math.PI }, desk: [4.2, 13.7, 1, 1.8],
    look: { skin: SKIN, hair: 0xc2410c, hairStyle: 'short', top: 0x8ecae6, bottom: 0x3b3b3b, tie: 0x264653, wide: 1.35, gear: ['cap'] },
    speed: 0.85,
    ability: { name: 'Café derramado', text: 'Los cercanos miran el piso: ven 60 % menos 5 s. Es lento.', cooldown: 18, effect: { kind: 'blind', radius: 7, seconds: 5, factor: 0.4 } },
  },
  {
    id: 'ramon', name: 'Ramón', home: { x: 14.2, z: 7.2, dir: S }, desk: desk(14.2, 8.2),
    look: { skin: 0xe0b48a, hair: 0x2b2b2b, hairStyle: 'bald', top: 0xb5651d, bottom: 0x4a4036, beard: true, wide: 1.25, gear: ['bowtie'] },
    ability: { name: 'Silencio incómodo', text: 'Congela a toda la oficina 2 s.', cooldown: 25, effect: { kind: 'freeze', radius: Infinity, seconds: 2 } },
  },
  {
    id: 'clara', name: 'Clara', home: { x: 14.2, z: 10.2, dir: -S }, desk: desk(14.2, 9.2),
    look: { skin: SKIN, hair: 0xc9c9d1, hairStyle: 'curly', top: 0x2a9d8f, bottom: 0x5a4a6a, skirt: true, wide: 1.25, gear: ['earrings', 'scarf'] },
    visibility: 0.85, grabTime: 0.8,
    ability: { name: 'Cara de buena persona', text: 'Pasiva: la ven 15 % menos lejos y roba 20 % más rápido.' },
  },
  {
    id: 'nacho', name: 'Nacho', home: { x: 9.2, z: 14, dir: S }, desk: desk(9.2, 15),
    look: { skin: 0xb98a62, hair: 0xd0d0d0, hairStyle: 'balding', top: 0x445566, bottom: 0x444444, tie: 0x111111, gear: ['lanyard'] },
    ability: { name: 'Estornudo', text: 'Congela a los cercanos 2,5 s.', cooldown: 12, effect: { kind: 'freeze', radius: 4, seconds: 2.5 } },
  },
  {
    id: 'rita', name: 'Rita', home: { x: 11, z: 16, dir: -S }, desk: desk(11, 15),
    look: { skin: SKIN, hair: 0x3d2b1f, hairStyle: 'long', top: 0x06d6a0, bottom: 0x333333, skirt: true, gear: ['headset'] },
    ability: { name: 'Hora feliz', text: 'Corre 45 % más rápido durante 5 s.', cooldown: 16, effect: { kind: 'dash', seconds: 5, factor: 1.45 } },
  },
  {
    id: 'ivan', name: 'Iván', home: { x: 8.3, z: 7.2, dir: S }, desk: desk(8.3, 8.2),
    look: { skin: SKIN, hair: 0x1d3557, hairStyle: 'short', top: 0xff7f50, bottom: 0x1d3557, tie: 0xffd166, gear: ['lanyard'] },
    ability: { name: 'Karaoke de oficina', text: 'Los cercanos miran donde cantó 3 s. Recarga corta.', cooldown: 10, effect: { kind: 'lure', radius: 10, seconds: 3, at: 'self' } },
  },
  {
    id: 'lobo', name: 'Lobo', home: { x: 37, z: 12.4, dir: -S }, desk: desk(37, 11.4),
    look: { skin: 0x9a8573, hair: 0x4b4b55, hairStyle: 'long', top: 0x3a3a44, bottom: 0x23232b, beard: true, scale: 1.1, wide: 1.1, gear: ['wolf'] },
    ability: { name: 'Luna llena', text: 'Devora a un vigilante cercano, pero solo si nadie más lo ve.', cooldown: 15, effect: { kind: 'devour', range: 2.2 } },
  },
]

// ---------- Oficina (metros; x hacia la derecha, z hacia abajo) ----------
// Plano de una oficina de planta abierta a 1 m ≈ 20 px. De izquierda a derecha: la sala principal con el
// vestíbulo, la oficina de Bea y la sala de reuniones arriba; el bloque central con la
// escalera, la cocina (que conecta ambos lados) y los baños; y a la derecha el anexo con el
// comedor arriba. La escalera y los baños están cerrados: son decorado.

export const MAP = { w: 38, d: 17.5 } as const
export const SPAWN: Pt = { x: 1.5, z: 2 }
export const CONFERENCE: Pt = { x: 13.75, z: 2.7 }

export const ROOMS: readonly { readonly box: Box; readonly color: number }[] = [
  { box: box(1.5, 2.375, 3, 4.75), color: 0x6f7480 }, // vestíbulo
  { box: box(6.05, 2.375, 6.1, 4.75), color: 0x6f7f95 }, // oficina de Bea
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
  // vestíbulo, oficina de Bea y sala de reuniones: una puerta cada uno hacia la sala principal
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
  // sala de reuniones y oficina de Bea
  block(13.75, 2.7, 5, 1.8, 0.75, 0x5c4630), // mesa de reuniones
  block(13.75, 0.45, 2.4, 0.4, 0.7, WOOD), // aparador
  block(3.5, 2.4, 0.6, 2, 1.7, WOOD, true), // estante de Bea
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
  block(33.4, 15.2, 0.6, 2.6, 1.8, WOOD, true), // estantes que aíslan a Felix
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
  // visitas de Bea
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
export function onDesk(c: Character, [a, f]: readonly [number, number]): Pt & { readonly turn: number } {
  const [x, z, w, d] = c.desk
  const along = w >= d
  const long = (along ? w : d) / 1.8
  const short = along ? d : w
  const side = Math.sign(along ? c.home.z - z : c.home.x - x) || 1
  return along
    ? { x: x + a * long, z: z + f * short * side, turn: 0 }
    : { x: x + f * short * side, z: z + a * long, turn: S }
}

/** Un sitio (escritorio de un personaje o punto fijo) convertido en posición de un objeto de ese nivel. */
function resolvePlace(level: number, index: number, place: Place): OfficeObject {
  const kind = LEVELS[level - 1]
  if (!kind) throw new Error(`Nivel inválido: ${level}`)
  if (typeof place !== 'string') return { level, index, ...place, turn: 0 }
  const owner = CHARACTERS.find((c) => c.id === place)
  if (!owner) throw new Error(`Nivel ${level}: no existe el escritorio de ${place}`)
  return { level, index, y: 0.75, ...onDesk(owner, kind.slot) }
}

/** Reparto de partida de los objetos robables: lo que define LEVELS. Lo usan las pruebas y es el punto de partida del juego. */
export const OBJECTS: readonly OfficeObject[] = LEVELS.flatMap((kind, i) =>
  kind.places.map((place, index): OfficeObject => resolvePlace(i + 1, index, place)))

/**
 * Reparto al azar para una partida nueva: en cada nivel, los mismos objetos (mismo número e índices, que es lo que
 * guarda el servidor) pero en escritorios distintos, además de los puntos especiales que ese nivel ya usaba.
 * `rand` devuelve un número en [0, 1); se puede fijar para las pruebas.
 */
export function randomLayout(rand: () => number = Math.random): readonly OfficeObject[] {
  return LEVELS.flatMap((kind, i) => {
    const points = kind.places.filter((place): place is Exclude<Place, string> => typeof place !== 'string')
    const pool: Place[] = [...CHARACTERS.map((c) => c.id), ...points]
    // Fisher–Yates
    for (let k = pool.length - 1; k > 0; k--) {
      const r = Math.floor(rand() * (k + 1))
      const a = pool[k] as Place
      pool[k] = pool[r] as Place
      pool[r] = a
    }
    return pool.slice(0, kind.places.length).map((place, index): OfficeObject => resolvePlace(i + 1, index, place))
  })
}

/** Rutas de patrulla en bucle por pasillos libres (lo comprueba logic.check.ts). */
export const ROUTES: readonly (readonly Pt[])[] = [
  // vuelta a la sala principal
  [{ x: 6.4, z: 6.2 }, { x: 16.5, z: 6.2 }, { x: 16.5, z: 11 }, { x: 6.4, z: 11 }],
  // oficina de Bea y sala de reuniones
  [{ x: 8.2, z: 6.2 }, { x: 8.2, z: 3.9 }, { x: 7.6, z: 3.9 }, { x: 8.2, z: 3.9 }, { x: 8.2, z: 6.2 }, { x: 10, z: 6.2 }, { x: 10, z: 1.5 }, { x: 10, z: 6.2 }],
  // sala principal, cocina y anexo
  [{ x: 16.5, z: 9.5 }, { x: 19.5, z: 9.5 }, { x: 27, z: 9.5 }, { x: 29.8, z: 9.5 }, { x: 29.8, z: 12.4 }, { x: 29.8, z: 9.5 }, { x: 27, z: 9.5 }, { x: 19.5, z: 9.5 }],
  // anexo y comedor
  [{ x: 30, z: 7.5 }, { x: 32.7, z: 7.5 }, { x: 32.7, z: 5.3 }, { x: 32.7, z: 7.5 }, { x: 35.5, z: 7.5 }, { x: 35.5, z: 12.7 }, { x: 30, z: 12.7 }],
  // recepción y contabilidad
  [{ x: 6.4, z: 11 }, { x: 6.4, z: 16.4 }, { x: 1.2, z: 16.4 }, { x: 6.4, z: 16.4 }],
]

/** Quién sale a patrullar primero al subir de nivel. */
export const PATROL_ORDER: readonly string[] = ['marco', 'bea', 'sara', 'dani', 'nacho', 'elsa', 'ivan']

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
    range: Math.min(3.5 + 0.4 * n, 6.5),
    halfAngle: (Math.min(22 + 2.5 * n, 36) * Math.PI) / 180,
    sweepSpeed: Math.min(0.5 + 0.08 * n, 1.1),
    sweepAmp: Math.min(0.5 + 0.1 * n, 1.2),
    patrols: Math.min(n - 1, 5),
    walk: Math.min(1.3 + 0.13 * n, 2.2),
  }
}

/** Compañeros que ese día no están en la oficina: desde el nivel 4, uno más por nivel (máx. 6). */
export const awayCount = (n: number): number => Math.max(0, Math.min(n - 3, 6))

/** Fracción de objetos extra por nivel cuando juegan dos (se afina jugando). */
export const COOP_EXTRA = 0.4

/**
 * Objetos extra del modo de dos jugadores: en escritorios que el nivel no usa, repartidos según el nivel.
 * No forman parte del progreso guardado: `index` es negativo.
 */
export function extraObjects(level: number, count: number, layout: readonly OfficeObject[] = OBJECTS): readonly OfficeObject[] {
  const kind = LEVELS[level - 1]
  if (!kind) throw new Error(`Nivel inválido: ${level}`)
  const used = new Set(kind.places.filter((place): place is string => typeof place === 'string'))
  const base = layout.filter((o) => o.level === level)
  // Un escritorio libre pegado a uno del nivel (los hay enfrentados a 1 m) dejaría dos objetos casi encima.
  const free = CHARACTERS.filter((c) => !used.has(c.id)).map((c, i): OfficeObject => ({ level, index: -(i + 1), y: 0.75, ...onDesk(c, kind.slot) }))
    .filter((o) => base.every((b) => Math.hypot(b.x - o.x, b.z - o.z) > 0.7))
  const n = Math.min(count, free.length)
  return Array.from({ length: n }, (_, i): OfficeObject => {
    const pick = free[(level + i) % free.length]
    if (!pick) throw new Error('Sin escritorio libre')
    return { ...pick, index: -(i + 1) }
  })
}
