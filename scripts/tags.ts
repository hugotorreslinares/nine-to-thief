// Emite códigos para etiquetas NFC:  node scripts/tags.ts 20
// Añade las URLs a nfc-tags.csv (privado, fuera de git) y sus hashes a api/_tags.ts (se versiona).
// Cada URL es una credencial: quien la tenga entra a esa partida.
import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = 'https://nine-to-thief.vercel.app/play/'
const HASHES = new URL('../api/_tags.ts', import.meta.url)
const CSV = new URL('../nfc-tags.csv', import.meta.url)

const count = Number(process.argv[2] ?? 20)
if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Uso: node scripts/tags.ts <cantidad entre 1 y 1000>')

const known = existsSync(HASHES) ? readFileSync(HASHES, 'utf8').match(/[0-9a-f]{64}/g) ?? [] : []
// 16 bytes = 128 bits de azar: imposible de adivinar, y la URL cabe en una NTAG213 (144 bytes).
const codes = Array.from({ length: count }, () => randomBytes(16).toString('base64url'))
const hashes = [...known, ...codes.map((code) => createHash('sha256').update(code).digest('hex'))]

writeFileSync(HASHES, `// Generado por scripts/tags.ts: SHA-256 de cada código de etiqueta NFC emitido.
// Los códigos no están aquí ni se pueden deducir de estos hashes.
export const TAG_HASHES: ReadonlySet<string> = new Set([
${hashes.map((hash) => `  '${hash}',`).join('\n')}
])
`)
if (!existsSync(CSV)) writeFileSync(CSV, 'toy,url\n')
appendFileSync(CSV, codes.map((code, i) => `${known.length + i + 1},${BASE}${code}\n`).join(''))
console.log(`${count} códigos nuevos (${hashes.length} en total). URLs en nfc-tags.csv`)
