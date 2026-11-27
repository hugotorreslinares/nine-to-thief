import { json, readJson, redis } from './scores.ts'

// Jugadores únicos (HyperLogLog, ~1 % de error) y partidas, total y por origen.
// Claves: `players`, `plays`, `players:<src>`, `plays:<src>`, set `srcs`. Se lee con: node --env-file=.env.local scripts/stats.ts
// ponytail: sin límite de peticiones; un cliente malicioso puede inflar la cuenta.

const SAFE = /^[\w.-]{1,40}$/

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  const { id, src } = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  if (typeof id !== 'string' || !SAFE.test(id)) return json({ error: 'id inválido' }, 400)
  const source = typeof src === 'string' && SAFE.test(src) ? src.toLowerCase() : 'direct'
  try {
    await redis([
      ['PFADD', 'players', id],
      ['INCR', 'plays'],
      ['PFADD', `players:${source}`, id],
      ['INCR', `plays:${source}`],
      ['SADD', 'srcs', source],
    ])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503)
  }
}
