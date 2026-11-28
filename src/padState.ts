// Estado del celular usado como mando del televisor.

/** Botones del mando, en una máscara de bits. */
export const PAD_BUTTON = { grab: 1, ability: 2, ok: 4, back: 8, zoom: 16, throw: 32 } as const

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
  return { x: clamp(x), y: clamp(y), buttons: buttons & 0x3f }
}

/** Credencial de un art toy enviada desde el celular a la tele. Mismo formato que la URL de la etiqueta. */
export function parseToy(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const { toy } = data as Record<string, unknown>
  return typeof toy === 'string' && /^[\w-]{16,64}$/.test(toy) ? toy : undefined
}

/** Quién eligió qué personaje: [jugador 1, jugador 2]; null si aún no eligió. */
export type Picks = readonly [string | null, string | null]

const CHAR_ID = /^[a-z]{2,16}$/

/** Mensaje del celular a la tele: el personaje que quiere jugar. */
export function parsePick(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const { pick } = data as Record<string, unknown>
  return typeof pick === 'string' && CHAR_ID.test(pick) ? pick : undefined
}

/**
 * Aplica la elección de un jugador. Devuelve el mismo objeto si no cambia nada: personaje desconocido,
 * ya elegido por el otro jugador o bloqueado por otra razón (por ejemplo, el protagonista de un art toy).
 */
export function applyPick(picks: Picks, slot: 0 | 1, id: string, known: ReadonlySet<string>, blocked: ReadonlySet<string> = new Set()): Picks {
  const other = picks[slot === 0 ? 1 : 0]
  if (!known.has(id) || blocked.has(id) || other === id || picks[slot] === id) return picks
  return slot === 0 ? [id, picks[1]] : [picks[0], id]
}

/** Mensajes de la tele al celular: qué jugador es, quién eligió qué, o que la sala está llena. */
export type HostMessage = { readonly slot: 0 | 1 } | { readonly picks: Picks } | { readonly full: true }

const isPickId = (v: unknown): v is string | null => v === null || (typeof v === 'string' && CHAR_ID.test(v))

export function parseHostMessage(data: unknown): HostMessage | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const { slot, full, picks } = data as Record<string, unknown>
  if (slot === 0 || slot === 1) return { slot }
  if (Array.isArray(picks) && picks.length === 2) {
    const [first, second] = picks as unknown[]
    if (isPickId(first) && isPickId(second)) return { picks: [first, second] }
  }
  return full === true ? { full: true } : undefined
}
