// Niveles superados en este dispositivo, por separado en solitario y de a dos.

export interface Clears {
  readonly solo: readonly number[]
  readonly duo: readonly number[]
}

const KEY = 'office-theft-clears'

const levels = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 99) : []

export function loadClears(): Clears {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    return { solo: levels(data.solo), duo: levels(data.duo) }
  } catch (err) {
    console.warn('Sin acceso a los niveles superados', err)
    return { solo: [], duo: [] }
  }
}

/** Anota un nivel superado y devuelve el nuevo registro. */
export function markCleared(clears: Clears, level: number, duo: boolean): Clears {
  const key = duo ? 'duo' : 'solo'
  if (clears[key].includes(level)) return clears
  const next = { ...clears, [key]: [...clears[key], level].sort((a, b) => a - b) }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('No se pudo guardar el nivel superado', err)
  }
  return next
}
