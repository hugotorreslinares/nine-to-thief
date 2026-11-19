// Comentarios de jugadores, el más reciente primero:
//   node --env-file=.env.local scripts/feedback.ts
import { redis } from '../api/scores.ts'

const [list] = await redis([['LRANGE', 'feedback', 0, -1]])
const rows = Array.isArray(list) ? list : []
for (const raw of rows) {
  const { at, rating, text, email, lang } = JSON.parse(String(raw)) as { at: number; rating: number; text: string; email: string; lang: string }
  console.log(`\n${new Date(at).toISOString().slice(0, 16)}  ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}  ${lang}${email ? `  ${email}` : ''}\n${text}`)
}
console.log(`\n${rows.length} comentarios`)
