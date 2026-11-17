// Lista de espera de los art toys, la más reciente al final:
//   node --env-file=.env.local scripts/waitlist.ts
import { redis } from '../api/scores.ts'

const [flat] = await redis([['HGETALL', 'waitlist']])
const pairs = Array.isArray(flat) ? flat.map(String) : []
const rows: { email: string; at: number; lang: string }[] = []
for (let i = 0; i + 1 < pairs.length; i += 2) {
  const { at, lang } = JSON.parse(pairs[i + 1] ?? '{}') as { at?: number; lang?: string }
  rows.push({ email: pairs[i] ?? '', at: at ?? 0, lang: lang ?? '' })
}
rows.sort((a, b) => a.at - b.at)
for (const row of rows) console.log(`${new Date(row.at).toISOString().slice(0, 10)}\t${row.lang}\t${row.email}`)
console.log(`${rows.length} en lista de espera`)
