import { parseProgress, type Progress } from './progress.ts'

// Sesión del art toy. La credencial vive solo en memoria: al cerrar o recargar la pestaña
// se pierde y hay que volver a acercar el art toy.

export interface Account {
  readonly name: string
  readonly progress: Progress
}

/** Error de /api/play con su código HTTP: 401 sesión terminada, 404 etiqueta desconocida. */
export class PlayError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let session: string | undefined
let chain: Promise<void> = Promise.resolve()
let pending = 0

/** Sin avisos al servidor en vuelo. */
export const idle = (): boolean => pending === 0

async function post(body: object): Promise<Record<string, unknown>> {
  const res = await fetch('/api/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data: unknown = await res.json().catch(() => undefined)
  const fields = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  // 409: el servidor rechazó la jugada pero devuelve el progreso real para corregir el local.
  if (!res.ok && res.status !== 409) throw new PlayError(res.status, typeof fields.error === 'string' ? fields.error : `Error ${res.status}`)
  return fields
}

function toAccount(fields: Record<string, unknown>): Account | undefined {
  if (fields.registered !== true) return undefined
  const progress = parseProgress(fields.progress)
  if (typeof fields.session !== 'string' || typeof fields.name !== 'string' || !progress) throw new PlayError(502, 'Respuesta inesperada')
  session = fields.session
  return { name: fields.name, progress }
}

/** Entra con el código de la etiqueta. Undefined si esa etiqueta aún no tiene jugador. */
export const open = async (code: string): Promise<Account | undefined> => toAccount(await post({ action: 'open', code }))

export async function register(code: string, name: string, email: string): Promise<Account> {
  const account = toAccount(await post({ action: 'register', code, name, email }))
  if (!account) throw new PlayError(502, 'Respuesta inesperada')
  return account
}

export function close(): void {
  session = undefined
}

type Event =
  | { readonly action: 'start'; readonly char: string }
  | { readonly action: 'steal'; readonly index: number }
  | { readonly action: 'caught' }

/**
 * Avisa al servidor de una jugada, en orden. `onDone` recibe el progreso real tras cada respuesta.
 * Sin sesión (demo) no hace nada.
 */
export function report(event: Event, onDone: (progress: Progress) => void, onFail: (err: unknown) => void): void {
  if (!session) return
  pending++
  chain = chain.then(async () => {
    try {
      const progress = session ? parseProgress((await post({ ...event, session })).progress) : undefined
      pending--
      if (progress) onDone(progress)
    } catch (err) {
      pending--
      onFail(err)
    }
  })
}

/** Apunta un correo en la lista de espera de los art toys. */
export async function joinWaitlist(email: string, lang: string): Promise<void> {
  const res = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lang }),
  })
  if (!res.ok) throw new PlayError(res.status, `Error ${res.status}`)
}

/** Envía un comentario del jugador (valoración de 1 a 5, texto y correo opcional). */
export async function sendFeedback(rating: number, text: string, email: string, lang: string, website: string): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, text, email, lang, website }),
  })
  if (!res.ok) throw new PlayError(res.status, `Error ${res.status}`)
}

/** Unidades que quedan de la preventa; undefined si no se pudo consultar. */
export async function fetchPresaleLeft(): Promise<number | undefined> {
  try {
    const res = await fetch('/api/presale')
    if (!res.ok) return undefined
    const { left } = (await res.json()) as { left?: unknown }
    return typeof left === 'number' ? left : undefined
  } catch (err) {
    console.warn('No se pudo consultar la preventa', err)
    return undefined
  }
}
