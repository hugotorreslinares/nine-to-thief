import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { COUNTS } from '../src/levels.ts'
import { FRESH, caught, parseProgress, steal, type Progress } from '../src/progress.ts'
import { TAG_HASHES } from './_tags.ts'
import { json, readJson, redis } from './scores.ts'

// Partidas de los art toys. El código de la etiqueta NFC es la credencial: aquí solo se guarda
// su hash. El progreso vive en Redis y solo cambia con las reglas de src/progress.ts.
//
//   tag:<hash del código>  -> id del jugador
//   player:<id>            -> name, email, tag, createdAt, progress, session, sessionAt, run
//
// ponytail: el servidor no simula la partida. Valida qué se puede robar, cuánto dura un intento
// y el ritmo de robos, pero confía en que el cliente avise de las capturas. Si aparecen trampas,
// mover la simulación de los vigilantes al servidor.
// ponytail: leer y escribir no es atómico; dos pestañas del mismo jugador a la vez podrían
// pisarse, pero cada tap invalida la sesión anterior. Pasar a un script Lua si hiciera falta.

const CODE = /^[A-Za-z0-9_-]{16,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const NAME = /^[\p{L}\p{N} _.'-]{1,24}$/u
export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,180}\.[^\s@]{2,24}$/
const CHAR = /^[a-z]{2,16}$/
const SESSION_MS = 12 * 60 * 60 * 1000
/** Un intento dura 60 s (+10 de Oscar); el resto es margen de red. */
const RUN_MS = 80_000
/** Ningún personaje roba más rápido que un objeto cada 0,78 s. */
const STEAL_MS = 700

const sha = (text: string): string => createHash('sha256').update(text).digest('hex')
const same = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const playerKey = (id: string): string => `player:${id}`

/** Hash de un código de etiqueta emitido por nosotros, o undefined. */
function tagOf(code: unknown): string | undefined {
  if (typeof code !== 'string' || !CODE.test(code)) return undefined
  const hash = sha(code)
  return TAG_HASHES.has(hash) ? hash : undefined
}

function fromJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Abre sesión para el dueño de la etiqueta. Cada tap invalida la sesión anterior. */
async function open(tag: string): Promise<Response> {
  const [id] = await redis([['GET', `tag:${tag}`]])
  if (typeof id !== 'string') return json({ registered: false })
  const secret = randomBytes(24).toString('base64url')
  const [, fields] = await redis([
    ['HSET', playerKey(id), 'session', sha(secret), 'sessionAt', Date.now()],
    ['HMGET', playerKey(id), 'name', 'progress'],
  ])
  const [name, progress] = Array.isArray(fields) ? fields : []
  return json({
    registered: true,
    session: `${id}.${secret}`,
    name: typeof name === 'string' ? name : '',
    progress: parseProgress(fromJson(progress)) ?? FRESH,
  })
}

async function register(tag: string, body: Record<string, unknown>): Promise<Response> {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!NAME.test(name)) return json({ error: 'Nombre inválido: 1 a 24 letras o números' }, 400)
  if (!EMAIL.test(email)) return json({ error: 'Correo inválido' }, 400)
  const id = randomUUID()
  // SET NX es atómico: una etiqueta queda atada para siempre al primer jugador que se registra.
  const [bound] = await redis([
    ['SET', `tag:${tag}`, id, 'NX'],
    ['HSET', playerKey(id), 'name', name, 'email', email, 'tag', tag, 'createdAt', Date.now(), 'progress', JSON.stringify(FRESH)],
  ])
  if (bound !== 'OK') await redis([['DEL', playerKey(id)]])
  return open(tag)
}

interface Run {
  readonly at: number
  readonly steals: number
}

function parseRun(raw: unknown): Run | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { at, steals } = raw as Record<string, unknown>
  return typeof at === 'number' && typeof steals === 'number' ? { at, steals } : undefined
}

interface Seat {
  readonly id: string
  readonly progress: Progress
  readonly run: Run | undefined
}

/** Jugador de una sesión vigente, o undefined. */
async function seat(session: unknown): Promise<Seat | undefined> {
  if (typeof session !== 'string') return undefined
  const [id, secret] = session.split('.')
  if (!id || !secret || !UUID.test(id)) return undefined
  const [fields] = await redis([['HMGET', playerKey(id), 'session', 'sessionAt', 'progress', 'run']])
  const [hash, at, progress, run] = Array.isArray(fields) ? fields : []
  if (typeof hash !== 'string' || !same(hash, sha(secret))) return undefined
  if (!(Date.now() - Number(at) < SESSION_MS)) return undefined
  return { id, progress: parseProgress(fromJson(progress)) ?? FRESH, run: parseRun(fromJson(run)) }
}

async function save(id: string, progress: Progress, run: Run | undefined): Promise<Response> {
  await redis([
    ['HSET', playerKey(id), 'progress', JSON.stringify(progress), 'updatedAt', Date.now()],
    run ? ['HSET', playerKey(id), 'run', JSON.stringify(run)] : ['HDEL', playerKey(id), 'run'],
  ])
  return json({ progress })
}

async function act(action: unknown, body: Record<string, unknown>): Promise<Response> {
  const me = await seat(body.session)
  if (!me) return json({ error: 'Sesión terminada: acerca tu art toy otra vez' }, 401)
  const { id, progress, run } = me
  const now = Date.now()
  const reject = (error: string): Response => json({ error, progress }, 409)

  switch (action) {
    case 'start': {
      // El personaje se elige una sola vez y queda ligado al jugador.
      const char = progress.char ?? (typeof body.char === 'string' && CHAR.test(body.char) ? body.char : undefined)
      return save(id, char ? { ...progress, char } : progress, { at: now, steals: 0 })
    }
    case 'steal': {
      if (!run || now - run.at > RUN_MS) return reject('No hay un intento en curso')
      if (run.steals + 1 > 1 + (now - run.at) / STEAL_MS) return reject('Robos demasiado rápidos')
      const next = typeof body.index === 'number' ? steal(progress, body.index, COUNTS) : undefined
      if (!next) return reject('Ese objeto no se puede robar ahora')
      // Al subir de nivel el intento termina: el siguiente nivel pide su propio start.
      return save(id, next, next.level === progress.level ? { at: run.at, steals: run.steals + 1 } : undefined)
    }
    case 'caught':
      if (!run) return reject('No hay un intento en curso')
      return save(id, caught(progress), undefined)
    default:
      return json({ error: 'Acción desconocida' }, 400)
  }
}

export async function POST(request: Request): Promise<Response> {
  const raw = await readJson(request)
  if (typeof raw !== 'object' || raw === null) return json({ error: 'Cuerpo inválido' }, 400)
  const body = raw as Record<string, unknown>
  try {
    if (body.action !== 'open' && body.action !== 'register') return await act(body.action, body)
    const tag = tagOf(body.code)
    if (!tag) return json({ error: 'Etiqueta no reconocida' }, 404)
    return body.action === 'open' ? await open(tag) : await register(tag, body)
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503)
  }
}
