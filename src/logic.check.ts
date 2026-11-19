import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { decode, encode, parseClaim, parseEntry } from '../api/scores.ts'
import { POST } from '../api/play.ts'
import { POST as joinWaitlist } from '../api/waitlist.ts'
import { POST as sendFeedback } from '../api/feedback.ts'
import { EN } from './i18n.ts'
import { CHAIRS, CHARACTERS, FURNITURE, MAP, OBJECTS, ROUTES, SPAWN, WALLS, extraObjects, randomLayout } from './data.ts'
import { COUNTS, LEVELS } from './levels.ts'
import { FRESH, MAX_STARS, caught, steal, type Progress } from './progress.ts'
import { PAD_BUTTON, applyPick, parseHostMessage, parsePadState, parsePick, parseToy, type Picks } from './padState.ts'
import { coopZoom, MAX_ZOOM, box, canSee, rayDistance, resolveCircle, turnToward } from './logic.ts'

const viewer = { x: 0, z: 0, dir: 0, range: 5, halfAngle: Math.PI / 6 }
const wall = [box(2, 0, 0.3, 4)]

assert.equal(canSee(viewer, { x: 3, z: 0 }, []), true, 've de frente')
assert.equal(canSee(viewer, { x: -3, z: 0 }, []), false, 'no ve atrás')
assert.equal(canSee(viewer, { x: 3, z: 3 }, []), false, 'fuera del cono')
assert.equal(canSee(viewer, { x: 6, z: 0 }, []), false, 'fuera de alcance')
assert.equal(canSee(viewer, { x: 3, z: 0 }, wall), false, 'la pared tapa')
assert.equal(canSee(viewer, { x: 1.5, z: 0 }, wall), true, 've delante de la pared')

assert.ok(Math.abs(rayDistance(0, 0, 1, 0, 5, wall) - 1.85) < 1e-9, 'rayo corta en la pared')
assert.equal(rayDistance(0, 0, 0, 1, 5, wall), 5, 'rayo paralelo no choca')

const pushed = resolveCircle(1.7, 0, 0.35, wall)
assert.ok(Math.abs(pushed.x - 1.5) < 1e-9, 'el círculo sale de la pared')

assert.equal(turnToward(3, -3, 10), -3, 'gira por el camino corto')
assert.ok(turnToward(3, -3, 0.1) > 3, 'cruza por ±π')

assert.deepEqual(decode(encode(7, 42)), { level: 7, seconds: 42 }, 'puntaje ida y vuelta')
assert.ok(encode(3, 0) > encode(2, 99), 'el nivel pesa más que el tiempo')
const token = '123e4567-e89b-42d3-a456-426614174000'
assert.deepEqual(parseEntry({ name: '  Ana ', token, level: 2, seconds: 10 }), { name: 'Ana', token, level: 2, seconds: 10 })
assert.equal(typeof parseClaim({ name: 'Ana' }), 'string', 'rechaza reserva sin token')
assert.equal(typeof parseClaim({ name: 'Ana', token: 'corto' }), 'string', 'rechaza token mal formado')
assert.equal(typeof parseEntry({ name: '<b>x</b>', token, level: 2, seconds: 10 }), 'string', 'rechaza HTML en el apodo')
assert.equal(typeof parseEntry({ name: 'Ana', token, level: 2.5, seconds: 10 }), 'string', 'rechaza nivel no entero')
assert.equal(typeof parseEntry({ name: 'Ana', token, level: 500, seconds: 10 }), 'string', 'rechaza nivel imposible')

// ---------- Mapa ----------

const solid = [...WALLS, ...FURNITURE.map((f) => f.box)]
const inside = (pt: { x: number; z: number }, b: { minX: number; maxX: number; minZ: number; maxZ: number }, pad = 0): boolean =>
  pt.x > b.minX - pad && pt.x < b.maxX + pad && pt.z > b.minZ - pad && pt.z < b.maxZ + pad
ROUTES.forEach((route, r) => route.forEach((from, i) => {
  const to = route[(i + 1) % route.length] ?? from
  const dist = Math.hypot(to.x - from.x, to.z - from.z)
  assert.ok(rayDistance(from.x, from.z, (to.x - from.x) / dist, (to.z - from.z) / dist, dist, solid) >= dist, `ruta ${r}, tramo ${i}: atraviesa algo`)
}))
for (const pt of [SPAWN, ...CHAIRS, ...CHARACTERS.map((c) => c.home)]) {
  assert.ok(pt.x > 0 && pt.x < MAP.w && pt.z > 0 && pt.z < MAP.d && !solid.some((b) => inside(pt, b, 0.2)), `punto dentro de un obstáculo: ${pt.x}, ${pt.z}`)
}
// Todo objeto está al alcance (1,5 m) de algún sitio donde cabe el jugador.
/** Generador con semilla (mulberry32): las pruebas de reparto al azar tienen que repetirse. */
const seeded = (seed: number): (() => number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// El reparto fijo y varios repartos al azar: todos alcanzables, sin objetos encimados y con los mismos números que el servidor.
const layouts = [OBJECTS, ...[1, 2, 3, 4, 5, 6, 7, 8].map((seed) => randomLayout(seeded(seed)))]
assert.notDeepEqual(layouts[1]?.map((o) => [o.x, o.z]), layouts[2]?.map((o) => [o.x, o.z]), 'semillas distintas dan repartos distintos')
for (const layout of layouts) {
  for (const [i, kind] of LEVELS.entries()) {
    const here = layout.filter((o) => o.level === i + 1)
    assert.equal(here.length, kind.places.length, `nivel ${i + 1}: el mismo número de objetos`)
    assert.deepEqual(here.map((o) => o.index), here.map((_, k) => k), `nivel ${i + 1}: índices 0..n-1`)
    assert.ok(here.every((a, k) => here.every((b, m) => k === m || Math.hypot(a.x - b.x, a.z - b.z) > 0.3)), `nivel ${i + 1}: objetos encimados`)
  }
}
for (const o of layouts.flat()) {
  let reachable = false
  for (let a = 0; a < 32 && !reachable; a++) {
    for (const d of [0.6, 0.9, 1.2, 1.45]) {
      const pt = { x: o.x + Math.cos((a * Math.PI) / 16) * d, z: o.z + Math.sin((a * Math.PI) / 16) * d }
      if (!solid.some((b) => inside(pt, b, 0.35))) reachable = true
    }
  }
  assert.ok(reachable, `objeto inalcanzable: nivel ${o.level}, n.º ${o.index}`)
}

// ---------- Progresión ----------

const first = COUNTS[0] ?? 0
assert.equal(COUNTS.length, 10, 'hay 10 niveles')
assert.equal(steal(FRESH, first, COUNTS), undefined, 'rechaza un objeto que no existe')
assert.equal(steal({ ...FRESH, stolen: [0] }, 0, COUNTS), undefined, 'rechaza robar dos veces lo mismo')
let p: Progress = FRESH
for (let i = 0; i < first; i++) p = steal(p, i, COUNTS) ?? assert.fail('robo válido rechazado')
assert.deepEqual(p, { ...FRESH, level: 2, best: 1 }, 'robar todo sube de nivel')
assert.equal(steal({ ...FRESH, level: 11 }, 0, COUNTS), undefined, 'con la oficina vacía no queda nada')
p = { ...p, stolen: [1] }
for (let i = 1; i < MAX_STARS; i++) p = caught(p)
assert.deepEqual([p.level, p.stars, p.stolen], [2, 4, [1]], 'cuatro capturas no bajan de nivel')
p = caught(p)
assert.deepEqual([p.level, p.stars, p.captures, p.stolen], [1, 0, 5, []], 'la quinta baja un nivel y devuelve sus objetos')
for (let i = 0; i < MAX_STARS; i++) p = caught(p)
assert.equal(p.level, 1, 'nunca baja del nivel 1')

// ---------- Partidas: api/play.ts contra un Redis falso en memoria ----------

const strings = new Map<string, string>()
const hashes = new Map<string, Map<string, string>>()
const lists = new Map<string, string[]>()
const hashOf = (key: string): Map<string, string> => hashes.get(key) ?? hashes.set(key, new Map()).get(key) ?? assert.fail()
function fakeRedis([cmd, key = '', ...args]: readonly string[]): unknown {
  switch (cmd) {
    case 'GET': return strings.get(key) ?? null
    case 'SET': return strings.has(key) ? null : (strings.set(key, args[0] ?? ''), 'OK') // siempre NX
    case 'DEL': return Number(hashes.delete(key))
    case 'HSET': for (let i = 0; i + 1 < args.length; i += 2) hashOf(key).set(args[i] ?? '', args[i + 1] ?? ''); return 1
    case 'HSETNX': return hashOf(key).has(args[0] ?? '') ? 0 : (hashOf(key).set(args[0] ?? '', args[1] ?? ''), 1)
    case 'INCR': return Number(strings.set(key, String(Number(strings.get(key) ?? 0) + 1)).get(key))
    case 'EXPIRE': return 1
    case 'LPUSH': return (lists.get(key) ?? lists.set(key, []).get(key) ?? assert.fail()).unshift(args[0] ?? '')
    case 'LTRIM': lists.set(key, (lists.get(key) ?? []).slice(Number(args[0]), Number(args[1]) + 1)); return 'OK'
    case 'HDEL': return Number(hashOf(key).delete(args[0] ?? ''))
    case 'HMGET': return args.map((field) => hashOf(key).get(field) ?? null)
    default: throw new Error(`Redis falso: falta ${cmd}`)
  }
}
process.env.KV_REST_API_URL = 'http://redis.test'
process.env.KV_REST_API_TOKEN = 'test'
globalThis.fetch = async (_url, init) => {
  const commands = JSON.parse(String(init?.body)) as (string | number)[][]
  return Response.json(commands.map((command) => ({ result: fakeRedis(command.map(String)) })))
}

const play = async (body: object): Promise<{ status: number; data: Record<string, unknown> }> => {
  const res = await POST(new Request('http://x/api/play', { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, data: (await res.json()) as Record<string, unknown> }
}

const csv = new URL('../nfc-tags.csv', import.meta.url)
if (existsSync(csv)) {
  const [code, other] = [...readFileSync(csv, 'utf8').matchAll(/\/play\/([\w-]+)/g)].map((m) => m[1] ?? '')
  assert.equal((await play({ action: 'open', code: 'x'.repeat(22) })).status, 404, 'rechaza un código inventado')
  assert.equal((await play({ action: 'open', code })).data.registered, false, 'etiqueta nueva: pide registro')
  assert.equal((await play({ action: 'register', code, name: 'Ana', email: 'no-es-correo' })).status, 400, 'valida el correo')
  const ana = (await play({ action: 'register', code, name: 'Ana', email: 'ana@example.com' })).data
  assert.deepEqual([ana.registered, ana.name, ana.progress], [true, 'Ana', FRESH], 'registra y abre sesión')
  assert.ok(!JSON.stringify(ana).includes('example.com'), 'el correo no sale del servidor')
  const again = (await play({ action: 'register', code, name: 'Eva', email: 'eva@example.com' })).data
  assert.equal(again.name, 'Ana', 'una etiqueta ya registrada no cambia de dueño')
  const { session } = again
  assert.equal((await play({ action: 'start', session: ana.session, char: 'lucia' })).status, 401, 'un tap nuevo invalida la sesión anterior')
  assert.equal((await play({ action: 'steal', session, index: 0 })).status, 409, 'no se roba sin intento en curso')
  assert.deepEqual((await play({ action: 'start', session, char: 'lucia' })).data.progress, { ...FRESH, char: 'lucia' }, 'empieza y fija el personaje')
  assert.equal((await play({ action: 'steal', session, index: 99 })).status, 409, 'rechaza objetos de otro nivel')
  assert.deepEqual((await play({ action: 'steal', session, index: 0 })).data.progress, { ...FRESH, char: 'lucia', stolen: [0] }, 'guarda el robo')
  assert.equal((await play({ action: 'steal', session, index: 1 })).status, 409, 'rechaza robos más rápidos de lo posible')
  assert.equal((await play({ action: 'caught', session })).status, 200, 'registra la captura')
  const back = (await play({ action: 'open', code })).data
  assert.deepEqual(back.progress, { ...FRESH, char: 'lucia', stolen: [0], stars: 1, captures: 1 }, 'al volver sigue donde lo dejó')
  assert.deepEqual((await play({ action: 'start', session: back.session, char: 'teo' })).data.progress, back.progress, 'el personaje no se cambia')
  const eve = (await play({ action: 'register', code: other, name: 'Eva', email: 'eva@example.com' })).data
  assert.deepEqual(eve.progress, FRESH, 'cada etiqueta tiene su propia partida')
} else {
  console.warn('Sin nfc-tags.csv: se omiten las pruebas de partidas')
}

// ---------- Lista de espera ----------

const wait = (email: unknown): Promise<Response> => joinWaitlist(new Request('http://x/api/waitlist', { method: 'POST', body: JSON.stringify({ email, lang: 'en' }) }))
assert.equal((await wait('no-es-correo')).status, 400, 'la lista de espera valida el correo')
assert.equal((await wait(' Fan@Example.com ')).status, 200, 'apunta un correo')
assert.ok(hashOf('waitlist').has('fan@example.com'), 'lo guarda normalizado')

// ---------- Comentarios ----------

const feedback = (body: object, ip = '1.1.1.1'): Promise<Response> =>
  sendFeedback(new Request('http://x/api/feedback', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) }))
assert.equal((await feedback({ rating: 4, text: 'Muy bueno', lang: 'es' })).status, 200, 'guarda un comentario válido')
assert.equal(JSON.parse(lists.get('feedback')?.[0] ?? '{}').text, 'Muy bueno', 'queda en la lista')
assert.equal((await feedback({ rating: 9, text: 'x' }, '2.2.2.2')).status, 400, 'valoración fuera de rango')
assert.equal((await feedback({ rating: 3, text: '   ' }, '2.2.2.2')).status, 400, 'texto vacío')
assert.equal((await feedback({ rating: 3, text: 'x'.repeat(1001) }, '2.2.2.2')).status, 400, 'texto demasiado largo')
assert.equal((await feedback({ rating: 3, text: 'hola', email: 'no' }, '2.2.2.2')).status, 400, 'correo inválido')
const before = lists.get('feedback')?.length
assert.equal((await feedback({ rating: 3, text: 'spam', website: 'http://x' }, '3.3.3.3')).status, 200, 'la trampa responde bien')
assert.equal(lists.get('feedback')?.length, before, 'pero no guarda nada')
for (let i = 0; i < 5; i++) await feedback({ rating: 3, text: 'otro' }, '4.4.4.4')
assert.equal((await feedback({ rating: 3, text: 'otro' }, '4.4.4.4')).status, 429, 'límite de 5 por hora y por IP')

// ---------- Traducciones ----------

const used = new Set<string>([...LEVELS.map((kind) => kind.plural), ...CHARACTERS.flatMap((c) => [c.ability.name, c.ability.text])])
const srcDir = new URL('.', import.meta.url)
for (const file of readdirSync(srcDir).filter((name) => name.endsWith('.ts'))) {
  for (const found of readFileSync(new URL(file, srcDir), 'utf8').matchAll(/\bt\('([^']+)'/g)) used.add(found[1] ?? '')
}
for (const text of used) assert.ok(text in EN, `falta la traducción al inglés de: ${text}`)

assert.deepEqual(parsePadState([0.5, -2, PAD_BUTTON.grab | PAD_BUTTON.ok]), { x: 0.5, y: -1, buttons: 5 }, 'mando válido, palanca acotada')
assert.deepEqual(parsePadState([0, 0, PAD_BUTTON.zoom | 0x20]), { x: 0, y: 0, buttons: PAD_BUTTON.zoom }, 'el botón de zoom pasa y los bits desconocidos se descartan')
assert.equal(parsePadState([0, 0]), undefined, 'rechaza mensajes cortos')
assert.equal(parsePadState(['a', 0, 0]), undefined, 'rechaza tipos erróneos')
assert.equal(parsePadState([Infinity, 0, 0]), undefined, 'rechaza no finitos')
assert.equal(parsePadState([0, 0, 1.5]), undefined, 'rechaza botones no enteros')

assert.equal(parseToy({ toy: 'm6GgxxLDPO-epjJIwfmAiw' }), 'm6GgxxLDPO-epjJIwfmAiw', 'credencial de art toy válida')
assert.equal(parseToy({ toy: 'corta' }), undefined, 'rechaza credenciales cortas')
assert.equal(parseToy({ toy: '../../etc/passwd/xxxxxxxx' }), undefined, 'rechaza caracteres raros')
assert.equal(parseToy([0, 0, 0]), undefined, 'un estado de mando no es un art toy')

assert.deepEqual(parseHostMessage({ slot: 1 }), { slot: 1 }, 'jugador asignado')
assert.deepEqual(parseHostMessage({ full: true }), { full: true }, 'sala llena')
assert.equal(parseHostMessage({ slot: 2 }), undefined, 'solo hay dos jugadores')
assert.equal(parseHostMessage([1]), undefined, 'un estado de mando no es un mensaje de la tele')

// Elección de personaje desde el celular: sin repetir, sin ids desconocidos y respetando lo bloqueado.
const known = new Set(CHARACTERS.map((c) => c.id))
const none: Picks = [null, null]
const afterOne = applyPick(none, 0, 'bea', known)
assert.deepEqual(afterOne, ['bea', null], 'el jugador 1 elige')
assert.deepEqual(applyPick(afterOne, 1, 'nine', known), ['bea', 'nine'], 'el jugador 2 elige otro')
assert.equal(applyPick(afterOne, 1, 'bea', known), afterOne, 'no se puede repetir el personaje del otro')
assert.equal(applyPick(none, 0, 'fantasma', known), none, 'id desconocido')
assert.equal(applyPick(none, 1, 'nine', known, new Set(['nine'])), none, 'personaje bloqueado (el del art toy)')
assert.equal(applyPick(afterOne, 0, 'bea', known), afterOne, 'elegir lo mismo no cambia nada')
assert.deepEqual(applyPick(afterOne, 0, 'marco', known), ['marco', null], 'cambiar de idea')
assert.equal(parsePick({ pick: 'bea' }), 'bea', 'mensaje de elección válido')
assert.equal(parsePick({ pick: '../x' }), undefined, 'rechaza ids raros')
assert.equal(parsePick([1, 2, 3]), undefined, 'un estado de mando no es una elección')
assert.deepEqual(parseHostMessage({ picks: ['bea', null] }), { picks: ['bea', null] }, 'estado de elecciones')
assert.equal(parseHostMessage({ picks: ['bea'] }), undefined, 'estado de elecciones incompleto')
assert.equal(parseHostMessage({ picks: ['BEA', null] }), undefined, 'estado de elecciones con id inválido')

// Objetos extra del modo de a dos: en escritorios libres, sin pisar los del nivel y fuera del progreso guardado.
for (const kind of [1, 4, 10]) {
  const extra = extraObjects(kind, 3)
  assert.equal(extra.length, 3, `nivel ${kind}: tres extras`)
  assert.ok(extra.every((o) => o.index < 0), 'los extras no tienen índice de progreso')
  const base = OBJECTS.filter((o) => o.level === kind)
  assert.ok(extra.every((o) => base.every((b) => Math.hypot(b.x - o.x, b.z - o.z) > 0.5)), `nivel ${kind}: no se superponen con los del nivel`)
  assert.equal(new Set(extra.map((o) => `${o.x},${o.z}`)).size, 3, `nivel ${kind}: sitios distintos`)
}
assert.equal(extraObjects(1, 0).length, 0, 'sin extras')

// Cámara compartida: juntos no hay zoom, lejos se aleja, y nunca pasa del máximo.
const view = 15
assert.equal(coopZoom({ x: 5, z: 5 }, { x: 6, z: 6 }, 16 / 9, view), 1, 'juntos: sin zoom')
assert.ok(coopZoom({ x: 2, z: 2 }, { x: 30, z: 20 }, 16 / 9, view) > 1, 'lejos: se aleja')
assert.equal(coopZoom({ x: 0, z: 0 }, { x: 400, z: 0 }, 16 / 9, view), MAX_ZOOM, 'tope de zoom')
assert.ok(coopZoom({ x: 2, z: 2 }, { x: 30, z: 2 }, 9 / 16, view) > coopZoom({ x: 2, z: 2 }, { x: 30, z: 2 }, 16 / 9, view), 'pantalla estrecha: más zoom')

console.log('logic ok')
