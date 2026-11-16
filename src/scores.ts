export interface BoardRow {
  readonly name: string
  readonly level: number
  readonly seconds: number
}

export interface Board {
  readonly top: readonly BoardRow[]
  readonly me?: BoardRow & { readonly rank: number }
}

const NAME = /^[\p{L}\p{N} _-]{1,12}$/u
const NICK_KEY = 'office-theft-nick'
const TOKEN_KEY = 'office-theft-token'

/** Error del tablón con su código HTTP; 409 = apodo de otro jugador. */
export class BoardError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Tablón respondió ${status}`)
    this.status = status
  }
}

export const isTaken = (err: unknown): boolean => err instanceof BoardError && err.status === 409

/** Secreto de este dispositivo: prueba ante el servidor que el apodo es suyo. */
function deviceToken(): string {
  try {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) return saved
    const fresh = crypto.randomUUID()
    localStorage.setItem(TOKEN_KEY, fresh)
    return fresh
  } catch (err) {
    console.warn('Sin localStorage: el apodo solo durará esta sesión', err)
    return (sessionToken ??= crypto.randomUUID())
  }
}
let sessionToken: string | undefined

/** Apodo válido para el tablón, o undefined. Mismas reglas que valida el servidor. */
export function cleanNick(raw: string): string | undefined {
  const name = raw.trim()
  return NAME.test(name) ? name : undefined
}

export function loadNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch (err) {
    console.warn('Sin acceso a localStorage', err)
    return ''
  }
}

export function saveNick(nick: string): void {
  try {
    localStorage.setItem(NICK_KEY, nick)
  } catch (err) {
    console.warn('No se pudo guardar el apodo', err)
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new BoardError(res.status)
  return (await res.json()) as T
}

export const fetchBoard = (name?: string): Promise<Board> =>
  call<Board>(`/api/scores${name ? `?name=${encodeURIComponent(name)}` : ''}`)

const send = <T>(method: 'PUT' | 'POST', body: object): Promise<T> =>
  call<T>('/api/scores', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, token: deviceToken() }),
  })

/** Reserva el apodo para este dispositivo. Rechaza con BoardError 409 si ya es de otro. */
export const claimNick = (name: string): Promise<{ name: string }> => send('PUT', { name })

/** Envía el resultado y devuelve el puesto actual del jugador. */
export async function submitScore(row: BoardRow): Promise<number | undefined> {
  const { rank } = await send<{ rank?: number }>('POST', row)
  return rank
}
