import { PRESALE_LIMIT, presaleLeft } from '../src/presale.ts'
import { json, redis } from './scores.ts'

// Contador de la preventa: `presale:sold` en Redis lo sube api/wompi.ts con cada pago aprobado.
export const SOLD_KEY = 'presale:sold'

export async function GET(): Promise<Response> {
  try {
    const [sold] = await redis([['GET', SOLD_KEY]])
    const count = Math.max(0, Number(sold ?? 0) || 0)
    return Response.json({ limit: PRESALE_LIMIT, sold: count, left: presaleLeft(count) }, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } })
  } catch (err) {
    console.error(err)
    return json({ error: 'Servicio no disponible' }, 503)
  }
}
