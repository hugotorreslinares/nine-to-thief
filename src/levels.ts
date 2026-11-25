// Los 10 niveles: cada uno es una categoría de objetos repartida por la oficina.
// Para cambiar la progresión basta editar LEVELS; cliente y servidor leen de aquí.

/** Pieza de un objeto: tamaño y centro relativos a su base. */
export interface Part {
  readonly shape: 'box' | 'cyl'
  readonly color: number
  readonly size: readonly [number, number, number]
  readonly at: readonly [number, number, number]
}

/** Id del personaje dueño del escritorio, o un punto fijo de la oficina. */
export type Place = string | { readonly x: number; readonly y: number; readonly z: number }

export interface LevelKind {
  readonly plural: string
  readonly parts: readonly Part[]
  /** Sitio sobre un escritorio de 1,8 × 1: [a lo largo (el monitor queda en negativo), hacia la silla]. */
  readonly slot: readonly [number, number]
  readonly places: readonly Place[]
}

const box = (color: number, size: Part['size'], at: Part['at']): Part => ({ shape: 'box', color, size, at })
const cyl = (color: number, size: Part['size'], at: Part['at']): Part => ({ shape: 'cyl', color, size, at })

const DARK = 0x1c1c1c
const GOLD = 0xd4af37

export const LEVELS: readonly LevelKind[] = [
  {
    plural: 'cosedoras', slot: [0.38, -0.28],
    parts: [box(0xc0392b, [0.3, 0.05, 0.09], [0, 0.025, 0]), box(0x8e2430, [0.27, 0.04, 0.08], [0.01, 0.07, 0])],
    places: ['lucia', 'marco', 'elsa', 'ramon', 'felix'],
  },
  {
    plural: 'lápices', slot: [0.74, -0.3],
    parts: [
      cyl(0x2b2f38, [0.12, 0.13, 0.12], [0, 0.065, 0]),
      box(0xf1c40f, [0.02, 0.12, 0.02], [-0.025, 0.18, 0]),
      box(0xc0392b, [0.02, 0.1, 0.02], [0.025, 0.17, 0.02]),
      box(0x2f8f4e, [0.02, 0.11, 0.02], [0, 0.175, -0.025]),
    ],
    places: ['lucia', 'teo', 'pablo', 'clara', 'sara', 'bea'],
  },
  {
    plural: 'cuadernos', slot: [0.35, 0.18],
    parts: [box(0x2456a6, [0.22, 0.035, 0.3], [0, 0.018, 0]), box(0xdddddd, [0.02, 0.045, 0.3], [-0.11, 0.022, 0])],
    places: ['teo', 'omar', 'elsa', 'rita', 'ivan', 'nine'],
  },
  {
    plural: 'tazas de café', slot: [0.72, 0.22],
    parts: [
      cyl(0xf5f5f5, [0.13, 0.14, 0.13], [0, 0.07, 0]),
      box(0xf5f5f5, [0.05, 0.07, 0.03], [0.085, 0.07, 0]),
      cyl(0x4a2c17, [0.1, 0.01, 0.1], [0, 0.141, 0]),
    ],
    places: ['bea', 'ramon', 'dani', 'nacho', { x: 20.3, y: 0.9, z: 6.95 }, { x: 22.7, y: 0.9, z: 6.95 }, { x: 26.4, y: 0.75, z: 8.2 }], // + mesón y mesita de la cocina
  },
  {
    plural: 'mouse', slot: [-0.12, 0.28],
    parts: [box(DARK, [0.26, 0.01, 0.22], [0, 0.005, 0]), box(0xd9d9d9, [0.07, 0.04, 0.11], [0, 0.03, 0])],
    places: ['marco', 'teo', 'pablo', 'dani', 'omar', 'sara', 'ivan'],
  },
  {
    plural: 'teclados', slot: [-0.45, 0.28],
    parts: [box(0x2b2f38, [0.44, 0.03, 0.16], [0, 0.015, 0]), box(0x8d949c, [0.4, 0.01, 0.12], [0, 0.035, 0])],
    places: ['bea', 'marco', 'lucia', 'elsa', 'ramon', 'clara', 'nacho', 'nine'],
  },
  {
    plural: 'audífonos', slot: [-0.75, -0.3],
    parts: [
      box(DARK, [0.05, 0.13, 0.11], [-0.1, 0.065, 0]),
      box(DARK, [0.05, 0.13, 0.11], [0.1, 0.065, 0]),
      box(0xc0392b, [0.25, 0.03, 0.05], [0, 0.145, 0]),
    ],
    places: ['teo', 'omar', 'sara', 'dani', 'rita', 'ivan', 'nine', 'felix'],
  },
  {
    plural: 'calculadoras', slot: [0.08, -0.22],
    parts: [
      box(0x555b63, [0.14, 0.03, 0.2], [0, 0.015, 0]),
      box(0x9fe0b0, [0.11, 0.01, 0.05], [0, 0.035, -0.06]),
      box(0xe8e8e8, [0.11, 0.01, 0.09], [0, 0.035, 0.035]),
    ],
    places: ['elsa', 'pablo', 'dani', 'marco', 'bea', 'felix', 'clara', 'ramon'],
  },
  {
    plural: 'adornos', slot: [-0.8, 0.32],
    parts: [box(0x7a4a2a, [0.24, 0.19, 0.03], [0, 0.095, 0]), box(0x9fd3ff, [0.19, 0.14, 0.035], [0, 0.095, 0])],
    places: [
      'lucia', 'bea',
      { x: 13, y: 0.7, z: 0.45 }, // aparador de la sala de reuniones
      { x: 13.2, y: 1.2, z: 5.2 }, { x: 14.8, y: 1.2, z: 5.2 }, // archivadores
      { x: 12.4, y: 0.75, z: 2.7 }, // mesa de reuniones
      { x: 33, y: 0.75, z: 3.5 }, // comedor
      { x: 3.5, y: 1.7, z: 2 }, // estante de Bea
    ],
  },
  {
    plural: 'trofeos', slot: [0.1, 0.03],
    parts: [
      box(DARK, [0.12, 0.04, 0.12], [0, 0.02, 0]),
      cyl(GOLD, [0.04, 0.12, 0.04], [0, 0.1, 0]),
      box(GOLD, [0.1, 0.1, 0.1], [0, 0.21, 0]),
    ],
    places: [
      'bea', 'marco', 'teo', 'lucia',
      { x: 3.5, y: 1.7, z: 2.9 }, // estante de Bea
      { x: 15.2, y: 0.75, z: 2.7 }, // mesa de reuniones
      { x: 14.6, y: 0.7, z: 0.45 }, // aparador
      { x: 9, y: 1.8, z: 17.1 }, // armario alto
    ],
  },
]

/** Objetos por nivel: lo único que el servidor necesita para validar un robo. */
export const COUNTS: readonly number[] = LEVELS.map((kind) => kind.places.length)

/** Sin art toy solo se juega el primer nivel. */
export const DEMO_COUNTS: readonly number[] = COUNTS.slice(0, 2)
