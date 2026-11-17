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

/** Credencial de un art toy enviada desde el celular a la tele. Mismo formato que la URL de la etiqueta. */
export function parseToy(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const { toy } = data as Record<string, unknown>
  return typeof toy === 'string' && /^[\w-]{16,64}$/.test(toy) ? toy : undefined
}

/** Mensajes de la tele al celular: qué jugador es, o que la sala está llena. */
export type HostMessage = { readonly slot: 0 | 1 } | { readonly full: true }

export function parseHostMessage(data: unknown): HostMessage | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const { slot, full } = data as Record<string, unknown>
  if (slot === 0 || slot === 1) return { slot }
  return full === true ? { full: true } : undefined
}
