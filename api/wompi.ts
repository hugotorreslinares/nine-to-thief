import { createHash, timingSafeEqual } from 'node:crypto'
import { SOLD_KEY } from './presale.ts'
import { json, readJson, redis } from './scores.ts'

// Webhook de Wompi: cada pago aprobado suma al contador de la preventa.
// Se configura en Wompi (Desarrolladores > Eventos) con la URL https://<dominio>/api/wompi y el
// "secreto de eventos" en WOMPI_EVENTS_SECRET. Sin ese secreto no cuenta nada.
// Cada transacción cuenta una sola vez (hash `presale:tx`), aunque Wompi reenvíe el evento.
// ponytail: una transacción = una unidad; si el enlace permite varias unidades, ajusta el contador a mano.

const TRANSACTIONS = 'presale:tx'

/** Valor en una ruta como "transaction.id" dentro de `data`. */
const pick = (data: unknown, path: string): string => {
  let value: unknown = data
  for (const part of path.split('.')) value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[part] : undefined
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function validSignature(body: Record<string, unknown>, secret: string): boolean {
  const { signature, timestamp, data } = body
  if (typeof signature !== 'object' || signature === null || (typeof timestamp !== 'number' && typeof timestamp !== 'string')) return false
  const { properties, checksum } = signature as Record<string, unknown>
  if (!Array.isArray(properties) || !properties.every((p) => typeof p === 'string') || typeof checksum !== 'string') return false
  const expected = createHash('sha256').update(properties.map((p: string) => pick(data, p)).join('') + String(timestamp) + secret).digest('hex')
  const given = checksum.toLowerCase()
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WOMPI_EVENTS_SECRET
  if (!secret) return json({ error: 'Servicio no configurado' }, 503)
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) return json({ error: 'Cuerpo demasiado grande' }, 413)
  const body = await readJson(request)
  if (typeof body !== 'object' || body === null) return json({ error: 'Cuerpo inválido' }, 400)
  if (!validSignature(body as Record<string, unknown>, secret)) return json({ error: 'Firma inválida' }, 401)
  const { event, data } = body as Record<string, unknown>
  const id = pick(data, 'transaction.id')
  if (event !== 'transaction.updated' || pick(data, 'transaction.status') !== 'APPROVED' || id === '') return json({ ok: true, counted: false })
  try {
    const [isNew] = await redis([['HSETNX', TRANSACTIONS, id, Date.now()]])
    if (Number(isNew) === 1) await redis([['INCR', SOLD_KEY]])
    return json({ ok: true, counted: Number(isNew) === 1 })
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503) // Wompi reintenta
  }
}
