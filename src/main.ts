import * as THREE from 'three'
import './style.css'
import {
  CHAIRS, CHAIR_R, CHARACTERS, CONFERENCE, FURNITURE, LEVEL_SECONDS, MAP, OBJECTS, PATROL_ORDER, ROOMS, ROUTES, SPAWN, WALLS,
  COOP_EXTRA, awayCount, extraObjects, levelConfig, randomLayout, type Character, type LevelConfig, type OfficeObject,
} from './data.ts'
import { bakeChildren, mergeColored } from './bake.ts'
import { LITE, TOUCH, TV } from './device.ts'
import { buildFigure, loadModelFigure, reactFigure, setMask, swingLimbs } from './figure.ts'
import { lang, setLang, t } from './i18n.ts'
import { COUNTS, DEMO_COUNTS, LEVELS } from './levels.ts'
import { FRESH, MAX_STARS, caught, steal, type Progress } from './progress.ts'
import { PlayError, close, idle, joinWaitlist, open, register, report, sendFeedback, type Account } from './session.ts'
import { PAD_BUTTON, applyPick, type Picks } from './padState.ts'
import { mugshotHtml, posterHtml } from './poster.ts'
import qrcode from 'qrcode-generator'
import { Remote, type RemoteStatus } from './remote.ts'
import { sendToy } from './toyLink.ts'
import { surface, type Surface } from './surface.ts'
import { claimNick, cleanNick, fetchBoard, isTaken, loadNick, saveNick, submitScore } from './scores.ts'
import { canSee, coopZoom, rayDistance, resolveCircle, turnToward, type Box, type Pt } from './logic.ts'

const BASE_SPEED = 5
const BASE_GRAB = 0.65
const REACH = 1.5
const PLAYER_R = 0.35
const NPC_R = 0.3
const NPC_GAP = 0.6
/** Fracción del solape que cede el vigilante al ser empujado. */
const PUSH_NPC = 0.7
/** Velocidad con la que un vigilante empujado vuelve a su puesto. */
const RETURN_SPEED = 1.5
const VIEW = 15
const VIEW_SHORT = 10
/** Ancho mínimo visible en metros: en vertical la cámara se aleja para no quedar a ciegas. */
const MIN_VIEW_WIDTH = 10
/** Con un solo jugador, la vista puede acercarse al personaje (se recuerda en cada dispositivo; la tele arranca cerca). */
const ZOOM_KEY = 'office-theft-zoom'
const CLOSE_ZOOM = 0.62

/** Silencio: se recuerda en cada dispositivo. */
const MUTE_KEY = 'office-theft-muted'

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch (err) {
    console.warn('Sin acceso a localStorage', err)
    return false
  }
}

function loadCloseUp(): boolean {
  try {
    const saved = localStorage.getItem(ZOOM_KEY)
    if (saved === 'close' || saved === 'far') return saved === 'close'
  } catch (err) {
    console.warn('Sin acceso a localStorage', err)
  }
  return TV
}

/** Texto según el aparato: táctil, televisor o teclado. */
const pick = (touch: string, tv: string, keyboard: string): string => t(TOUCH ? touch : TV ? tv : keyboard)
/** Leyenda de controles durante la partida: teclas en cajitas y lo que hace cada una. Solo textos propios. */
function legendHtml(): string {
  const key = (k: string): string => `<kbd class="rounded bg-white px-1.5 font-sans font-bold tracking-normal text-black [text-shadow:none]">${k}</kbd>`
  const item = (keys: string, what: string): string => `<span class="flex items-center gap-1">${keys} <span>${what}</span></span>`
  if (TV) {
    return [
      item(`${key('◀')}${key('▲')}${key('▼')}${key('▶')}`, t('MOVER')),
      item(key('OK'), t('ROBAR (mantén)')),
      item(key('PLAY'), t('HABILIDAD')),
      item(key(t('ATRÁS')), t('MENÚ')),
    ].join('')
  }
  return [
    item(`${key('W')}${key('A')}${key('S')}${key('D')} / ${key('←')}${key('↑')}${key('↓')}${key('→')}`, t('MOVER')),
    item(key('E'), t('ROBAR (mantén)')),
    item(key('Q'), t('HABILIDAD')),
    item(key('Z'), t('ZOOM')),
    item(key('F'), t('LANZAR')),
    item(key('M'), t('SILENCIO')),
    item(key('Esc'), t('MENÚ')),
  ].join('')
}

/** Teclas de habilidad: Q, y en el mando de la tele Menú, los botones de colores y Play/Pausa. */
const ABILITY_KEYS = new Set(['KeyQ', 'ContextMenu', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause'])

declare global {
  interface Window {
    /** Lo llama la app Android al pulsar Atrás: true si el juego lo gestionó, false para cerrar la app. */
    tvBack?: () => boolean
  }
}
const RAYS = 20
const WALL_H = 1.2
const CONE = { idle: 0xffe066, inside: 0xff9f1a, alert: 0xff2d2d } as const

const SOLID: readonly Box[] = [...WALLS, ...FURNITURE.map((f) => f.box)]
const SIGHT: readonly Box[] = [...WALLS, ...FURNITURE.filter((f) => f.sight).map((f) => f.box)]

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Falta el elemento ${selector}`)
  return found
}

// ---------- Render ----------

const canvas = el<HTMLCanvasElement>('#game')
// Muchos televisores Android solo dan WebGL 1: Three.js r162 es la última que trae el renderizador para eso.
const probe = document.createElement('canvas').getContext('webgl2')
const hasWebGL2 = probe !== null
probe?.getExtension('WEBGL_lose_context')?.loseContext() // el sondeo no debe gastar uno de los pocos contextos del navegador
const renderer = new (hasWebGL2 ? THREE.WebGLRenderer : THREE.WebGL1Renderer)({ canvas, antialias: !LITE, alpha: true })
renderer.shadowMap.enabled = !LITE
renderer.shadowMap.autoUpdate = false // las sombras se redibujan una de cada dos veces (ver frame)

// El protagonista es el modelo 3D de la figura física (más liviano en la tele); si no carga, se arma con piezas.
const heroModel = await loadModelFigure(LITE ? '/models/nine-tv.glb' : '/models/nine-desktop.glb', 1.5)
const figures = new Map(CHARACTERS.map((c) => [c.id, c.hero && heroModel ? heroModel : buildFigure(c.look)]))
const figureOf = (c: Character): THREE.Group => {
  const fig = figures.get(c.id)
  if (!fig) throw new Error(`Sin figura para ${c.id}`)
  return fig
}
for (const c of CHARACTERS) if (c.hero) setMask(figureOf(c), true) // el antifaz no se quita nunca

/** Retratos para el menú, sacados con el mismo renderer antes de montar la escena. */
function renderPortraits(): Map<string, string> {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 2.4))
  const sun = new THREE.DirectionalLight(0xffffff, 1.5)
  sun.position.set(3, 4, 2)
  scene.add(sun)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  cam.position.set(3.3, 1.5, 1.5)
  cam.lookAt(0, 0.85, 0)
  renderer.setSize(160, 160, false)
  const out = new Map<string, string>()
  for (const c of CHARACTERS) {
    const fig = figureOf(c)
    scene.add(fig)
    renderer.render(scene, cam)
    out.set(c.id, canvas.toDataURL())
    scene.remove(fig)
  }
  return out
}
const portraits = renderPortraits()

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x15161c)
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a99, 1.7))
const sun = new THREE.DirectionalLight(0xfff2dd, 2)
sun.position.set(MAP.w / 2 - 10, 26, MAP.d / 2 + 9)
sun.target.position.set(MAP.w / 2, 0, MAP.d / 2)
sun.castShadow = !LITE
sun.shadow.mapSize.setScalar(1024)
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 })
scene.add(sun, sun.target)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

/** Zoom de la cámara compartida: 1 con un jugador; con dos se aleja lo justo para que quepan. */
let zoom = 1

/** Alto de la vista (en metros) con un solo jugador. */
function baseView(): number {
  // Celular en horizontal: pantalla baja, se acerca para que las figuras no queden diminutas.
  const base = innerHeight < 500 ? VIEW_SHORT : VIEW
  return Math.max(base, MIN_VIEW_WIDTH / (innerWidth / innerHeight))
}

function applyView(): void {
  const aspect = innerWidth / innerHeight
  const view = baseView() * zoom
  camera.left = (-view * aspect) / 2
  camera.right = (view * aspect) / 2
  camera.top = view / 2
  camera.bottom = -view / 2
  camera.updateProjectionMatrix()
}

function resize(): void {
  applyView()
  renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 1.5)) // la GPU de la tele no da para 1080p
  renderer.setSize(innerWidth, innerHeight, false)
}
addEventListener('resize', resize)
resize()

function lookAt(x: number, z: number): void {
  camera.position.set(x + 15, 12.25, z + 15)
  camera.lookAt(x, 0, z)
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)

// El mundo fijo (suelos, paredes, muebles) se arma pieza a pieza y se funde al final en dos mallas.
const floorParts: THREE.Mesh[] = []
const solidParts: THREE.Mesh[] = []

function addBox(b: Box, h: number, color: number, y = 0, into: THREE.Mesh[] = solidParts): void {
  const mesh = new THREE.Mesh(UNIT_BOX, surface(color, 0.8))
  mesh.scale.set(b.maxX - b.minX, h, b.maxZ - b.minZ)
  mesh.position.set((b.minX + b.maxX) / 2, y + h / 2, (b.minZ + b.maxZ) / 2)
  into.push(mesh)
}

for (const room of ROOMS) addBox(room.box, 0.02, room.color, -0.02, floorParts)
for (const wall of WALLS) addBox(wall, WALL_H, 0xe8e4da)
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, LITE ? 8 : 16)

function addDetail(geo: THREE.BufferGeometry, color: number, size: readonly [number, number, number], at: readonly [number, number, number]): void {
  const mesh = new THREE.Mesh(geo, surface(color, 0.6))
  mesh.scale.set(...size)
  mesh.position.set(...at)
  solidParts.push(mesh)
}

for (const f of FURNITURE) {
  addBox(f.box, f.h, f.color)
  const fx = (f.box.minX + f.box.maxX) / 2
  const fz = (f.box.minZ + f.box.maxZ) / 2
  if (f.kind === 'plant') {
    addDetail(UNIT_CYLINDER, 0x5a3a22, [0.06, 0.4, 0.06], [fx, f.h + 0.2, fz])
    addDetail(new THREE.IcosahedronGeometry(0.5, 0), 0x2f8f4e, [0.9, 1.1, 0.9], [fx, f.h + 0.75, fz])
  } else if (f.kind === 'cooler') {
    addDetail(UNIT_CYLINDER, 0x6ec6ff, [0.34, 0.45, 0.34], [fx, f.h + 0.225, fz])
  } else if (f.kind === 'copier') {
    addDetail(UNIT_BOX, 0x3a3d44, [1.45, 0.08, 1.05], [fx, f.h + 0.04, fz]) // tapa
    addDetail(UNIT_BOX, 0x22252b, [0.4, 0.06, 0.25], [fx + 0.4, f.h + 0.11, fz - 0.3]) // panel
    addDetail(UNIT_BOX, 0xf5f5f5, [0.5, 0.04, 0.7], [f.box.minX - 0.25, f.h * 0.6, fz]) // bandeja con papel
  }
  if (f.kind !== 'desk') continue
  // Monitor en la mitad opuesta a donde aparecen los objetos.
  const cx = (f.box.minX + f.box.maxX) / 2
  const cz = (f.box.minZ + f.box.maxZ) / 2
  const w = f.box.maxX - f.box.minX
  const d = f.box.maxZ - f.box.minZ
  const along = w >= d
  const screen: Box = along
    ? { minX: cx - w / 4 - 0.25, maxX: cx - w / 4 + 0.25, minZ: cz - 0.04, maxZ: cz + 0.04 }
    : { minX: cx - 0.04, maxX: cx + 0.04, minZ: cz - d / 4 - 0.25, maxZ: cz - d / 4 + 0.25 }
  addBox(screen, 0.38, 0x22252b, f.h)
}

for (const [parts, casts] of [[floorParts, false], [solidParts, true]] as const) {
  const world = mergeColored(parts as THREE.Mesh<THREE.BufferGeometry, Surface>[], 0.8)
  if (!world) continue
  world.castShadow = casts
  world.receiveShadow = true
  scene.add(world)
}

// ---------- Estado ----------

interface Npc {
  readonly char: Character
  readonly fig: THREE.Group
  readonly cone: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  readonly phase: number
  x: number
  z: number
  dir: number
  route: readonly Pt[] | undefined
  wp: number
  lure: Pt
  lureT: number
  freezeT: number
  blindT: number
  blindK: number
  seenT: number
  /** Sorpresa 0..1 al ver a alguien; anima la figura. */
  alert: number
}

interface Chair {
  readonly home: Pt
  readonly mesh: THREE.Group
  x: number
  z: number
}

function makeChair(at: Pt & { readonly dir: number }): THREE.Group {
  const g = new THREE.Group()
  const mat = surface(0x2b2f38, 0.7)
  const part = (geo: THREE.BufferGeometry, size: readonly [number, number, number], at: readonly [number, number, number]): void => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.scale.set(...size)
    mesh.position.set(...at)
    mesh.castShadow = true
    g.add(mesh)
  }
  part(UNIT_CYLINDER, [0.5, 0.05, 0.5], [0, 0.03, 0]) // base
  part(UNIT_CYLINDER, [0.07, 0.4, 0.07], [0, 0.25, 0])
  part(UNIT_BOX, [0.46, 0.08, 0.46], [0, 0.47, 0])
  part(UNIT_BOX, [0.07, 0.5, 0.44], [-0.21, 0.76, 0]) // espaldar: mira hacia +x
  bakeChildren(g, 0.7)
  g.position.set(at.x, 0, at.z)
  g.rotation.y = -at.dir
  scene.add(g)
  return g
}

const chairs: readonly Chair[] = CHAIRS.map((c) => ({ home: c, mesh: makeChair(c), x: c.x, z: c.z }))
const CHAIR_GAP = PLAYER_R + CHAIR_R

/** Objeto robable en su sitio fijo de la oficina. */
interface Item {
  readonly level: number
  readonly index: number
  /** Posición: cambia al empezar una partida nueva (el reparto es al azar). */
  x: number
  y: number
  z: number
  turn: number
  readonly mesh: THREE.Group
  readonly marker: THREE.Mesh
  /** Objeto extra del modo de dos jugadores: no forma parte del progreso guardado. */
  readonly extra?: boolean
}

/** Los objetos reales son diminutos desde la cámara: se agrandan para que se note cuándo faltan. */
const OBJECT_SCALE = 1.5
const MARKER_GEO = new THREE.OctahedronGeometry(0.16)
const MARKER_MAT = new THREE.MeshBasicMaterial({ color: 0xffd400 })
const partMats = new Map<number, Surface>()

function buildItem(o: OfficeObject, extra = false): Item {
  const kind = LEVELS[o.level - 1]
  if (!kind) throw new Error(`Objeto sin nivel: ${o.level}`)
  const mesh = new THREE.Group()
  for (const part of kind.parts) {
    let mat = partMats.get(part.color)
    if (!mat) partMats.set(part.color, mat = surface(part.color, 0.5))
    const piece = new THREE.Mesh(part.shape === 'box' ? UNIT_BOX : UNIT_CYLINDER, mat)
    piece.scale.set(...part.size)
    piece.position.set(...part.at)
    piece.castShadow = true
    mesh.add(piece)
  }
  bakeChildren(mesh, 0.5)
  const marker = new THREE.Mesh(MARKER_GEO, MARKER_MAT)
  marker.position.y = 1.1 / OBJECT_SCALE
  mesh.add(marker)
  mesh.scale.setScalar(OBJECT_SCALE)
  mesh.position.set(o.x, o.y, o.z)
  mesh.rotation.y = o.turn
  scene.add(mesh)
  return { ...o, mesh, marker, ...(extra ? { extra } : {}) }
}

const objects: readonly Item[] = OBJECTS.map((o) => buildItem(o))

/** Cambia de sitio los objetos: los mismos y con los mismos índices (lo que guarda el servidor), pero en otros escritorios. */
function relayout(): void {
  const next = randomLayout()
  for (const item of objects) {
    const spot = next.find((o) => o.level === item.level && o.index === item.index)
    if (spot) Object.assign(item, { x: spot.x, y: spot.y, z: spot.z, turn: spot.turn })
  }
}
relayout() // cada vez que se abre el juego, el reparto es distinto

/** Objetos recién robados, con los segundos que llevan desapareciendo. */
const vanishing = new Map<Item, number>()
const VANISH_SECONDS = 0.4

function makeCone(): Npc['cone'] {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RAYS + 2) * 3), 3))
  const index: number[] = []
  for (let i = 1; i <= RAYS; i++) index.push(0, i, i + 1)
  geo.setIndex(index)
  const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: CONE.idle, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide,
  }))
  cone.frustumCulled = false
  cone.visible = false
  scene.add(cone)
  return cone
}

// El protagonista (el art toy) solo se juega: no se sienta en la oficina como vigilante.
const allNpcs: readonly Npc[] = CHARACTERS.filter((c) => !c.hero).map((char, i) => {
  const fig = figureOf(char)
  scene.add(fig)
  return {
    char, fig, cone: makeCone(), phase: i * 1.7,
    x: char.home.x, z: char.home.z, dir: char.home.dir,
    route: undefined, wp: 0, lure: CONFERENCE, lureT: 0, freezeT: 0, blindT: 0, blindK: 1, seenT: 0, alert: 0,
  }
})

/** `stride` es la fase del paso mientras camina; sin ella la figura queda quieta. */
function place(fig: THREE.Group, x: number, z: number, dir: number, stride?: number): void {
  fig.position.set(x, stride === undefined ? 0 : Math.abs(Math.sin(stride)) * 0.05, z)
  fig.rotation.y = -dir
  swingLimbs(fig, stride === undefined ? 0 : Math.sin(stride) * 0.6)
}
// La figura del protagonista está en escena solo mientras se juega con él.
for (const c of CHARACTERS) {
  if (!c.hero) continue
  const fig = figureOf(c)
  fig.visible = false
  scene.add(fig)
}
for (const n of allNpcs) place(n.fig, n.x, n.z, n.dir)

/** Gota de sudor: se dibuja una vez y la comparten los dos jugadores. */
const sweatTexture = ((): THREE.CanvasTexture => {
  const art = document.createElement('canvas')
  art.width = 64
  art.height = 96
  const ctx = art.getContext('2d')
  if (!ctx) throw new Error('Sin contexto 2D para la gotita')
  const fill = ctx.createLinearGradient(0, 8, 0, 90)
  fill.addColorStop(0, '#9be4ff')
  fill.addColorStop(1, '#1f9be0')
  ctx.beginPath()
  ctx.moveTo(32, 6)
  ctx.bezierCurveTo(40, 30, 56, 50, 56, 68)
  ctx.arc(32, 68, 24, 0, Math.PI, false)
  ctx.bezierCurveTo(8, 50, 24, 30, 32, 6)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(22, 66, 5, 10, 0.3, 0, Math.PI * 2)
  ctx.fill()
  return new THREE.CanvasTexture(art)
})()

/** Un jugador en la oficina: su personaje, su estado y lo que lo marca en pantalla (anillo de color y gotita de sudor). */
interface Player {
  readonly slot: 0 | 1
  readonly color: number
  char: Character
  x: number
  z: number
  dir: number
  grab: number
  cooldown: number
  cloakT: number
  dashT: number
  dashK: number
  stealing: boolean
  readonly ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  readonly sweat: THREE.Sprite
  /** Nombre sobre la cabeza, solo cuando juegan dos. */
  readonly tag: THREE.Sprite
}

function makePlayer(slot: 0 | 1, color: number, char: Character): Player {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.55, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
  )
  ring.visible = false
  scene.add(ring)
  const sweat = new THREE.Sprite(new THREE.SpriteMaterial({ map: sweatTexture, transparent: true, depthTest: false }))
  sweat.scale.set(0.55, 0.82, 1)
  sweat.renderOrder = 10
  sweat.visible = false
  scene.add(sweat)
  const art = document.createElement('canvas')
  art.width = 256
  art.height = 64
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(art), transparent: true, depthTest: false }))
  tag.scale.set(1.3, 0.325, 1)
  tag.renderOrder = 11
  tag.visible = false
  scene.add(tag)
  return { slot, color, char, x: SPAWN.x, z: SPAWN.z, dir: 0, grab: 0, cooldown: 0, cloakT: 0, dashT: 0, dashK: 1, stealing: false, ring, sweat, tag }
}

/** Escribe "J1 · Nombre" en la etiqueta del jugador, con el color de su anillo. */
function drawTag(p: Player): void {
  const map = p.tag.material.map
  const art = map?.image
  if (!(art instanceof HTMLCanvasElement)) throw new Error('Etiqueta sin lienzo')
  const ctx = art.getContext('2d')
  if (!ctx || !map) throw new Error('Sin contexto 2D para la etiqueta')
  ctx.clearRect(0, 0, art.width, art.height)
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.beginPath()
  ctx.roundRect(4, 4, art.width - 8, art.height - 8, 20)
  ctx.fill()
  ctx.font = '40px Anton, Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = `#${p.color.toString(16).padStart(6, '0')}`
  ctx.fillText(`J${p.slot + 1} · ${p.char.name.toUpperCase()}`, art.width / 2, art.height / 2 + 2)
  map.needsUpdate = true
}

type Phase = 'menu' | 'playing' | 'won' | 'busted'

let phase: Phase = 'menu'
/** Jugador del art toy; sin él se juega la demo, que no se guarda. */
let account: Account | undefined
let progress: Progress = FRESH
let counts: readonly number[] = DEMO_COUNTS
let level = 1
let cfg: LevelConfig = levelConfig(1)
let npcs: Npc[] = []
let items: Item[] = []
let total = 0
let timeLeft = LEVEL_SECONDS
let clock = 0
let closeUp = loadCloseUp()
/** Objetos extra de esta partida (solo con dos jugadores), cuántos faltan y el último robo del nivel retenido hasta completarlos. */
let extraItems: Item[] = []
let extrasLeft = 0
let heldBase: Item | undefined
const firstChar = CHARACTERS[0] ?? (() => { throw new Error('Sin personajes') })()
/** Jugador 1 (anillo verde) y jugador 2 (anillo celeste). */
const players: readonly [Player, Player] = [makePlayer(0, 0x39ff88, firstChar), makePlayer(1, 0x4dd2ff, firstChar)]
const player = players[0]
/** Quienes juegan el nivel en curso: solo el jugador 1, o los dos si hay dos celulares conectados. */
let crew: readonly Player[] = [player]

// ---------- Sonido ----------

let audio: AudioContext | undefined
let muted = loadMuted()

function tone(freq: number, start: number, seconds: number, type: OscillatorType = 'square', volume = 0.07): void {
  if (!audio || muted) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = volume
  osc.connect(gain).connect(audio.destination)
  osc.start(audio.currentTime + start)
  osc.stop(audio.currentTime + start + seconds)
}

const sfx = {
  alarm: (): void => { for (let i = 0; i < 10; i++) tone(i % 2 ? 660 : 880, i * 0.18, 0.16) },
  pick: (): void => { tone(880, 0, 0.08, 'sine', 0.12); tone(1320, 0.08, 0.12, 'sine', 0.12) },
  win: (): void => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.18, 'triangle', 0.12)) },
  ability: (): void => tone(330, 0, 0.15, 'sawtooth', 0.06),
  spot: (): void => { tone(1100, 0, 0.07, 'square', 0.09); tone(1100, 0.1, 0.07, 'square', 0.09) },
}

/** Volumen de la música de suspenso; se crea al primer robo y queda sonando en silencio. */
let suspense: GainNode | undefined
let pulseRate: AudioParam | undefined

/** Bajo que alterna dos notas a un semitono, con pulso. Suena solo mientras se roba. */
function makeSuspense(ctx: AudioContext): GainNode {
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  const pulse = ctx.createGain()
  pulse.gain.value = 0.5
  pulse.connect(master)
  const lfo = (type: OscillatorType, hz: number, depth: number, target: AudioParam): OscillatorNode => {
    const osc = ctx.createOscillator()
    const amount = ctx.createGain()
    osc.type = type
    osc.frequency.value = hz
    amount.gain.value = depth
    osc.connect(amount).connect(target)
    osc.start()
    return osc
  }
  pulseRate = lfo('sine', 6, 0.5, pulse.gain).frequency // pulso: se acelera al acabarse el tiempo
  for (const [type, hz, volume] of [['triangle', 84.86, 1], ['sawtooth', 169.72, 0.12]] as const) {
    const voice = ctx.createOscillator()
    const level = ctx.createGain()
    voice.type = type
    voice.frequency.value = hz
    level.gain.value = volume
    voice.connect(level).connect(pulse)
    voice.start()
    lfo('square', 1.5, hz * 0.029, voice.frequency) // mi ↔ fa
  }
  return master
}

/** Antifaz y música: puestos mientras roba, fuera en cuanto suelta. */
function setStealing(p: Player, on: boolean): void {
  p.stealing = on
  setMask(figureOf(p.char), on || p.char.hero === true)
  const any = players.some((q) => q.stealing)
  if (!audio || (!any && !suspense)) return
  suspense ??= makeSuspense(audio)
  suspense.gain.setTargetAtTime(any && !muted ? 0.22 : 0, audio.currentTime, 0.04)
}

function stopStealing(): void {
  for (const p of players) setStealing(p, false)
}

// ---------- Interfaz ----------

const ui = el<HTMLDivElement>('#ui')
ui.innerHTML = `
  <div id="hud" class="hidden">
    <div id="hintArrow" class="ink pointer-events-none absolute z-10 hidden text-4xl text-yellow-300">▲</div>
    <div class="ink absolute top-3 left-3 text-base md:top-4 md:left-4 md:text-2xl">
      <div id="mission" class="text-yellow-300"></div>
      <div id="count" class="text-2xl md:text-4xl"></div>
    </div>
    <div class="ink absolute top-3 right-3 flex flex-col items-end md:top-4 md:right-4">
      <div id="stars" class="text-xl text-yellow-400 md:text-3xl"></div>
      <div id="timer" class="text-4xl md:text-6xl"></div>
      <div class="flex gap-2">
        <button id="throwBtn" class="pointer-events-auto hidden cursor-pointer rounded border-2 border-black bg-yellow-400/90 px-3 py-1 text-sm text-black"></button>
        <button id="zoomBtn" class="pointer-events-auto cursor-pointer rounded border-2 border-black bg-sky-500/80 px-3 py-1 text-sm">🔍 ${t('ZOOM')}</button>
        <button id="menuBtn" class="pointer-events-auto cursor-pointer rounded border-2 border-black bg-neutral-800/80 px-3 py-1 text-sm">${t('MENÚ')}</button>
      </div>
    </div>
    <div id="legend" class="ink pointer-events-none absolute bottom-2 left-1/2 flex max-w-[68vw] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg bg-black/55 px-3 py-1 text-xs pointer-coarse:hidden md:text-sm">${legendHtml()}</div>
    <canvas id="radar" width="192" height="90" class="absolute bottom-16 left-10 rotate-45 rounded border-2 border-black bg-black/60 pointer-coarse:top-24 pointer-coarse:bottom-auto pointer-coarse:left-0 pointer-coarse:scale-50"></canvas>
    <div id="abilityBox" class="ink pointer-events-auto absolute right-4 bottom-4 cursor-pointer touch-none text-right pointer-coarse:bottom-36">
      <div id="abilityName" class="text-xl text-sky-300"></div>
      <div id="abilityState" class="text-3xl"></div>
    </div>
    <div id="pauseBox" class="ink hidden absolute inset-x-0 top-1/3 z-30 flex-col items-center gap-2 bg-black/70 py-6 text-center">
      <div id="pauseTitle" class="text-4xl text-yellow-300 md:text-6xl"></div>
      <div id="pauseText" class="text-xl md:text-3xl"></div>
    </div>
    <div id="ability2Box" class="ink hidden absolute right-4 bottom-24 text-right">
      <div id="ability2Name" class="text-lg text-cyan-300"></div>
      <div id="ability2State" class="text-2xl"></div>
    </div>
    <div class="ink absolute bottom-10 left-1/2 flex pointer-coarse:bottom-60 -translate-x-1/2 flex-col items-center gap-2">
      <div id="prompt" class="text-2xl text-yellow-300"></div>
      <progress id="grab" max="1" value="0" class="h-3 w-56 accent-yellow-400"></progress>
      <progress id="grab2" max="1" value="0" class="h-3 w-56 accent-cyan-400"></progress>
    </div>
    <div id="touch" class="hidden pointer-coarse:block">
      <div id="stick" class="pointer-events-auto absolute bottom-6 left-6 flex size-32 touch-none items-center justify-center rounded-full border-4 border-white/50 bg-black/30">
        <div id="knob" class="size-14 rounded-full bg-white/70"></div>
      </div>
      <button id="grabBtn" class="ink pointer-events-auto absolute right-6 bottom-6 size-24 touch-none rounded-full border-4 border-black bg-yellow-400/90 text-xl">${t('ROBAR')}</button>
    </div>
  </div>
  <div id="notice" class="ink absolute top-24 left-1/2 z-20 hidden w-max max-w-[90vw] -translate-x-1/2 rounded-lg border-2 border-black bg-black/85 px-4 py-2 text-center text-lg text-red-400 md:text-2xl"></div>
  <div id="banner" class="ink pointer-events-auto absolute inset-0 hidden p-4 flex-col items-center justify-center gap-3 bg-black/50 text-center">
    <div id="mugshot" class="hidden h-[min(42dvh,20rem)] -rotate-2 border-4 border-white bg-white tracking-normal shadow-2xl [text-shadow:none]"></div>
    <div id="bannerTitle" class="text-8xl"></div>
    <div id="bannerText" class="text-xl md:text-3xl"></div>
    <div id="bannerRank" class="text-xl text-emerald-400 md:text-2xl"></div>
    <button id="shareBtn" class="hidden cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-5 py-2 text-xl">${t('COMPARTIR')}</button>
    <button id="waitBannerBtn" class="hidden cursor-pointer rounded-lg border-2 border-black bg-pink-500 px-5 py-2 text-xl">${t('🔔 QUIERO MI ART TOY')}</button>
    <div id="bannerHint" class="text-base text-neutral-300 md:text-xl"></div>
  </div>
  <dialog id="waitlist" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-pink-400 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
    <p class="font-gta mb-1 text-3xl text-pink-400">${t('LISTA DE ESPERA')}</p>
    <p class="mb-3 font-sans text-sm text-neutral-300">${t('Cada art toy es la llave de una partida completa de 10 niveles. Déjanos tu correo y te avisamos cuando salgan.')}</p>
    <form id="waitForm" class="flex flex-col gap-2 font-sans">
      <input id="waitEmail" required type="email" maxlength="254" autocomplete="email" placeholder="${t('Tu correo')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-base text-white select-text" />
      <p id="waitStatus" class="min-h-5 text-sm text-neutral-300"></p>
      <button id="waitSend" class="font-gta cursor-pointer rounded bg-pink-500 px-4 py-2 text-xl text-white disabled:opacity-50">${t('AVÍSENME')}</button>
      <button id="waitClose" type="button" class="font-gta cursor-pointer rounded bg-neutral-700 px-4 py-1 text-lg text-white">${t('CERRAR')}</button>
    </form>
  </dialog>
  <dialog id="feedback" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-emerald-400 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
    <p class="font-gta mb-1 text-3xl text-emerald-400">${t('TU OPINIÓN')}</p>
    <p class="mb-3 font-sans text-sm text-neutral-300">${t('Cuéntanos qué funcionó y qué no. Lo leo todo.')}</p>
    <form id="fbForm" class="flex flex-col gap-2 font-sans">
      <div id="fbStars" class="flex justify-center gap-1 text-3xl text-yellow-300"></div>
      <textarea id="fbText" required maxlength="1000" rows="4" placeholder="${t('Tu opinión')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-base text-white select-text"></textarea>
      <input id="fbEmail" type="email" maxlength="254" autocomplete="email" placeholder="${t('Correo (opcional, solo si quieres respuesta)')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-base text-white select-text" />
      <input id="fbTrap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute -left-[9999px]" />
      <p id="fbStatus" class="min-h-5 text-sm text-neutral-300"></p>
      <button id="fbSend" class="font-gta cursor-pointer rounded bg-emerald-500 px-4 py-2 text-xl text-white disabled:opacity-50">${t('ENVIAR')}</button>
      <button id="fbClose" type="button" class="font-gta cursor-pointer rounded bg-neutral-700 px-4 py-1 text-lg text-white">${t('CERRAR')}</button>
    </form>
  </dialog>
  <div id="padPoster" class="pointer-events-none absolute bottom-2 left-2 z-20 hidden w-40 flex-col items-center gap-1 rounded bg-white p-2 text-center font-sans text-xs leading-tight text-black">
    <img class="padQr size-32 [image-rendering:pixelated]" alt="" />
    <span class="padText"></span>
    <b class="padCode text-base tracking-widest"></b>
  </div>
  <div id="poster" class="pointer-events-auto absolute inset-0 z-10 cursor-pointer overflow-hidden bg-[repeating-conic-gradient(from_0deg_at_72%_50%,#ff8a1f_0_7.5deg,#c2410c_7.5deg_15deg)] portrait:bg-[repeating-conic-gradient(from_0deg_at_50%_30%,#ff8a1f_0_7.5deg,#c2410c_7.5deg_15deg)]">${posterHtml()}</div>
  <div id="menu" class="pointer-events-auto absolute inset-0 flex flex-col items-center gap-4 overflow-y-auto bg-black/75 p-3 md:p-6">
    <h1 class="ink font-title text-center text-4xl text-yellow-300 md:text-7xl">NINE TO <span class="text-emerald-400">THIEF</span></h1>
    <p class="ink text-center text-base text-neutral-200 md:text-xl">${t('Elige a tu ladrón. Roba sin que te vean mientras lo coges. Un minuto por nivel.')}</p>
    <div id="padMenu" class="hidden items-center gap-3 rounded-lg bg-white p-2 font-sans text-sm text-black">
      <img class="padQr size-24 [image-rendering:pixelated]" alt="" />
      <span class="max-w-48 text-left"><span class="padText"></span><br /><b class="padCode text-lg tracking-widest"></b></span>
    </div>
    <p id="account" class="ink text-center text-lg text-emerald-400 md:text-2xl"></p>
    <p id="challenge" class="ink hidden text-center text-lg text-pink-400 md:text-2xl"></p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <button id="waitBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-pink-500 px-4 py-2 text-lg">${t('🔔 QUIERO MI ART TOY')}</button>
      <button id="fbBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-4 py-2 text-lg">${t('💬 OPINIÓN')}</button>
      <button id="muteBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-neutral-700 px-4 py-2 text-lg"></button>
      <button id="langBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-neutral-700 px-4 py-2 text-lg">${lang === 'es' ? 'ENGLISH' : 'ESPAÑOL'}</button>
    </div>
    <dialog id="signup" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
      <p class="mb-1 text-3xl text-yellow-300">${t('ART TOY NUEVO')}</p>
      <p class="mb-3 font-sans text-sm text-neutral-300">${t('Regístralo una sola vez. Después basta con acercarlo para seguir tu partida.')}</p>
      <form id="signupForm" class="flex flex-col gap-2 font-sans">
        <input id="signupName" required maxlength="24" autocomplete="name" placeholder="${t('Tu nombre')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-base text-white select-text" />
        <input id="signupEmail" required type="email" maxlength="254" autocomplete="email" placeholder="${t('Tu correo')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-base text-white select-text" />
        <p id="signupError" class="min-h-5 text-sm text-red-400"></p>
        <button id="signupBtn" class="font-gta cursor-pointer rounded bg-yellow-300 px-4 py-2 text-xl text-black disabled:opacity-50">${t('EMPEZAR A ROBAR')}</button>
      </form>
    </dialog>
    <button id="tvLinkBtn" class="ink hidden cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-4 py-2 text-lg">${t('📺 JUGAR EN LA TELE')}</button>
    <dialog id="tvLink" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
      <p class="mb-1 text-3xl text-yellow-300">${t('📺 JUGAR EN LA TELE')}</p>
      <p class="mb-3 font-sans text-sm text-neutral-300">${t('Abre la app en tu tele y escribe aquí el código de 5 letras que muestra en la pantalla de inicio.')}</p>
      <form id="tvLinkForm" class="flex gap-2 font-sans">
        <input id="tvLinkCode" maxlength="5" required autocomplete="off" autocapitalize="characters" aria-label="${t('Código de la tele')}" class="w-32 rounded-lg border-2 border-neutral-600 bg-neutral-800 px-3 py-2 text-center text-xl tracking-widest text-white uppercase select-text" />
        <button class="font-gta cursor-pointer rounded bg-yellow-300 px-4 py-2 text-xl text-black">${t('ENVIAR')}</button>
      </form>
      <p id="tvLinkStatus" class="mt-2 min-h-5 font-sans text-sm text-neutral-300"></p>
      <form method="dialog" class="mt-3 text-right">
        <button class="font-gta cursor-pointer rounded bg-neutral-700 px-4 py-1 text-lg text-white">${t('CERRAR')}</button>
      </form>
    </dialog>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <input id="nick" maxlength="12" autocomplete="nickname" placeholder="${t('Tu apodo para el tablón')}" class="rounded-lg border-2 border-neutral-600 bg-neutral-900 px-3 py-2 font-sans text-base text-white select-text" />
      <button id="boardBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-yellow-400 px-4 py-2 text-lg">${t('🏆 TABLÓN')}</button>
    </div>
    <p id="nickStatus" class="min-h-5 font-sans text-sm text-neutral-300"></p>
    <dialog id="board" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
      <p class="mb-3 text-3xl text-yellow-300">TOP 10</p>
      <ol id="boardList" class="space-y-1 font-sans text-base"></ol>
      <p id="boardMe" class="mt-3 text-lg text-emerald-400"></p>
      <form method="dialog" class="mt-4 text-right">
        <button class="cursor-pointer rounded bg-yellow-300 px-4 py-1 text-lg text-black">${t('CERRAR')}</button>
      </form>
    </dialog>
    <button id="installBtn" class="ink hidden cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-4 py-2 text-lg">${t('＋ AÑADIR A PANTALLA DE INICIO')}</button>
    <dialog id="installHelp" class="pointer-events-auto m-auto max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 font-sans text-white backdrop:bg-black/70">
      <p class="font-gta mb-3 text-2xl text-yellow-300">${t('Añadir a pantalla de inicio')}</p>
      <ol class="list-decimal space-y-2 pl-5 text-base">
        <li>${t('Toca el botón <b>Compartir</b> del navegador (cuadro con flecha hacia arriba).')}</li>
        <li>${t('Elige <b>Añadir a pantalla de inicio</b>.')}</li>
        <li>${t('Abre el juego desde el icono nuevo: pantalla completa y sin zoom.')}</li>
      </ol>
      <form method="dialog" class="mt-4 text-right">
        <button class="font-gta cursor-pointer rounded bg-yellow-300 px-4 py-1 text-lg text-black">${t('LISTO')}</button>
      </form>
    </dialog>
    <div id="roster" class="grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"></div>
    <p class="ink text-center text-base text-neutral-300 md:text-lg">${pick('Palanca: moverse · mantén ROBAR · toca la habilidad para usarla', 'Flechas: moverse · mantén OK: robar · PLAY: habilidad · Atrás: menú', 'WASD / flechas: moverse · mantén E: robar · Q: habilidad · Esc: menú')}</p>
    <footer class="mt-4 flex w-full max-w-6xl flex-col items-center gap-3 border-t-2 border-neutral-700 pt-5 pb-6 text-center font-sans text-sm text-neutral-400">
      <a href="https://www.instagram.com/mrmonomalo/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 rounded-full border-2 border-black bg-linear-to-r from-fuchsia-600 via-rose-500 to-amber-400 px-4 py-2 text-base font-bold text-white hover:brightness-110">
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
        ${t('Creado por @mrmonomalo')}
      </a>
      <a href="/tv/" class="rounded-full border-2 border-black bg-emerald-500 px-4 py-2 text-base font-bold text-white hover:brightness-110">📺 ${t('Descargar para Android TV')}</a>
      <p>${t('Un juego y una colección de art toys. Sígueme en Instagram para ver los próximos personajes.')}</p>
      <p class="text-xs text-neutral-500">
        ${t('Código abierto en')} <a href="https://github.com/hugotorreslinares/nine-to-thief" target="_blank" rel="noopener noreferrer" class="text-sky-300 underline hover:text-sky-200">GitHub</a>
        · ${t('Todos los personajes y situaciones son ficticios.')}
      </p>
    </footer>
  </div>`

const dom = {
  hud: el<HTMLDivElement>('#hud'),
  menu: el<HTMLDivElement>('#menu'),
  account: el<HTMLParagraphElement>('#account'),
  challenge: el<HTMLParagraphElement>('#challenge'),
  waitBtn: el<HTMLButtonElement>('#waitBtn'),
  waitBannerBtn: el<HTMLButtonElement>('#waitBannerBtn'),
  waitlist: el<HTMLDialogElement>('#waitlist'),
  waitForm: el<HTMLFormElement>('#waitForm'),
  waitEmail: el<HTMLInputElement>('#waitEmail'),
  waitStatus: el<HTMLParagraphElement>('#waitStatus'),
  waitSend: el<HTMLButtonElement>('#waitSend'),
  waitClose: el<HTMLButtonElement>('#waitClose'),
  fbBtn: el<HTMLButtonElement>('#fbBtn'),
  feedback: el<HTMLDialogElement>('#feedback'),
  fbForm: el<HTMLFormElement>('#fbForm'),
  fbStars: el<HTMLDivElement>('#fbStars'),
  fbText: el<HTMLTextAreaElement>('#fbText'),
  fbEmail: el<HTMLInputElement>('#fbEmail'),
  fbTrap: el<HTMLInputElement>('#fbTrap'),
  fbStatus: el<HTMLParagraphElement>('#fbStatus'),
  fbSend: el<HTMLButtonElement>('#fbSend'),
  fbClose: el<HTMLButtonElement>('#fbClose'),
  langBtn: el<HTMLButtonElement>('#langBtn'),
  throwBtn: el<HTMLButtonElement>('#throwBtn'),
  hintArrow: el<HTMLDivElement>('#hintArrow'),
  muteBtn: el<HTMLButtonElement>('#muteBtn'),
  notice: el<HTMLDivElement>('#notice'),
  signup: el<HTMLDialogElement>('#signup'),
  signupForm: el<HTMLFormElement>('#signupForm'),
  signupName: el<HTMLInputElement>('#signupName'),
  signupEmail: el<HTMLInputElement>('#signupEmail'),
  signupError: el<HTMLParagraphElement>('#signupError'),
  signupBtn: el<HTMLButtonElement>('#signupBtn'),
  installBtn: el<HTMLButtonElement>('#installBtn'),
  installHelp: el<HTMLDialogElement>('#installHelp'),
  tvLinkBtn: el<HTMLButtonElement>('#tvLinkBtn'),
  tvLink: el<HTMLDialogElement>('#tvLink'),
  tvLinkForm: el<HTMLFormElement>('#tvLinkForm'),
  tvLinkCode: el<HTMLInputElement>('#tvLinkCode'),
  tvLinkStatus: el<HTMLParagraphElement>('#tvLinkStatus'),
  nick: el<HTMLInputElement>('#nick'),
  nickStatus: el<HTMLParagraphElement>('#nickStatus'),
  boardBtn: el<HTMLButtonElement>('#boardBtn'),
  board: el<HTMLDialogElement>('#board'),
  boardList: el<HTMLOListElement>('#boardList'),
  boardMe: el<HTMLParagraphElement>('#boardMe'),
  bannerRank: el<HTMLDivElement>('#bannerRank'),
  shareBtn: el<HTMLButtonElement>('#shareBtn'),
  stick: el<HTMLDivElement>('#stick'),
  knob: el<HTMLDivElement>('#knob'),
  grabBtn: el<HTMLButtonElement>('#grabBtn'),
  touch: el<HTMLDivElement>('#touch'),
  menuBtn: el<HTMLButtonElement>('#menuBtn'),
  zoomBtn: el<HTMLButtonElement>('#zoomBtn'),
  abilityBox: el<HTMLDivElement>('#abilityBox'),
  poster: el<HTMLDivElement>('#poster'),
  banner: el<HTMLDivElement>('#banner'),
  mugshot: el<HTMLDivElement>('#mugshot'),
  bannerTitle: el<HTMLDivElement>('#bannerTitle'),
  bannerText: el<HTMLDivElement>('#bannerText'),
  bannerHint: el<HTMLDivElement>('#bannerHint'),
  mission: el<HTMLDivElement>('#mission'),
  count: el<HTMLDivElement>('#count'),
  stars: el<HTMLDivElement>('#stars'),
  timer: el<HTMLDivElement>('#timer'),
  abilityName: el<HTMLDivElement>('#abilityName'),
  abilityState: el<HTMLDivElement>('#abilityState'),
  prompt: el<HTMLDivElement>('#prompt'),
  grab: el<HTMLProgressElement>('#grab'),
  grab2: el<HTMLProgressElement>('#grab2'),
  ability2Box: el<HTMLDivElement>('#ability2Box'),
  pauseBox: el<HTMLDivElement>('#pauseBox'),
  pauseTitle: el<HTMLDivElement>('#pauseTitle'),
  pauseText: el<HTMLDivElement>('#pauseText'),
  ability2Name: el<HTMLDivElement>('#ability2Name'),
  ability2State: el<HTMLDivElement>('#ability2State'),
  roster: el<HTMLDivElement>('#roster'),
  radar: el<HTMLCanvasElement>('#radar'),
}

const radar = ((): CanvasRenderingContext2D => {
  const ctx = dom.radar.getContext('2d')
  if (!ctx) throw new Error('Sin contexto 2D para el radar')
  return ctx
})()

const starsText = (): string => '★'.repeat(progress.stars) + '☆'.repeat(MAX_STARS - progress.stars)
const finished = (): boolean => progress.level > counts.length

/** Pinta la línea de cuenta y el elenco. Con art toy, el personaje elegido queda fijo. */
/** Marca J1 o J2 en el personaje que un celular ya eligió. Solo datos propios. */
function pickTag(id: string): string {
  const slot = picks.indexOf(id)
  if (slot < 0) return ''
  return `<span class="ml-auto self-start rounded px-2 text-sm font-bold text-black" style="background:${slot === 0 ? '#39ff88' : '#4dd2ff'}">J${slot + 1}</span>`
}

function renderMenu(): void {
  // textContent: el nombre lo escribió el jugador.
  dom.account.textContent = account
    ? `${account.name} · ${finished() ? t('OFICINA VACÍA') : t('NIVEL {n}', { n: progress.level })} · ${starsText()}`
    : TV ? t('DEMO: solo el nivel 1. En tu celular abre tu art toy y toca "Jugar en la tele".') : t('DEMO: solo el nivel 1. Acerca tu art toy para jugar los 10 niveles.')
  // Con art toy sobran la lista de espera y el cambio de idioma (recargar cerraría la sesión).
  dom.waitBtn.classList.toggle('hidden', account !== undefined)
  // Con un art toy abierto en este celular se puede mandar la partida a la tele.
  dom.tvLinkBtn.classList.toggle('hidden', account === undefined || tagCode === undefined || TV)
  dom.langBtn.classList.toggle('hidden', account !== undefined)
  // Con art toy se juega siempre con el protagonista (salvo cuentas antiguas con otro personaje).
  const own = account ? CHARACTERS.find((c) => c.id === progress.char) ?? CHARACTERS.find((c) => c.hero) : undefined
  // Datos estáticos propios: no hay entrada de usuario en este HTML.
  dom.roster.innerHTML = (own ? [own] : CHARACTERS).map((c) => `
  <button data-id="${c.id}" class="flex cursor-pointer items-center gap-4 rounded-lg border-2 ${c.hero ? 'border-yellow-300' : 'border-neutral-700'} bg-neutral-900/90 p-2 text-left hover:border-yellow-300 hover:bg-neutral-800">
    <img src="${portraits.get(c.id) ?? ''}" alt="${c.name}" class="size-20 shrink-0 md:size-28" />
    <span class="flex flex-col">
      <span class="text-3xl text-yellow-300">${c.name}</span>
      <span class="text-xl text-sky-300">${t(c.ability.name)}</span>
      <span class="font-sans text-sm text-neutral-200 md:text-base">${t(c.ability.text)}</span>
    </span>
    ${pickTag(c.id)}
  </button>`).join('')
}

dom.roster.addEventListener('click', (e) => {
  const button = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[data-id]') : null
  const chosen = CHARACTERS.find((c) => c.id === button?.dataset.id)
  if (chosen) beginGame(chosen)
})

/** Empieza la partida con `chosen` como jugador 1 (el segundo, si lo hay, sale de lo que eligió su celular). */
function beginGame(chosen: Character): void {
  if (connecting) return
  if (picks[1] === chosen.id && (remote?.connected() ?? 0) >= 2) {
    notify(t('Ese personaje ya lo eligió el jugador 2'))
    return
  }
  audio ??= new AudioContext()
  relayout() // cada partida nueva reparte los objetos en otros sitios
  player.char = chosen
  if (account) progress = { ...progress, char: progress.char ?? chosen.id }
  else progress = FRESH // la demo empieza de cero cada vez
  startLevel()
}

// ---------- Art toy ----------

let noticeTimer: ReturnType<typeof setTimeout> | undefined
function notify(text: string): void {
  dom.notice.textContent = text
  dom.notice.classList.remove('hidden')
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => dom.notice.classList.add('hidden'), 5000)
}

/** Muestra u oculta cada objeto según el progreso: lo robado no está, lo del nivel en curso lleva marcador. */
function clearExtras(): void {
  for (const e of extraItems) scene.remove(e.mesh)
  extraItems = []
  extrasLeft = 0
  heldBase = undefined
}

function syncObjects(): void {
  clearExtras()
  vanishing.clear()
  const stealable = !finished()
  for (const o of objects) {
    const current = o.level === progress.level
    o.mesh.visible = o.level > progress.level || (current && !progress.stolen.includes(o.index))
    o.marker.visible = current && stealable
    o.mesh.scale.setScalar(OBJECT_SCALE)
    o.mesh.position.set(o.x, o.y, o.z)
    o.mesh.rotation.y = o.turn
  }
  items = stealable ? objects.filter((o) => o.level === progress.level && o.mesh.visible) : []
}

/** Último progreso confirmado por el servidor; manda sobre el local en cuanto no hay partida en curso. */
let confirmed: Progress | undefined

function settle(): void {
  if (!account || !confirmed || !idle() || phase === 'playing') return
  progress = confirmed
  confirmed = undefined
  syncObjects()
  renderMenu()
}

function onSaved(saved: Progress): void {
  confirmed = saved
  settle()
}

function onSaveFailed(err: unknown): void {
  if (!(err instanceof PlayError && err.status === 401)) {
    console.error(err)
    return notify(t('Sin conexión: este progreso no se guardó'))
  }
  // Otra pestaña hizo tap, o la sesión caducó: esta ya no puede seguir.
  close()
  account = undefined
  confirmed = undefined
  counts = DEMO_COUNTS
  progress = FRESH
  showMenu()
  notify(t('Sesión terminada. Acerca tu art toy para continuar.'))
}

function signIn(next: Account): void {
  account = next
  progress = next.progress
  counts = COUNTS
  player.char = CHARACTERS.find((c) => c.id === progress.char) ?? player.char
  // Con art toy el jugador 1 es siempre el personaje de su cuenta: el segundo no puede repetirlo.
  const mate = picks[1] === player.char.id ? null : picks[1]
  setPicks([null, mate])
  syncObjects()
  renderMenu()
}

// La URL del art toy es una credencial: se saca de la barra de direcciones nada más leerla.
const tagCode = /^\/play\/([\w-]{16,64})\/?$/.exec(location.pathname)?.[1]
if (location.pathname !== '/') history.replaceState(null, '', `/${location.search}`)
let connecting = tagCode !== undefined

if (tagCode) {
  dom.poster.classList.add('hidden')
  dom.account.textContent = t('Conectando tu art toy…')
  open(tagCode).then((found) => {
    if (found) signIn(found)
    else {
      dom.account.textContent = t('Art toy nuevo: regístralo para empezar')
      dom.signup.showModal()
    }
  }).catch((err: unknown) => {
    console.error(err)
    renderMenu()
    notify(err instanceof PlayError && err.status === 404 ? t('Etiqueta no reconocida: juegas la demo') : t('No se pudo conectar: juegas la demo'))
  }).finally(() => { connecting = false })

  dom.signupForm.addEventListener('submit', (e) => {
    e.preventDefault()
    dom.signupBtn.disabled = true
    dom.signupError.textContent = ''
    register(tagCode, dom.signupName.value, dom.signupEmail.value).then((created) => {
      dom.signup.close()
      signIn(created)
    }).catch((err: unknown) => {
      console.error(err)
      dom.signupError.textContent = err instanceof PlayError && err.status === 400 ? t('Revisa tu nombre y tu correo') : t('No se pudo registrar')
    }).finally(() => { dom.signupBtn.disabled = false })
  })
  dom.signup.addEventListener('close', renderMenu)
}

// ---------- Instalación ----------

/** Evento de Chrome/Android; iOS no lo emite y solo admite el camino manual. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
}

let installPrompt: InstallPromptEvent | undefined
const installed = matchMedia('(display-mode: standalone)').matches
  || ('standalone' in navigator && navigator.standalone === true)

if (!installed && TOUCH) dom.installBtn.classList.remove('hidden')
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  installPrompt = e as InstallPromptEvent
  dom.installBtn.classList.remove('hidden')
})
dom.installBtn.addEventListener('click', () => {
  if (!installPrompt) return dom.installHelp.showModal()
  installPrompt.prompt().catch((err: unknown) => console.error('No se pudo instalar', err))
  installPrompt = undefined
})

// ---------- Tablón ----------

/** Mayor nivel superado en esta sesión y último puesto que devolvió el servidor. */
let bestLevel = 0
/** Segundos que sobraron al superar `bestLevel`: van en el enlace de reto. */
let bestSeconds = 0
let rank: number | undefined

dom.nick.value = loadNick()

function setNickStatus(text: string, color: 'text-neutral-300' | 'text-emerald-400' | 'text-red-400'): void {
  dom.nickStatus.textContent = text
  dom.nickStatus.className = `min-h-5 font-sans text-sm ${color}`
}

/** Reserva en el servidor el apodo escrito y avisa si es de otro jugador. */
function reserveNick(): void {
  const typed = dom.nick.value
  if (typed.trim() === '') return setNickStatus('', 'text-neutral-300')
  const name = cleanNick(typed)
  if (!name) return setNickStatus(t('Usa 1 a 12 letras, números, espacios, - o _'), 'text-red-400')
  setNickStatus(t('Comprobando…'), 'text-neutral-300')
  claimNick(name).then(() => {
    if (dom.nick.value === typed) setNickStatus(t('✓ Apodo reservado para ti'), 'text-emerald-400')
  }).catch((err: unknown) => {
    if (dom.nick.value !== typed) return
    if (isTaken(err)) return setNickStatus(t('✗ Ese apodo ya es de otro jugador. Elige otro.'), 'text-red-400')
    console.error(err)
    setNickStatus(t('No se pudo comprobar el apodo'), 'text-neutral-300')
  })
}

let nickTimer: ReturnType<typeof setTimeout> | undefined
dom.nick.addEventListener('input', () => {
  saveNick(dom.nick.value.trim())
  clearTimeout(nickTimer)
  nickTimer = setTimeout(reserveNick, 600)
})
reserveNick()

dom.boardBtn.addEventListener('click', () => {
  const nick = cleanNick(dom.nick.value)
  dom.boardList.replaceChildren()
  dom.boardMe.textContent = t('Cargando…')
  dom.board.showModal()
  fetchBoard(nick).then(({ top, me }) => {
    // textContent: los apodos vienen de otros jugadores.
    dom.boardList.replaceChildren(...top.map((row, i) => {
      const li = document.createElement('li')
      li.textContent = t('{i}. {name} — nivel {level}', { i: i + 1, name: row.name, level: row.level })
      return li
    }))
    dom.boardMe.textContent = me ? t('Tú ({name}): puesto #{rank}, nivel {level}', { name: me.name, rank: me.rank, level: me.level })
      : top.length === 0 ? t('Nadie todavía. ¡Sé el primero!') : ''
  }).catch((err: unknown) => {
    console.error(err)
    dom.boardMe.textContent = t('Tablón no disponible ahora')
  })
})

function reportWin(): void {
  const name = cleanNick(dom.nick.value)
  if (!name) {
    dom.bannerRank.textContent = t('Pon un apodo en el menú para entrar al tablón')
    return
  }
  submitScore({ name, level, seconds: Math.min(99, Math.max(0, Math.ceil(timeLeft))) }).then((place) => {
    rank = place
    if (place) dom.bannerRank.textContent = t('Puesto #{place} en el tablón', { place })
  }).catch((err: unknown) => {
    if (isTaken(err)) {
      dom.bannerRank.textContent = t('Tu apodo es de otro jugador: cámbialo en el menú')
      return
    }
    console.error(err)
    dom.bannerRank.textContent = t('Tablón no disponible ahora')
  })
}

const thingsOf = (n: number): string => t(LEVELS[n - 1]?.plural ?? '')

/** Reto recibido por enlace (?reto=nivel.segundos): superar ese nivel con más tiempo de sobra. */
const challenge = ((): { readonly level: number; readonly seconds: number } | undefined => {
  const found = /^(\d{1,2})\.(\d{1,2})$/.exec(new URLSearchParams(location.search).get('reto') ?? '')
  return found ? { level: Number(found[1]), seconds: Number(found[2]) } : undefined
})()
if (challenge) {
  dom.challenge.textContent = t('RETO: supera el nivel {level} con más de {s} s de sobra', { level: challenge.level, s: challenge.seconds })
  dom.challenge.classList.remove('hidden')
}

/** Tarjeta para compartir: la foto de fichaje con el nombre del juego y su dirección debajo. */
async function mugshotCard(svg: string): Promise<Blob> {
  const photo = new Image()
  // Como imagen suelta el SVG necesita su espacio de nombres y un tamaño propio.
  photo.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" '))}`
  await photo.decode()
  const card = document.createElement('canvas')
  card.width = 720
  card.height = 1040
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('Sin contexto 2D para la tarjeta')
  ctx.fillStyle = '#0f1838'
  ctx.fillRect(0, 0, card.width, card.height)
  ctx.drawImage(photo, 0, 0, 720, 900)
  ctx.textAlign = 'center'
  ctx.font = '58px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
  ctx.fillStyle = '#fde047'
  ctx.fillText('NINE TO THIEF', 360, 966)
  ctx.font = '30px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
  ctx.fillStyle = '#34d399'
  ctx.fillText(`${t('¿ME SUPERAS?')}  ${location.host}`, 360, 1012)
  return new Promise((resolve, reject) => {
    card.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen'))), 'image/png')
  })
}

/** Dirección que se comparte: /en lleva la vista previa en inglés. */
const SHARE_URL = `${location.origin}/${lang === 'en' ? 'en/' : ''}`

/** Tarjeta de la última captura, lista antes del clic: compartir archivos exige ir pegado al gesto. */
let shot: Promise<Blob> | undefined

async function share(): Promise<void> {
  if (shot) {
    const text = `${t('Me ficharon robando {things} en Nine to Thief. ¿Duras más que yo?', { things: thingsOf(level) })} ${SHARE_URL}`
    const file = new File([await shot], 'nine-to-thief.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], text })
    // Sin hoja de compartir con archivos (escritorio): se descarga la imagen y se copia el texto.
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = file.name
    link.click()
    URL.revokeObjectURL(link.href)
    dom.shareBtn.textContent = t('¡IMAGEN GUARDADA!')
    return navigator.clipboard.writeText(text)
  }
  const text = rank
    ? t('Llegué al nivel {level} y voy #{rank} en Nine to Thief. ¿Me superas?', { level: bestLevel, rank })
    : t('Llegué al nivel {level} en Nine to Thief. ¿Me superas?', { level: bestLevel })
  const url = `${SHARE_URL}?reto=${bestLevel}.${bestSeconds}`
  if (navigator.share) return navigator.share({ text, url })
  await navigator.clipboard.writeText(`${text} ${url}`)
  dom.shareBtn.textContent = t('¡COPIADO!')
}

dom.shareBtn.addEventListener('click', (e) => {
  e.stopPropagation() // el cartel entero avanza de nivel al tocarlo
  share().catch((err: unknown) => {
    if (!(err instanceof DOMException && err.name === 'AbortError')) console.error('No se pudo compartir', err)
  })
})

// ---------- Lista de espera e idioma ----------

function openWaitlist(e: Event): void {
  e.stopPropagation()
  dom.waitlist.showModal()
}
dom.waitBtn.addEventListener('click', openWaitlist)
dom.waitBannerBtn.addEventListener('click', openWaitlist)
dom.waitClose.addEventListener('click', () => dom.waitlist.close())
dom.waitForm.addEventListener('submit', (e) => {
  e.preventDefault()
  dom.waitSend.disabled = true
  joinWaitlist(dom.waitEmail.value, lang).then(() => {
    dom.waitStatus.textContent = t('✓ Listo. Te avisaremos cuando salgan.')
  }).catch((err: unknown) => {
    console.error(err)
    dom.waitSend.disabled = false
    dom.waitStatus.textContent = err instanceof PlayError && err.status === 400 ? t('Revisa tu correo') : t('No se pudo guardar. Inténtalo de nuevo.')
  })
})

let rating = 0
const stars = [1, 2, 3, 4, 5].map((n) => {
  const star = document.createElement('button')
  star.type = 'button'
  star.className = 'cursor-pointer'
  star.setAttribute('aria-label', `${n}/5`)
  star.addEventListener('click', () => {
    rating = n
    stars.forEach((s, i) => (s.textContent = i < n ? '★' : '☆'))
  })
  star.textContent = '☆'
  return star
})
dom.fbStars.replaceChildren(...stars)
dom.fbBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  dom.feedback.showModal()
})
dom.fbClose.addEventListener('click', () => dom.feedback.close())
dom.fbForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (rating === 0) {
    dom.fbStatus.textContent = t('Elige una valoración de 1 a 5 estrellas')
    return
  }
  dom.fbSend.disabled = true
  sendFeedback(rating, dom.fbText.value, dom.fbEmail.value, lang, dom.fbTrap.value).then(() => {
    dom.fbStatus.textContent = t('✓ ¡Gracias por tu opinión!')
    dom.fbText.value = ''
  }).catch((err: unknown) => {
    console.error(err)
    dom.fbSend.disabled = false
    dom.fbStatus.textContent = err instanceof PlayError && err.status === 429 ? t('Demasiados mensajes, prueba más tarde') : t('No se pudo guardar. Inténtalo de nuevo.')
  })
})
function toggleMute(): void {
  muted = !muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch (err) {
    console.warn('Sin acceso a localStorage', err)
  }
  dom.muteBtn.textContent = muted ? t('🔇 SIN SONIDO') : t('🔊 SONIDO')
  if (suspense && audio) suspense.gain.setTargetAtTime(!muted && players.some((q) => q.stealing) ? 0.22 : 0, audio.currentTime, 0.04)
}
dom.muteBtn.textContent = muted ? t('🔇 SIN SONIDO') : t('🔊 SONIDO')
dom.muteBtn.addEventListener('click', toggleMute)
dom.throwBtn.addEventListener('click', throwDecoy)
dom.langBtn.addEventListener('click', () => setLang(lang === 'es' ? 'en' : 'es'))
document.documentElement.lang = lang

function showBanner(title: string, color: string, text: string, hint: string): void {
  stopStealing()
  shot = undefined
  dom.mugshot.classList.add('hidden')
  dom.waitBannerBtn.classList.add('hidden')
  dom.bannerRank.textContent = ''
  dom.shareBtn.textContent = t('COMPARTIR')
  dom.shareBtn.classList.toggle('hidden', bestLevel === 0)
  dom.bannerTitle.textContent = title
  dom.bannerTitle.className = `text-5xl md:text-8xl ${color}`
  dom.bannerText.textContent = text
  dom.bannerHint.textContent = hint
  dom.banner.classList.replace('hidden', 'flex')
}

function showMenu(): void {
  phase = 'menu'
  stopStealing()
  dom.hud.classList.add('hidden')
  dom.banner.classList.replace('flex', 'hidden')
  dom.menu.classList.remove('hidden')
  settle()
  syncObjects()
  renderMenu()
  focusRoster()
}

// ---------- Niveles ----------

function startLevel(): void {
  settle()
  if (finished()) return showMenu()
  level = progress.level
  cfg = levelConfig(level)
  timeLeft = LEVEL_SECONDS

  // Con dos celulares conectados se juega de a dos. El segundo personaje es el que eligió su celular, o se asigna solo.
  const second = (remote?.connected() ?? 0) >= 2
  const partner = players[1]
  if (second) {
    const wanted = CHARACTERS.find((c) => c.id === picks[1] && c !== player.char)
    partner.char = wanted ?? CHARACTERS.find((c) => c.hero && c !== player.char) ?? CHARACTERS.find((c) => c !== player.char) ?? partner.char
  }
  crew = second ? players : [player]
  for (const p of players) {
    const s = resolveCircle(SPAWN.x + 0.9 * p.slot, SPAWN.z, PLAYER_R, SOLID)
    Object.assign(p, { x: s.x, z: s.z, dir: -Math.PI / 2, grab: 0, cooldown: 0, cloakT: 0, dashT: 0, dashK: 1 })
    p.ring.visible = crew.includes(p)
    p.sweat.visible = false
    padSeen[p.slot] = false
  }
  pauseT = 0
  inMeeting = []
  seeing.clear()
  decoys = 0
  decoyT = 0
  decoyMesh.visible = false
  eventAt = level >= EVENT_FROM_LEVEL ? 12 + Math.random() * 30 : Infinity
  const plays = (c: Character): boolean => crew.some((p) => p.char === c)

  const patrollers = PATROL_ORDER.filter((id) => !crew.some((p) => p.char.id === id)).slice(0, cfg.patrols)
  // Ausentes: entre los que no patrullan ni juegan, rotando según el nivel para que no sean siempre los mismos.
  const staying = allNpcs.filter((npc) => !plays(npc.char) && !patrollers.includes(npc.char.id))
  const away = new Set(Array.from({ length: Math.min(awayCount(level), staying.length) }, (_, i) => staying[(level * 3 + i) % staying.length]))
  npcs = allNpcs.filter((npc) => !plays(npc.char) && !away.has(npc))
  for (const npc of allNpcs) {
    const route = ROUTES[patrollers.indexOf(npc.char.id) % ROUTES.length]
    const start = route?.[0] ?? npc.char.home
    Object.assign(npc, {
      x: start.x, z: start.z, dir: npc.char.home.dir, route, wp: 1,
      lureT: 0, freezeT: 0, blindT: 0, seenT: 0, alert: 0,
    })
    npc.cone.visible = npcs.includes(npc)
    npc.fig.visible = !away.has(npc)
  }
  for (const c of CHARACTERS) if (c.hero) figureOf(c).visible = plays(c)

  for (const chair of chairs) {
    chair.x = chair.home.x
    chair.z = chair.home.z
    chair.mesh.position.set(chair.x, 0, chair.z)
  }

  syncObjects()
  // De a dos hay más objetos: extras en escritorios libres que no se guardan en el progreso.
  const base = counts[level - 1] ?? 0
  if (second) {
    extraItems = extraObjects(level, Math.ceil(base * COOP_EXTRA), objects).map((o) => buildItem(o, true))
    extrasLeft = extraItems.length
    items = [...items, ...extraItems]
  }
  total = base + extraItems.length
  report({ action: 'start', char: player.char.id }, onSaved, onSaveFailed)

  dom.mission.textContent = t('NIVEL {n} · ROBA {total} {things}', { n: level, total, things: thingsOf(level).toUpperCase() })
  dom.stars.textContent = starsText()
  dom.abilityName.textContent = t(player.char.ability.name)
  for (const p of crew) drawTag(p)
  dom.zoomBtn.classList.toggle('hidden', second)
  dom.ability2Box.classList.toggle('hidden', !second)
  dom.ability2Name.textContent = t(partner.char.ability.name)
  dom.menu.classList.add('hidden')
  dom.banner.classList.replace('flex', 'hidden')
  dom.hud.classList.remove('hidden')
  phase = 'playing'
}

/** `captured`: lo vio un vigilante. Suma una estrella; a la quinta se pierde un nivel. */
function bust(reason: string, captured: boolean, culprit: Player = player): void {
  phase = 'busted'
  sfx.alarm()
  let text = reason
  if (captured) {
    const from = progress.level
    progress = caught(progress)
    report({ action: 'caught' }, onSaved, onSaveFailed)
    if (progress.stars === 0) {
      text = from > 1
        ? t('{reason} Te atraparon {max} veces: pierdes un nivel y vuelves al {level}.', { reason, max: MAX_STARS, level: progress.level })
        : t('{reason} Te atraparon {max} veces: tus robos del nivel 1 vuelven a su sitio.', { reason, max: MAX_STARS })
      syncObjects()
    } else {
      text = t('{reason} Capturas: {stars}', { reason, stars: starsText() })
    }
    dom.stars.textContent = starsText()
  }
  showBanner('BUSTED', 'text-red-500', text, pick('Toca para reintentar', 'OK: reintentar · Atrás: cambiar de personaje', 'ENTER: reintentar · ESC: cambiar de personaje'))
  if (!captured) return
  // Datos estáticos propios y un número: no hay entrada de usuario en este HTML.
  const photo = mugshotHtml(culprit.char, progress.captures)
  dom.mugshot.innerHTML = photo
  dom.mugshot.classList.remove('hidden')
  shot = mugshotCard(photo)
  shot.catch((err: unknown) => console.error('No se pudo preparar la tarjeta', err))
  dom.shareBtn.classList.remove('hidden')
}

function win(): void {
  phase = 'won'
  sfx.win()
  const spare = Math.ceil(timeLeft)
  if (level >= bestLevel) {
    bestLevel = level
    bestSeconds = Math.min(99, Math.max(0, spare))
  }
  shot = undefined // se comparte el avance, no la foto de fichaje de una captura anterior
  dom.shareBtn.textContent = t('COMPARTIR')
  dom.shareBtn.classList.remove('hidden')
  const more = pick('Toca para seguir', 'OK: siguiente nivel', 'ENTER: siguiente nivel')
  const back = pick('Toca para volver al menú', 'OK: volver al menú', 'ENTER: volver al menú')
  if (!finished()) showBanner('MISSION PASSED!', 'text-yellow-300', t('Nivel {level} superado con {s} s de sobra', { level, s: spare }), more)
  else if (account) showBanner(t('¡OFICINA VACÍA!'), 'text-yellow-300', t('Te lo robaste todo. No queda nada.'), back)
  else {
    showBanner(t('DEMO SUPERADA'), 'text-yellow-300', t('Acerca tu art toy para jugar los 10 niveles y guardar tu partida.'), back)
    dom.waitBannerBtn.classList.remove('hidden')
  }
  if (challenge && (level > challenge.level || (level === challenge.level && spare > challenge.seconds))) dom.bannerTitle.textContent = t('¡Reto superado!')
  reportWin()
}

// ---------- Habilidades ----------

function useAbility(p: Player): void {
  const { effect, cooldown: wait } = p.char.ability
  if (!effect || p.cooldown > 0 || phase !== 'playing' || !crew.includes(p)) return
  p.cooldown = wait ?? 0
  sfx.ability()
  const near = (radius: number): Npc[] =>
    npcs.filter((n) => Math.hypot(n.x - p.x, n.z - p.z) <= radius)
  switch (effect.kind) {
    case 'lure': {
      const at = effect.at === 'self' ? { x: p.x, z: p.z } : CONFERENCE
      for (const n of near(effect.radius)) Object.assign(n, { lure: at, lureT: effect.seconds })
      break
    }
    case 'freeze':
      for (const n of near(effect.radius)) n.freezeT = effect.seconds
      break
    case 'blind':
      for (const n of near(effect.radius)) Object.assign(n, { blindT: effect.seconds, blindK: effect.factor })
      break
    case 'cloak':
      p.cloakT = effect.seconds
      break
    case 'dash':
      p.dashT = effect.seconds
      p.dashK = effect.factor
      break
    case 'time':
      timeLeft += effect.seconds
      break
  }
}

// ---------- Entrada ----------

const keys = new Set<string>()

/** En el televisor no hay puntero: lleva el foco al primer personaje. Con retraso para que el OK que lo provocó no lo pulse. */
function focusRoster(): void {
  if (TV) setTimeout(() => dom.roster.querySelector('button')?.focus(), 50)
}

/** Enter o toque: avanza desde el póster o desde el cartel de fin de nivel. */
function confirm(): void {
  if (phase === 'menu') {
    dom.poster.classList.add('hidden')
    focusRoster()
  }
  else if (phase === 'won' || phase === 'busted') startLevel()
}

// Palanca táctil: dirección unitaria en pantalla (y hacia arriba).
const stick = { x: 0, y: 0 }
const STICK_TRAVEL = 40
const STICK_DEAD = 10

function moveStick(e: PointerEvent): void {
  const r = dom.stick.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  const len = Math.hypot(dx, dy)
  const k = len > STICK_TRAVEL ? STICK_TRAVEL / len : 1
  dom.knob.style.translate = `${dx * k}px ${dy * k}px`
  stick.x = len < STICK_DEAD ? 0 : dx / len
  stick.y = len < STICK_DEAD ? 0 : -dy / len
}

function releaseStick(): void {
  stick.x = 0
  stick.y = 0
  dom.knob.style.translate = ''
}

dom.stick.addEventListener('pointerdown', (e) => {
  dom.stick.setPointerCapture(e.pointerId)
  moveStick(e)
})
dom.stick.addEventListener('pointermove', (e) => {
  if (dom.stick.hasPointerCapture(e.pointerId)) moveStick(e)
})
dom.stick.addEventListener('pointerup', releaseStick)
dom.stick.addEventListener('pointercancel', releaseStick)

// El botón ROBAR equivale a mantener E.
dom.grabBtn.addEventListener('pointerdown', () => keys.add('KeyE'))
for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
  dom.grabBtn.addEventListener(type, () => keys.delete('KeyE'))
}
dom.touch.addEventListener('contextmenu', (e) => e.preventDefault())

// iOS Safari ignora user-scalable=no y touch-action con dos dedos en elementos distintos:
// se cancela el pellizco siempre, y cualquier arrastre fuera del menú (que sí necesita scroll).
addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 || phase !== 'menu') e.preventDefault()
}, { passive: false })
addEventListener('gesturestart', (e) => e.preventDefault())
dom.abilityBox.addEventListener('click', () => useAbility(player))
dom.menuBtn.addEventListener('click', () => showMenu())
dom.zoomBtn.addEventListener('click', toggleZoom)
dom.banner.addEventListener('click', confirm)
/** El OK y las flechas del mando de la tele no siempre traen `code`; `key` sí. */
const keyId = (e: KeyboardEvent): string => (e.key === 'Enter' || e.key.startsWith('Arrow') ? e.key : e.code)

window.tvBack = () => {
  const open = document.querySelector<HTMLDialogElement>('dialog[open]')
  if (open) {
    open.close()
    return true
  }
  if (phase === 'menu') return false
  showMenu()
  return true
}

// ---------- Celular como mando (televisor) ----------

const padBoxes = { poster: el<HTMLDivElement>('#padPoster'), menu: el<HTMLDivElement>('#padMenu') }
let remote: Remote | undefined
/** Botones de cada celular ahora y en el cuadro anterior: ability, ok y back actúan al pulsar, grab mientras se mantiene. */
const padHeld: [number, number] = [0, 0]
const padWas: [number, number] = [0, 0]

/** Qué personaje eligió cada celular (null: aún nada). Se publica a los celulares y se marca en el menú. */
let picks: Picks = [null, null]

function setPicks(next: Picks): void {
  picks = next
  remote?.setPicks(picks)
  if (phase !== 'menu') return
  // Repintar el menú no debe quitarle el foco al personaje que el mando de la tele tiene enfocado.
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.id : undefined
  renderMenu()
  if (focused) dom.roster.querySelector<HTMLElement>(`[data-id="${focused}"]`)?.focus()
}

/** Un celular quiere ese personaje: solo desde el menú, sin repetir, y con art toy el jugador 1 no cambia. */
function onPick(slot: 0 | 1, id: string): void {
  if (phase !== 'menu') return remote?.setPicks(picks)
  const known = new Set(CHARACTERS.map((c) => c.id))
  const ownId = account ? player.char.id : undefined
  const blocked = new Set<string>()
  if (ownId && slot === 1) blocked.add(ownId)
  if (ownId && slot === 0 && id !== ownId) blocked.add(id)
  const next = applyPick(picks, slot, id, known, blocked)
  if (next === picks) return remote?.setPicks(picks) // el celular vuelve a ver la lista como está
  setPicks(next)
}

function padStatus(status: RemoteStatus, connected: number): void {
  // Un celular que se va deja libre su personaje.
  const gone = ([0, 1] as const).filter((slot) => picks[slot] !== null && remote !== undefined && !remote.occupied(slot))
  if (gone.length > 0) setPicks([gone.includes(0) ? null : picks[0], gone.includes(1) ? null : picks[1]])
  const text = status === 'connecting' ? t('Preparando el mando…')
    : status === 'offline' ? t('Mando por celular no disponible')
    : connected === 0 ? t('Escanea con tu celular para controlar')
    : connected === 1 ? t('Jugador 1 conectado ✓ Otro celular puede unirse para jugar de a dos')
    : t('Jugadores 1 y 2 conectados ✓')
  for (const box of Object.values(padBoxes)) {
    const label = box.querySelector('.padText')
    if (label) label.textContent = text
    // El QR sigue a la vista hasta que entra el segundo jugador.
    for (const part of box.querySelectorAll('.padQr, .padCode')) part.classList.toggle('hidden', connected >= 2)
  }
}

if (TV) {
  remote = new Remote(padStatus, enterWithToy, onPick)
  const qr = qrcode(0, 'M')
  qr.addData(`${location.origin}/pad.html?c=${remote.code}`)
  qr.make()
  for (const img of document.querySelectorAll<HTMLImageElement>('.padQr')) img.src = qr.createDataURL(4, 4)
  // El código escrito sirve cuando la cámara del celular no lee el QR (se teclea en /pad.html).
  for (const code of document.querySelectorAll('.padCode')) code.textContent = remote.code
  padBoxes.menu.classList.replace('hidden', 'flex')
}

/** Un celular manda su art toy: la tele entra con esa cuenta. Solo desde el menú, nunca a media partida. */
function enterWithToy(code: string): void {
  if (phase !== 'menu') return
  dom.poster.classList.add('hidden')
  open(code).then((found) => {
    if (found) signIn(found)
    else notify(t('Art toy nuevo: regístralo primero en tu celular'))
  }).catch((err: unknown) => {
    console.error(err)
    notify(err instanceof PlayError && err.status === 404 ? t('Etiqueta no reconocida: juegas la demo') : t('No se pudo conectar: juegas la demo'))
  })
}

/** OK del celular: avanza el póster o el cartel; en el menú pulsa el personaje enfocado. */
function padOk(): void {
  if (phase !== 'menu') return confirm()
  // Los celulares se conectan desde el póster: si ya eligieron, OK empieza sin pasar por el menú.
  const first = CHARACTERS.find((c) => c.id === picks[0])
  if (first || picks[1] !== null) {
    dom.poster.classList.add('hidden')
    const fallback = CHARACTERS.find((c) => c.id !== picks[1]) ?? player.char
    return beginGame(first ?? (player.char.id === picks[1] ? fallback : player.char))
  }
  // Sin elecciones: el primer OK deja el póster y los siguientes pulsan el personaje que la tele tiene enfocado.
  if (!dom.poster.classList.contains('hidden')) return confirm()
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.click()
}

/** Acerca o aleja la vista. Solo con un jugador: con dos, la cámara compartida los mantiene a ambos a la vista. */
function toggleZoom(): void {
  if (crew.length > 1) return
  closeUp = !closeUp
  try {
    localStorage.setItem(ZOOM_KEY, closeUp ? 'close' : 'far')
  } catch (err) {
    console.warn('No se pudo guardar el zoom', err)
  }
}

/** Celular que ya jugaba este nivel y dejó de enviar (se cayó la red o apagó la pantalla). */
const PAD_QUIET_MS = 3000
/** Segundos que la partida espera a que vuelva antes de seguir sin él. */
const PAUSE_GIVE_UP_S = 15
const padSeen: [boolean, boolean] = [false, false]
let pauseT = 0

function padMissing(): Player | undefined {
  for (const p of crew) {
    const live = (remote?.quietMs(p.slot) ?? Infinity) < PAD_QUIET_MS
    if (live) padSeen[p.slot] = true
    else if (padSeen[p.slot]) return p
  }
  return undefined
}

/** Cartel de pausa mientras falta un celular. */
function showPause(absent: Player | undefined): void {
  dom.pauseBox.classList.toggle('hidden', absent === undefined)
  dom.pauseBox.classList.toggle('flex', absent !== undefined)
  if (!absent) return
  dom.pauseTitle.textContent = t('PARTIDA EN PAUSA')
  dom.pauseText.textContent = t('Jugador {n} desconectado. Esperando… {s} s', { n: absent.slot + 1, s: Math.max(0, Math.ceil(PAUSE_GIVE_UP_S - pauseT)) })
}

function pollPad(): void {
  for (const slot of [0, 1] as const) {
    const buttons = remote?.source(slot)?.buttons ?? 0
    padHeld[slot] = buttons
    const pressed = buttons & ~padWas[slot]
    padWas[slot] = buttons
    if (pressed & PAD_BUTTON.ability) useAbility(players[slot])
    if (pressed & PAD_BUTTON.zoom) toggleZoom()
    if (pressed & PAD_BUTTON.back) window.tvBack?.()
    if (pressed & PAD_BUTTON.ok) padOk()
  }
  // El código QR sobra en cuanto se pasa del póster.
  padBoxes.poster.classList.toggle('hidden', !TV || dom.poster.classList.contains('hidden'))
}

dom.tvLinkBtn.addEventListener('click', () => {
  dom.tvLinkStatus.textContent = ''
  dom.tvLink.showModal()
})
dom.tvLinkForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!tagCode) return
  dom.tvLinkStatus.textContent = t('Enviando…')
  sendToy(dom.tvLinkCode.value.trim().toUpperCase(), tagCode).then(() => {
    dom.tvLinkStatus.textContent = t('Enviado: mira la tele ✓')
  }).catch((err: unknown) => {
    console.error(err)
    dom.tvLinkStatus.textContent = err instanceof Error && err.message === 'not-found' ? t('No hay ninguna tele con ese código') : t('No se pudo enviar')
  })
})

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || dom.waitlist.open) return // escribiendo, o con la lista de espera abierta
  const id = keyId(e)
  // Jugando, las flechas y OK no deben mover el foco ni pulsar botones de la interfaz.
  if (phase === 'playing' && (id.startsWith('Arrow') || id === 'Enter')) e.preventDefault()
  keys.add(id)
  if (e.repeat) return
  if (ABILITY_KEYS.has(id) || ABILITY_KEYS.has(e.key)) useAbility(player)
  else if (id === 'KeyZ') toggleZoom()
  else if (id === 'KeyM') toggleMute()
  else if (id === 'KeyF') throwDecoy()
  else if (id === 'Enter') confirm()
  else if (id === 'Escape' && phase !== 'menu') showMenu()
})
addEventListener('keyup', (e) => keys.delete(keyId(e)))
dom.poster.addEventListener('click', confirm)
addEventListener('blur', () => keys.clear())

const held = (...codes: string[]): number => (codes.some((c) => keys.has(c)) ? 1 : 0)

// ---------- Simulación ----------

function updateNpc(n: Npc, dt: number): void {
  n.blindT = Math.max(0, n.blindT - dt)
  if (n.freezeT > 0) {
    n.freezeT -= dt
    return
  }
  let want = n.char.home.dir + Math.sin(clock * cfg.sweepSpeed + n.phase) * cfg.sweepAmp
  let walking = false
  if (!n.route) {
    const hx = n.char.home.x - n.x
    const hz = n.char.home.z - n.z
    const away = Math.hypot(hx, hz)
    if (away > 0.02) {
      const step = Math.min(away, RETURN_SPEED * dt)
      n.x += (hx / away) * step
      n.z += (hz / away) * step
    }
  }
  if (n.lureT > 0) {
    n.lureT -= dt
    want = Math.atan2(n.lure.z - n.z, n.lure.x - n.x)
  } else if (n.route) {
    const target = n.route[n.wp % n.route.length] ?? n.char.home
    const dx = target.x - n.x
    const dz = target.z - n.z
    const dist = Math.hypot(dx, dz)
    const step = cfg.walk * dt
    walking = true
    if (dist <= step) {
      n.x = target.x
      n.z = target.z
      n.wp = (n.wp + 1) % n.route.length
      want = n.dir
    } else {
      n.x += (dx / dist) * step
      n.z += (dz / dist) * step
      want = Math.atan2(dz, dx) + Math.sin(clock * 2 + n.phase) * 0.35
    }
  }
  n.dir = turnToward(n.dir, want, 5 * dt)
  place(n.fig, n.x, n.z, n.dir, walking ? clock * 7 + n.phase : undefined)
}

function updateCone(n: Npc, range: number): void {
  const attr = n.cone.geometry.getAttribute('position')
  attr.setXYZ(0, n.x, 0.04, n.z)
  for (let i = 0; i <= RAYS; i++) {
    const a = n.dir - cfg.halfAngle + (2 * cfg.halfAngle * i) / RAYS
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const d = rayDistance(n.x, n.z, dx, dz, range, SIGHT)
    attr.setXYZ(i + 1, n.x + dx * d, 0.04, n.z + dz * d)
  }
  attr.needsUpdate = true
}

/** Registra el robo de un objeto de pared: true si con él se supera el nivel. */
function commitSteal(item: Item): boolean {
  const next = steal(progress, item.index, counts)
  if (!next) throw new Error(`Robo inválido: nivel ${progress.level}, objeto ${item.index}`)
  const passed = next.level !== progress.level
  progress = next
  report({ action: 'steal', index: item.index }, onSaved, onSaveFailed)
  return passed
}

/** Un objeto recién robado. Devuelve true si con él se supera el nivel. */
function completeItem(target: Item): boolean {
  if (target.extra) {
    extrasLeft -= 1
    if (extrasLeft > 0 || !heldBase) return false
    const last = heldBase
    heldBase = undefined
    return commitSteal(last)
  }
  const next = steal(progress, target.index, counts)
  if (!next) throw new Error(`Robo inválido: nivel ${progress.level}, objeto ${target.index}`)
  // Con extras pendientes, el último objeto del nivel se retiene: el nivel no se cierra hasta robarlos todos.
  if (next.level !== progress.level && extrasLeft > 0) {
    heldBase = target
    return false
  }
  return commitSteal(target)
}

// Señuelos: cada objeto robado se puede lanzar para que los vigilantes cercanos vayan a mirar.
const MAX_DECOYS = 3
const THROW_RANGE = 4
const DECOY_RADIUS = 7
const DECOY_SECONDS = 4
let decoys = 0
let decoyT = 0
const decoyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xfde047 }))
decoyMesh.visible = false
scene.add(decoyMesh)

function throwDecoy(): void {
  if (phase !== 'playing' || decoys <= 0) return
  decoys -= 1
  const land = resolveCircle(player.x + Math.cos(player.dir) * THROW_RANGE, player.z + Math.sin(player.dir) * THROW_RANGE, 0.2, SOLID)
  decoyMesh.position.set(land.x, 0.2, land.z)
  decoyMesh.visible = true
  decoyT = DECOY_SECONDS
  for (const n of npcs) if (Math.hypot(n.x - land.x, n.z - land.z) <= DECOY_RADIUS) Object.assign(n, { lure: land, lureT: DECOY_SECONDS })
  tone(220, 0, 0.12, 'triangle', 0.12)
}

// Eventos: una vez por nivel (desde el 3) pasa algo en la oficina.
const EVENT_FROM_LEVEL = 3
const MEETING_SECONDS = 12
let eventAt = Infinity
let meetingEnd = 0
let inMeeting: Npc[] = []
/** Vigilantes que ya ven a alguien: el aviso suena al empezar a verlo, no en cada cuadro. */
const seeing = new Set<Npc>()

function endMeeting(): void {
  for (const n of inMeeting) {
    n.fig.visible = true
    n.cone.visible = true
  }
  npcs = [...npcs, ...inMeeting]
  inMeeting = []
}

function runEvent(): void {
  if (inMeeting.length > 0 && clock >= meetingEnd) endMeeting()
  if (LEVEL_SECONDS - timeLeft < eventAt) return
  eventAt = Infinity
  if (Math.random() < 0.5) {
    inMeeting = npcs.filter((n) => !n.route).slice(0, Math.floor(npcs.length / 2))
    if (inMeeting.length === 0) return
    for (const n of inMeeting) {
      n.fig.visible = false
      n.cone.visible = false
    }
    npcs = npcs.filter((n) => !inMeeting.includes(n))
    meetingEnd = clock + MEETING_SECONDS
    notify(t('📅 Reunión: varios se fueron a la sala. ¡Aprovecha!'))
  } else {
    for (const n of npcs) Object.assign(n, { blindT: 8, blindK: 0.35 })
    notify(t('⚡ Apagón: casi no ven. ¡Aprovecha!'))
  }
}

function update(dt: number): void {
  clock += dt
  timeLeft -= dt
  runEvent()
  if (decoyT > 0 && (decoyT -= dt) <= 0) decoyMesh.visible = false
  // La música se acelera en los últimos 30 s.
  if (pulseRate && audio) pulseRate.setTargetAtTime(6 + 6 * Math.min(1, Math.max(0, (30 - timeLeft) / 30)), audio.currentTime, 0.2)
  for (const item of items) item.marker.rotateY(dt * 3)

  // Cada jugador elige el objeto que tiene a mano, decide si roba y se mueve.
  const plans: { readonly p: Player; readonly target: Item | undefined; readonly grabbing: boolean }[] = []
  for (const p of crew) {
    p.cooldown = Math.max(0, p.cooldown - dt)
    p.cloakT = Math.max(0, p.cloakT - dt)
    p.dashT = Math.max(0, p.dashT - dt)

    let target: Item | undefined
    let best = REACH
    for (const item of items) {
      const d = Math.hypot(item.x - p.x, item.z - p.z)
      if (d <= best) {
        best = d
        target = item
      }
    }
    // Teclado, mando de la tele y palanca táctil mueven al jugador 1; el celular de cada jugador, al suyo.
    const own = p === player
    const pad = remote?.source(p.slot)
    const wantsGrab = (own && (keys.has('KeyE') || (TV && keys.has('Enter')))) || (padHeld[p.slot] & PAD_BUTTON.grab) !== 0
    const grabbing = target !== undefined && wantsGrab
    if (grabbing !== p.stealing) setStealing(p, grabbing)
    plans.push({ p, target, grabbing })

    // Pantalla: derecha = (1, -1), arriba = (-1, -1) sobre XZ.
    const ix = (own ? held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft') + stick.x : 0) + (pad?.x ?? 0)
    const iy = (own ? held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown') + stick.y : 0) + (pad?.y ?? 0)
    const mx = ix - iy
    const mz = -ix - iy
    const moving = !grabbing && (mx !== 0 || mz !== 0)
    if (moving) {
      const len = Math.hypot(mx, mz)
      const speed = BASE_SPEED * (p.char.speed ?? 1) * (p.dashT > 0 ? p.dashK : 1)
      let next = resolveCircle(p.x + (mx / len) * speed * dt, p.z + (mz / len) * speed * dt, PLAYER_R, SOLID)
      // A los vigilantes se les puede empujar un poco: ceden la mayor parte y el jugador avanza más lento.
      for (const n of npcs) {
        const dx = next.x - n.x
        const dz = next.z - n.z
        const d = Math.hypot(dx, dz)
        if (d < 1e-6 || d >= NPC_GAP) continue
        const overlap = NPC_GAP - d
        const moved = resolveCircle(n.x - (dx / d) * overlap * PUSH_NPC, n.z - (dz / d) * overlap * PUSH_NPC, NPC_R, SOLID)
        n.x = moved.x
        n.z = moved.z
        // Lo que el vigilante no pudo ceder (contra una pared o mueble) se lo queda el jugador.
        const left = NPC_GAP - Math.hypot(next.x - n.x, next.z - n.z)
        if (left > 0) next = { x: next.x + (dx / d) * left, z: next.z + (dz / d) * left }
      }
      // Los dos jugadores tampoco se atraviesan.
      for (const other of crew) {
        if (other === p) continue
        const dx = next.x - other.x
        const dz = next.z - other.z
        const d = Math.hypot(dx, dz)
        if (d > 1e-6 && d < 0.6) next = { x: other.x + (dx / d) * 0.6, z: other.z + (dz / d) * 0.6 }
      }
      // ponytail: las sillas no chocan entre sí ni con los vigilantes; añadir si se nota al jugar.
      for (const chair of chairs) {
        let dx = chair.x - next.x
        let dz = chair.z - next.z
        let d = Math.hypot(dx, dz)
        if (d >= CHAIR_GAP || d < 1e-6) continue
        const pushed = resolveCircle(next.x + (dx / d) * CHAIR_GAP, next.z + (dz / d) * CHAIR_GAP, CHAIR_R, SOLID)
        chair.x = pushed.x
        chair.z = pushed.z
        chair.mesh.position.set(chair.x, 0, chair.z)
        // Silla trabada contra un mueble o pared: frena al jugador en vez de dejarlo atravesarla.
        dx = chair.x - next.x
        dz = chair.z - next.z
        d = Math.hypot(dx, dz)
        if (d > 1e-6 && d < CHAIR_GAP) next = { x: chair.x - (dx / d) * CHAIR_GAP, z: chair.z - (dz / d) * CHAIR_GAP }
      }
      p.x = next.x
      p.z = next.z
      p.dir = turnToward(p.dir, Math.atan2(mz, mx), 14 * dt)
    } else if (target) {
      p.dir = turnToward(p.dir, Math.atan2(target.z - p.z, target.x - p.x), 14 * dt)
    }

    const fig = figureOf(p.char)
    place(fig, p.x, p.z, p.dir, moving ? clock * 11 : undefined)
    fig.visible = p.cloakT <= 0 || Math.floor(clock * 12) % 2 === 0
    p.ring.position.set(p.x, 0.05, p.z)
    p.ring.material.color.set(p.cloakT > 0 ? 0xffffff : p.color)
  }

  // Los vigilantes miran a todos: ven a quien tengan en su cono y se alarman si ese roba.
  let caughtBy: { readonly npc: Npc; readonly by: Player } | undefined
  const spotted = new Set<Player>()
  for (const n of npcs) {
    updateNpc(n, dt)
    let range = 0
    let sawAny = false
    let grabber: Player | undefined
    for (const { p, grabbing } of plans) {
      const reach = cfg.range * (p.char.visibility ?? 1) * (n.blindT > 0 ? n.blindK : 1)
      range = Math.max(range, reach)
      const sees = p.cloakT <= 0 && canSee({ x: n.x, z: n.z, dir: n.dir, range: reach, halfAngle: cfg.halfAngle }, p, SIGHT)
      if (!sees) continue
      sawAny = true
      spotted.add(p)
      if (grabbing) grabber ??= p
    }
    if (!sawAny) seeing.delete(n)
    else if (!seeing.has(n)) {
      seeing.add(n)
      sfx.spot()
      navigator.vibrate?.(60)
    }
    n.alert += ((sawAny ? 1 : 0) - n.alert) * Math.min(1, dt * 10)
    reactFigure(n.fig, n.alert, clock)
    updateCone(n, range)
    n.seenT = grabber ? n.seenT + dt : 0
    n.cone.material.color.set(sawAny ? (grabber ? CONE.alert : CONE.inside) : CONE.idle)
    if (grabber && n.seenT > (grabber.char.grace ?? 0)) caughtBy ??= { npc: n, by: grabber }
  }
  for (const p of crew) {
    p.sweat.visible = spotted.has(p)
    p.sweat.position.set(p.x, 2 + Math.sin(clock * 12) * 0.05, p.z)
    p.tag.visible = crew.length > 1
    p.tag.position.set(p.x, 2.5, p.z)
  }

  for (const { p, grabbing } of plans) p.grab = grabbing ? p.grab + dt / (BASE_GRAB * (p.char.grabTime ?? 1)) : 0
  if (caughtBy) return bust(t('¡{name} te vio robando!', { name: caughtBy.npc.char.name }), true, caughtBy.by)
  for (const { p, target } of plans) {
    if (!target || p.grab < 1) continue
    p.grab = 0
    if (!items.includes(target)) continue // el otro jugador se lo llevó primero
    vanishing.set(target, 0)
    target.marker.visible = false
    items = items.filter((i) => i !== target)
    decoys = Math.min(MAX_DECOYS, decoys + 1)
    sfx.pick()
    if (completeItem(target)) return win()
  }
  if (timeLeft <= 0) return bust(t('Se acabó el tiempo'), false)

  const lead = plans[0]
  const mate = plans[1]
  dom.prompt.textContent = lead?.target ? pick('MANTÉN ROBAR', 'MANTÉN OK PARA ROBAR', 'MANTÉN E PARA ROBAR') : ''
  dom.grab.value = Math.min(player.grab, 1)
  dom.grab.classList.toggle('invisible', !lead?.grabbing)
  dom.grab2.classList.toggle('hidden', !mate)
  dom.grab2.value = mate ? Math.min(mate.p.grab, 1) : 0
  dom.grab2.classList.toggle('invisible', !mate?.grabbing)
}

/** Estado de la habilidad de un jugador: pasiva, usada, segundos de recarga o lista (con su botón). */
function abilityText(p: Player, ready: string): string {
  const { effect } = p.char.ability
  return !effect ? t('PASIVA') : p.cooldown > 99 ? t('USADA') : p.cooldown > 0 ? `${Math.ceil(p.cooldown)} s` : ready
}

/** Flecha al borde de la pantalla hacia el objeto más cercano cuando ninguno se ve. */
const hintPoint = new THREE.Vector3()

function drawHint(): void {
  const near = phase === 'playing' ? items.reduce<Item | undefined>((best, i) => (!best || Math.hypot(i.x - player.x, i.z - player.z) < Math.hypot(best.x - player.x, best.z - player.z) ? i : best), undefined) : undefined
  if (!near) return void dom.hintArrow.classList.add('hidden')
  hintPoint.set(near.x, near.y, near.z).project(camera)
  const onScreen = items.some((i) => {
    const p = hintPoint.clone().set(i.x, i.y, i.z).project(camera)
    return Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85
  })
  dom.hintArrow.classList.toggle('hidden', onScreen)
  if (onScreen) return
  // Desde el personaje (centro de la pantalla) hacia el objeto, recortado a un margen del borde.
  const k = 0.82 / Math.max(Math.abs(hintPoint.x) / 0.9, Math.abs(hintPoint.y) / 0.85)
  const x = hintPoint.x * k
  const y = hintPoint.y * k
  dom.hintArrow.style.left = `${((x + 1) / 2) * 100}%`
  dom.hintArrow.style.top = `${((1 - y) / 2) * 100}%`
  dom.hintArrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(x, y)}rad)`
}

function drawHud(): void {
  dom.count.textContent = `${total - items.length} / ${total}`
  dom.throwBtn.classList.toggle('hidden', decoys === 0)
  dom.throwBtn.textContent = `🎯 ${t('LANZAR')} ×${decoys}${TV ? '' : ' (F)'}`
  drawHint()
  const secs = Math.max(0, Math.ceil(timeLeft))
  dom.timer.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  dom.timer.classList.toggle('text-red-500', timeLeft <= 10)
  dom.abilityState.textContent = abilityText(player, pick('TOCA · LISTA', 'PLAY · LISTA', 'Q · LISTA'))
  dom.ability2State.textContent = abilityText(players[1], t('LISTA'))

  const k = dom.radar.width / MAP.w
  radar.clearRect(0, 0, dom.radar.width, dom.radar.height)
  radar.fillStyle = '#d9d4c8'
  for (const w of WALLS) radar.fillRect(w.minX * k, w.minZ * k, (w.maxX - w.minX) * k, (w.maxZ - w.minZ) * k)
  const dot = (p: Pt, color: string, r: number): void => {
    radar.fillStyle = color
    radar.beginPath()
    radar.arc(p.x * k, p.z * k, r, 0, Math.PI * 2)
    radar.fill()
  }
  for (const n of npcs) dot(n, '#ff4d4d', 2.5)
  for (const item of items) dot(item, '#ffd400', 4)
  for (const p of crew) dot(p, p === player ? '#39ff88' : '#4dd2ff', 4)
}

syncObjects()
if (!connecting) renderMenu()

let last = performance.now()
let frameCount = 0

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  pollPad()
  if (phase !== 'playing') {
    for (const p of players) {
      p.sweat.visible = false
      p.tag.visible = false
    }
    showPause(undefined)
  }
  let wantZoom = phase === 'won' || phase === 'busted' ? zoom : 1
  if (phase === 'playing') {
    // Si un celular se cae, el reloj y los vigilantes esperan; pasado un rato, sigue sin él.
    const absent = padMissing()
    if (absent) {
      pauseT += dt
      stopStealing()
      if (pauseT >= PAUSE_GIVE_UP_S) {
        padSeen[absent.slot] = false
        pauseT = 0
      }
    } else {
      pauseT = 0
      update(dt)
    }
    if (phase === 'playing') showPause(absent)
    drawHud()
    // Cámara en el punto medio de quienes juegan; con dos se aleja lo justo para que quepan.
    const [a, b] = crew
    if (a && b) {
      lookAt((a.x + b.x) / 2, (a.z + b.z) / 2)
      wantZoom = coopZoom(a, b, innerWidth / innerHeight, baseView())
    } else {
      lookAt(player.x, player.z)
      wantZoom = closeUp ? CLOSE_ZOOM : 1
    }
  } else if (phase === 'menu') {
    lookAt(MAP.w / 2, MAP.d / 2)
  }
  if (Math.abs(wantZoom - zoom) > 0.002) {
    zoom += (wantZoom - zoom) * Math.min(1, dt * 3)
    applyView()
  }
  // Lo robado sube girando y se encoge hasta desaparecer.
  for (const [item, t] of vanishing) {
    const k = 1 - (t + dt) / VANISH_SECONDS
    if (k <= 0) {
      item.mesh.visible = false
      vanishing.delete(item)
      continue
    }
    vanishing.set(item, t + dt)
    item.mesh.scale.setScalar(OBJECT_SCALE * k)
    item.mesh.position.y += dt * 1.5
    item.mesh.rotation.y += dt * 14
  }
  // El menú no necesita 60 fps: se dibuja a 30. Las sombras se actualizan en cuadros alternos.
  frameCount++
  if (phase !== 'menu' || frameCount % 2 === 0) {
    renderer.shadowMap.needsUpdate = frameCount % 2 === 0
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
