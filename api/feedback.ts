import { createHash } from 'node:crypto'
import { EMAIL } from './play.ts'
import { json, readJson, redis } from './scores.ts'

// Comentarios de jugadores: lista `feedback` de Redis (la más reciente primero), solo escritura desde la web.
// Se leen con: node --env-file=.env.local scripts/feedback.ts
// Defensas: valida y recorta todo, límite por IP (guardada solo como hash), campo trampa para bots,
// tope de comentarios guardados. El texto nunca se muestra en la web, solo se lee en el script local.
// ponytail: un atacante con muchas IPs aún puede mandar basura; añadir captcha si ocurre.

const MAX_TEXT = 1000
const MAX_BODY = 4000
const PER_HOUR = 5
const KEEP = 2000

const clientKey = (request: Request): string => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return `feedback-limit:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`
}

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'Mensaje demasiado largo' }, 413)
  const raw = await readJson(request)
  if (typeof raw !== 'object' || raw === null) return json({ error: 'Cuerpo inválido' }, 400)
  const { text: t, rating: r, email: e, lang, website } = raw as Record<string, unknown>
  if (typeof website === 'string' && website !== '') return json({ ok: true }) // trampa: los bots rellenan todo
  const text = typeof t === 'string' ? t.trim() : ''
  const rating = Number(r)
  const email = typeof e === 'string' ? e.trim().toLowerCase() : ''
  if (text.length < 1 || text.length > MAX_TEXT) return json({ error: 'Texto inválido: 1 a 1000 caracteres' }, 400)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: 'Valoración inválida' }, 400)
  if (email !== '' && !EMAIL.test(email)) return json({ error: 'Correo inválido' }, 400)
  try {
    const key = clientKey(request)
    const [count] = await redis([['INCR', key], ['EXPIRE', key, 3600, 'NX']])
    if (Number(count) > PER_HOUR) return json({ error: 'Demasiados mensajes, prueba más tarde' }, 429)
    const entry = JSON.stringify({ at: Date.now(), rating, text, email, lang: lang === 'en' ? 'en' : 'es' })
    await redis([['LPUSH', 'feedback', entry], ['LTRIM', 'feedback', 0, KEEP - 1]])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503)
  }
}
