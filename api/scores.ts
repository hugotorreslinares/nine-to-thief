import { createHash } from 'node:crypto'

// Tablón de puntuaciones sobre un sorted set de Upstash Redis (API REST, sin SDK).
// ponytail: el cliente reporta su propio puntaje y no hay límite de peticiones; si aparecen
// trampas o abuso, firmar las partidas en el servidor y añadir rate limit por IP.

const KEY = 'scores'
const KEEP = 1000
const TOP = 10
const NAME = /^[\p{L}\p{N} _-]{1,12}$/u
const TOKEN = /^[0-9a-f-]{36}$/
// Apodo único sin cuentas: el primero que lo reserva lo ata al token secreto de su dispositivo.
// ponytail: un apodo reservado no se libera nunca (ni al cambiarlo ni al perder el dispositivo);
// añadir caducidad por inactividad si empiezan a faltar nombres.
const OWNERS = 'nick:owner' // apodo en minúsculas -> hash del token
const DISPLAY = 'nick:display' // apodo en minúsculas -> como lo escribió su dueño
const TAKEN = 'Ese apodo ya está ocupado'

export interface Claim {
  readonly name: string
  readonly token: string
}

export interface Entry extends Claim {
  readonly level: number
  readonly seconds: number
}

/** Nivel manda; los segundos sobrantes desempatan. */
export const encode = (level: number, seconds: number): number => level * 100 + seconds
export const decode = (score: number): { level: number; seconds: number } =>
  ({ level: Math.floor(score / 100), seconds: score % 100 })

export const parseName = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const name = raw.trim()
  return NAME.test(name) ? name : undefined
}

/** Devuelve la reserva validada o un mensaje de error. */
export function parseClaim(body: unknown): Claim | string {
  if (typeof body !== 'object' || body === null) return 'Cuerpo inválido'
  const { name: rawName, token } = body as Record<string, unknown>
  const name = parseName(rawName)
  if (!name) return 'Apodo inválido: 1 a 12 letras, números, espacios, - o _'
  if (typeof token !== 'string' || !TOKEN.test(token)) return 'Token inválido'
  return { name, token }
}

/** Devuelve la entrada validada o un mensaje de error. */
export function parseEntry(body: unknown): Entry | string {
  const claim = parseClaim(body)
  if (typeof claim === 'string') return claim
  const { level, seconds } = body as Record<string, unknown>
  const { name, token } = claim
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 99) return 'Nivel inválido'
  if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 0 || seconds > 99) return 'Segundos inválidos'
  return { name, token, level, seconds }
}

type Command = readonly (string | number)[]

export async function redis(commands: readonly Command[]): Promise<unknown[]> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('Faltan KV_REST_API_URL / KV_REST_API_TOKEN')
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Redis respondió ${res.status}`)
  const replies = (await res.json()) as readonly { result?: unknown; error?: string }[]
  return replies.map((reply) => {
    if (reply.error) throw new Error(`Redis: ${reply.error}`)
    return reply.result
  })
}

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const fail = (err: unknown): Response => {
  console.error(err)
  return json({ error: 'Tablón no disponible' }, 503)
}

/** Reserva el apodo para este token. Devuelve el apodo tal como quedó registrado, o undefined si es de otro. */
async function claim({ name, token }: Claim): Promise<string | undefined> {
  const key = name.toLowerCase()
  const hash = createHash('sha256').update(token).digest('hex')
  // HSETNX es atómico: si dos llegan a la vez, solo el primero queda como dueño.
  const [, , owner, display] = await redis([
    ['HSETNX', OWNERS, key, hash],
    ['HSETNX', DISPLAY, key, name],
    ['HGET', OWNERS, key],
    ['HGET', DISPLAY, key],
  ])
  return owner === hash && typeof display === 'string' ? display : undefined
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

/** Reservar un apodo antes de jugar. */
export async function PUT(request: Request): Promise<Response> {
  const wanted = parseClaim(await readJson(request))
  if (typeof wanted === 'string') return json({ error: wanted }, 400)
  try {
    const name = await claim(wanted)
    return name ? json({ name }) : json({ error: TAKEN }, 409)
  } catch (err) {
    return fail(err)
  }
}

const toRank = (reply: unknown): number | undefined => (typeof reply === 'number' ? reply + 1 : undefined)

export async function GET(request: Request): Promise<Response> {
  const name = parseName(new URL(request.url).searchParams.get('name'))
  const commands: Command[] = [['ZRANGE', KEY, 0, TOP - 1, 'REV', 'WITHSCORES']]
  if (name) commands.push(['ZREVRANK', KEY, name], ['ZSCORE', KEY, name])
  try {
    const [flat, rank, score] = await redis(commands)
    const pairs = Array.isArray(flat) ? flat : []
    const top = []
    for (let i = 0; i + 1 < pairs.length; i += 2) top.push({ name: String(pairs[i]), ...decode(Number(pairs[i + 1])) })
    const myRank = toRank(rank)
    return json({ top, me: name && myRank ? { name, rank: myRank, ...decode(Number(score)) } : undefined })
  } catch (err) {
    return fail(err)
  }
}

export async function POST(request: Request): Promise<Response> {
  const entry = parseEntry(await readJson(request))
  if (typeof entry === 'string') return json({ error: entry }, 400)
  try {
    const name = await claim(entry)
    if (!name) return json({ error: TAKEN }, 409)
    const replies = await redis([
      ['ZADD', KEY, 'GT', encode(entry.level, entry.seconds), name], // GT: solo sube el récord
      ['ZREMRANGEBYRANK', KEY, 0, -(KEEP + 1)],
      ['ZREVRANK', KEY, name],
    ])
    return json({ rank: toRank(replies[2]) })
  } catch (err) {
    return fail(err)
  }
}
