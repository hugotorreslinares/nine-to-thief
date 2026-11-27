// Jugadores únicos y partidas, total y por origen:
//   node --env-file=.env.local scripts/stats.ts
import { redis } from '../api/scores.ts'

const [players, plays, srcs] = await redis([['PFCOUNT', 'players'], ['GET', 'plays'], ['SMEMBERS', 'srcs']])
console.log(`Total: ${players ?? 0} jugadores únicos, ${plays ?? 0} partidas`)
const sources = Array.isArray(srcs) ? srcs.map(String).sort() : []
if (sources.length) {
  const rows = await redis(sources.flatMap((s) => [['PFCOUNT', `players:${s}`], ['GET', `plays:${s}`]]))
  sources.forEach((s, i) => console.log(`  ${s}\t${rows[i * 2] ?? 0} jugadores\t${rows[i * 2 + 1] ?? 0} partidas`))
}
