// Contador de la preventa:
//   node --env-file=.env.local scripts/presale.ts          # ver vendidas
//   node --env-file=.env.local scripts/presale.ts set 3    # fijar vendidas a mano (ventas fuera de Wompi)
import { PRESALE_LIMIT } from '../src/presale.ts'
import { SOLD_KEY } from '../api/presale.ts'
import { redis } from '../api/scores.ts'

const [action, value] = process.argv.slice(2)
if (action === 'set') {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new Error('Uso: presale.ts set <número entero >= 0>')
  await redis([['SET', SOLD_KEY, n]])
}
const [sold] = await redis([['GET', SOLD_KEY]])
console.log(`${Number(sold ?? 0)} vendidas de ${PRESALE_LIMIT}`)
