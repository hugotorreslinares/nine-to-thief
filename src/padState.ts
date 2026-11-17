// Estado del celular usado como mando del televisor.

/** Botones del mando, en una máscara de bits. */
export const PAD_BUTTON = { grab: 1, ability: 2, ok: 4, back: 8 } as const

export interface PadState {
  /** palanca: -1 izquierda … +1 derecha */
  readonly x: number
  /** palanca: -1 abajo … +1 arriba */
  readonly y: number
  readonly buttons: number
}

const PROTOCOL = 'office-theft-'
export const peerId = (code: string): string => PROTOCOL + code.toUpperCase()

/** Valida un mensaje recibido por la red antes de usarlo. */
export function parsePadState(data: unknown): PadState | undefined {
  if (!Array.isArray(data) || data.length !== 3) return undefined
  const [x, y, buttons] = data as unknown[]
  if (typeof x !== 'number' || typeof y !== 'number' || typeof buttons !== 'number') return undefined
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(buttons)) return undefined
  const clamp = (v: number): number => Math.max(-1, Math.min(1, v))
  return { x: clamp(x), y: clamp(y), buttons: buttons & 0xf }
}
