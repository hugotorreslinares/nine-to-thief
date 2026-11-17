import { EMAIL } from './play.ts'
import { json, readJson, redis } from './scores.ts'

// Lista de espera de los art toys: hash `waitlist` de Redis, correo -> { at, lang }.
// Se lee con: node --env-file=.env.local scripts/waitlist.ts
// ponytail: sin límite de peticiones ni confirmación del correo; añadir doble opt-in si llega basura.

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  const { email: raw, lang } = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!EMAIL.test(email)) return json({ error: 'Correo inválido' }, 400)
  try {
    // HSETNX: apuntarse dos veces conserva la primera fecha.
    await redis([['HSETNX', 'waitlist', email, JSON.stringify({ at: Date.now(), lang: lang === 'en' ? 'en' : 'es' })]])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503)
  }
}
