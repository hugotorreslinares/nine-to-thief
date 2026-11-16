// Reglas de progresión. Las aplica el servidor (la verdad) y el cliente (para pintar al instante).

export const MAX_STARS = 5

export interface Progress {
  /** Nivel en curso, desde 1. Uno más que el último nivel = oficina vacía. */
  readonly level: number
  /** Capturas acumuladas desde la última pérdida de nivel. */
  readonly stars: number
  readonly captures: number
  /** Índices ya robados del nivel en curso. Los niveles anteriores están robados enteros. */
  readonly stolen: readonly number[]
  /** Mayor nivel completado alguna vez. */
  readonly best: number
  readonly char?: string
}

export const FRESH: Progress = { level: 1, stars: 0, captures: 0, stolen: [], best: 0 }

/** Roba un objeto del nivel en curso; al robar el último sube de nivel. Undefined si el robo no es válido. */
export function steal(p: Progress, index: number, counts: readonly number[]): Progress | undefined {
  const count = counts[p.level - 1]
  if (count === undefined || !Number.isInteger(index) || index < 0 || index >= count || p.stolen.includes(index)) return undefined
  const stolen = [...p.stolen, index]
  return stolen.length < count ? { ...p, stolen } : { ...p, level: p.level + 1, stolen: [], best: Math.max(p.best, p.level) }
}

/** Suma una captura. A la quinta se pierde un nivel (nunca por debajo del 1) y sus objetos vuelven a la oficina. */
export function caught(p: Progress): Progress {
  const captures = p.captures + 1
  return p.stars + 1 < MAX_STARS
    ? { ...p, stars: p.stars + 1, captures }
    : { ...p, level: Math.max(1, p.level - 1), stars: 0, captures, stolen: [] }
}

/** Valida un progreso leído de fuera (base de datos o red). */
export function parseProgress(raw: unknown): Progress | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { level, stars, captures, stolen, best, char } = raw as Record<string, unknown>
  const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0
  if (!whole(level) || level < 1 || !whole(stars) || stars >= MAX_STARS || !whole(captures) || !whole(best)) return undefined
  if (!Array.isArray(stolen) || !stolen.every(whole)) return undefined
  return { level, stars, captures, stolen, best, ...(typeof char === 'string' ? { char } : {}) }
}
