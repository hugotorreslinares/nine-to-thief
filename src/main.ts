import * as THREE from 'three'
import './style.css'
import {
  CHAIRS, CHAIR_R, CHARACTERS, CONFERENCE, FURNITURE, LEVEL_SECONDS, MAP, OBJECTS, PATROL_ORDER, ROOMS, ROUTES, SPAWN, WALLS,
  levelConfig, type Character, type LevelConfig,
} from './data.ts'
import { LITE, TOUCH, TV } from './device.ts'
import { buildFigure, setMask, swingLimbs } from './figure.ts'
import { lang, setLang, t } from './i18n.ts'
import { COUNTS, DEMO_COUNTS, LEVELS } from './levels.ts'
import { FRESH, MAX_STARS, caught, steal, type Progress } from './progress.ts'
import { PlayError, close, idle, joinWaitlist, open, register, report, type Account } from './session.ts'
import { PAD_BUTTON } from './padState.ts'
import { mugshotHtml, posterHtml } from './poster.ts'
import qrcode from 'qrcode-generator'
import { Remote, type RemoteStatus } from './remote.ts'
import { sendToy } from './toyLink.ts'
import { surface, type Surface } from './surface.ts'
import { claimNick, cleanNick, fetchBoard, isTaken, loadNick, saveNick, submitScore } from './scores.ts'
import { canSee, rayDistance, resolveCircle, turnToward, type Box, type Pt } from './logic.ts'

const BASE_SPEED = 4.2
const BASE_GRAB = 1.3
const REACH = 1.5
const PLAYER_R = 0.35
const VIEW = 15
const VIEW_SHORT = 10
/** Ancho mínimo visible en metros: en vertical la cámara se aleja para no quedar a ciegas. */
const MIN_VIEW_WIDTH = 10
/** Texto según el aparato: táctil, televisor o teclado. */
const pick = (touch: string, tv: string, keyboard: string): string => t(TOUCH ? touch : TV ? tv : keyboard)
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

const figures = new Map(CHARACTERS.map((c) => [c.id, buildFigure(c.look)]))
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
sun.shadow.mapSize.setScalar(TV ? 1024 : 2048)
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 })
scene.add(sun, sun.target)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

function resize(): void {
  const aspect = innerWidth / innerHeight
  // Celular en horizontal: pantalla baja, se acerca para que las figuras no queden diminutas.
  const base = innerHeight < 500 ? VIEW_SHORT : VIEW
  const view = Math.max(base, MIN_VIEW_WIDTH / aspect)
  camera.left = (-view * aspect) / 2
  camera.right = (view * aspect) / 2
  camera.top = view / 2
  camera.bottom = -view / 2
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 2)) // la GPU de la tele no da para 1080p
  renderer.setSize(innerWidth, innerHeight, false)
}
addEventListener('resize', resize)
resize()

function lookAt(x: number, z: number): void {
  camera.position.set(x + 15, 12.25, z + 15)
  camera.lookAt(x, 0, z)
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)

function addBox(b: Box, h: number, color: number, y = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(UNIT_BOX, surface(color, 0.8))
  mesh.scale.set(b.maxX - b.minX, h, b.maxZ - b.minZ)
  mesh.position.set((b.minX + b.maxX) / 2, y + h / 2, (b.minZ + b.maxZ) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

for (const room of ROOMS) addBox(room.box, 0.02, room.color, -0.02).castShadow = false
for (const wall of WALLS) addBox(wall, WALL_H, 0xe8e4da)
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, LITE ? 8 : 16)

function addDetail(geo: THREE.BufferGeometry, color: number, size: readonly [number, number, number], at: readonly [number, number, number]): void {
  const mesh = new THREE.Mesh(geo, surface(color, 0.6))
  mesh.scale.set(...size)
  mesh.position.set(...at)
  mesh.castShadow = true
  scene.add(mesh)
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
  g.position.set(at.x, 0, at.z)
  g.rotation.y = -at.dir
  scene.add(g)
  return g
}

const chairs: readonly Chair[] = CHAIRS.map((c) => ({ home: c, mesh: makeChair(c), x: c.x, z: c.z }))
const CHAIR_GAP = PLAYER_R + CHAIR_R

/** Objeto robable en su sitio fijo de la oficina. */
interface Item extends Pt {
  readonly level: number
  readonly index: number
  readonly y: number
  readonly turn: number
  readonly mesh: THREE.Group
  readonly marker: THREE.Mesh
}

/** Los objetos reales son diminutos desde la cámara: se agrandan para que se note cuándo faltan. */
const OBJECT_SCALE = 1.5
const MARKER_GEO = new THREE.OctahedronGeometry(0.16)
const MARKER_MAT = new THREE.MeshBasicMaterial({ color: 0xffd400 })
const partMats = new Map<number, Surface>()

const objects: readonly Item[] = OBJECTS.map((o) => {
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
  const marker = new THREE.Mesh(MARKER_GEO, MARKER_MAT)
  marker.position.y = 1.1 / OBJECT_SCALE
  mesh.add(marker)
  mesh.position.set(o.x, o.y, o.z)
  scene.add(mesh)
  return { ...o, mesh, marker }
})

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
    route: undefined, wp: 0, lure: CONFERENCE, lureT: 0, freezeT: 0, blindT: 0, blindK: 1, seenT: 0,
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

const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.55, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.9, depthWrite: false }),
)
ring.visible = false
scene.add(ring)

/** Gotita de sudor sobre el jugador mientras algún vigilante lo tiene en su cono de visión. */
const sweat = ((): THREE.Sprite => {
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(art), transparent: true, depthTest: false }))
  sprite.scale.set(0.55, 0.82, 1)
  sprite.renderOrder = 10
  sprite.visible = false
  scene.add(sprite)
  return sprite
})()

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
let grab = 0
let cooldown = 0
let cloakT = 0
let dashT = 0
let dashK = 1
let clock = 0
const player: { char: Character; x: number; z: number; dir: number } = {
  char: CHARACTERS[0] ?? (() => { throw new Error('Sin personajes') })(),
  x: SPAWN.x, z: SPAWN.z, dir: 0,
}

// ---------- Sonido ----------

let audio: AudioContext | undefined

function tone(freq: number, start: number, seconds: number, type: OscillatorType = 'square', volume = 0.07): void {
  if (!audio) return
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
}

/** Volumen de la música de suspenso; se crea al primer robo y queda sonando en silencio. */
let suspense: GainNode | undefined
let stealing = false

/** Bajo que alterna dos notas a un semitono, con pulso. Suena solo mientras se roba. */
function makeSuspense(ctx: AudioContext): GainNode {
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  const pulse = ctx.createGain()
  pulse.gain.value = 0.5
  pulse.connect(master)
  const lfo = (type: OscillatorType, hz: number, depth: number, target: AudioParam): void => {
    const osc = ctx.createOscillator()
    const amount = ctx.createGain()
    osc.type = type
    osc.frequency.value = hz
    amount.gain.value = depth
    osc.connect(amount).connect(target)
    osc.start()
  }
  lfo('sine', 6, 0.5, pulse.gain) // pulso
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
function setStealing(on: boolean): void {
  stealing = on
  setMask(figureOf(player.char), on || player.char.hero === true)
  if (!audio || (!on && !suspense)) return
  suspense ??= makeSuspense(audio)
  suspense.gain.setTargetAtTime(on ? 0.22 : 0, audio.currentTime, 0.04)
}

// ---------- Interfaz ----------

const ui = el<HTMLDivElement>('#ui')
ui.innerHTML = `
  <div id="hud" class="hidden">
    <div class="ink absolute top-3 left-3 text-base md:top-4 md:left-4 md:text-2xl">
      <div id="mission" class="text-yellow-300"></div>
      <div id="count" class="text-2xl md:text-4xl"></div>
    </div>
    <div class="ink absolute top-3 right-3 flex flex-col items-end md:top-4 md:right-4">
      <div id="stars" class="text-xl text-yellow-400 md:text-3xl"></div>
      <div id="timer" class="text-4xl md:text-6xl"></div>
      <button id="menuBtn" class="pointer-events-auto cursor-pointer rounded border-2 border-black bg-neutral-800/80 px-3 py-1 text-sm">${t('MENÚ')}</button>
    </div>
    <canvas id="radar" width="192" height="90" class="absolute bottom-16 left-10 rotate-45 rounded border-2 border-black bg-black/60 pointer-coarse:top-24 pointer-coarse:bottom-auto pointer-coarse:left-0 pointer-coarse:scale-50"></canvas>
    <div id="abilityBox" class="ink pointer-events-auto absolute right-4 bottom-4 cursor-pointer touch-none text-right pointer-coarse:bottom-36">
      <div id="abilityName" class="text-xl text-sky-300"></div>
      <div id="abilityState" class="text-3xl"></div>
    </div>
    <div class="ink absolute bottom-10 left-1/2 flex pointer-coarse:bottom-60 -translate-x-1/2 flex-col items-center gap-2">
      <div id="prompt" class="text-2xl text-yellow-300"></div>
      <progress id="grab" max="1" value="0" class="h-3 w-56 accent-yellow-400"></progress>
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
  <div id="padPoster" class="pointer-events-none absolute bottom-2 left-2 z-20 hidden w-40 flex-col items-center gap-1 rounded bg-white p-2 text-center font-sans text-xs leading-tight text-black">
    <img class="padQr size-32 [image-rendering:pixelated]" alt="" />
    <span class="padText"></span>
    <b class="padCode text-base tracking-widest"></b>
  </div>
  <div id="poster" class="pointer-events-auto absolute inset-0 z-10 cursor-pointer overflow-hidden bg-[repeating-conic-gradient(from_0deg_at_72%_50%,#ff8a1f_0_7.5deg,#c2410c_7.5deg_15deg)] portrait:bg-[repeating-conic-gradient(from_0deg_at_50%_30%,#ff8a1f_0_7.5deg,#c2410c_7.5deg_15deg)]">${posterHtml()}</div>
  <div id="menu" class="pointer-events-auto absolute inset-0 flex flex-col items-center gap-4 overflow-y-auto bg-black/75 p-3 md:p-6">
    <h1 class="ink text-center text-4xl text-yellow-300 md:text-7xl">NINE TO <span class="text-emerald-400">THIEF</span></h1>
    <p class="ink text-center text-base text-neutral-200 md:text-xl">${t('Elige a tu ladrón. Roba sin que te vean mientras lo coges. Un minuto por nivel.')}</p>
    <div id="padMenu" class="hidden items-center gap-3 rounded-lg bg-white p-2 font-sans text-sm text-black">
      <img class="padQr size-24 [image-rendering:pixelated]" alt="" />
      <span class="max-w-48 text-left"><span class="padText"></span><br /><b class="padCode text-lg tracking-widest"></b></span>
    </div>
    <p id="account" class="ink text-center text-lg text-emerald-400 md:text-2xl"></p>
    <p id="challenge" class="ink hidden text-center text-lg text-pink-400 md:text-2xl"></p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <button id="waitBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-pink-500 px-4 py-2 text-lg">${t('🔔 QUIERO MI ART TOY')}</button>
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
    <div id="roster" class="grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4"></div>
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
  langBtn: el<HTMLButtonElement>('#langBtn'),
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
  <button data-id="${c.id}" class="flex cursor-pointer items-center gap-3 rounded-lg border-2 ${c.hero ? 'border-yellow-300' : 'border-neutral-700'} bg-neutral-900/90 p-2 text-left hover:border-yellow-300 hover:bg-neutral-800">
    <img src="${portraits.get(c.id) ?? ''}" alt="${c.name}" class="size-16 shrink-0 md:size-20" />
    <span class="flex flex-col">
      <span class="text-2xl text-yellow-300">${c.name}</span>
      <span class="text-base text-sky-300">${t(c.ability.name)}</span>
      <span class="font-sans text-xs text-neutral-300">${t(c.ability.text)}</span>
    </span>
  </button>`).join('')
}

dom.roster.addEventListener('click', (e) => {
  const button = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[data-id]') : null
  const chosen = CHARACTERS.find((c) => c.id === button?.dataset.id)
  if (!chosen || connecting) return
  audio ??= new AudioContext()
  player.char = chosen
  if (account) progress = { ...progress, char: progress.char ?? chosen.id }
  else progress = FRESH // la demo empieza de cero cada vez
  startLevel()
})

// ---------- Art toy ----------

let noticeTimer: ReturnType<typeof setTimeout> | undefined
function notify(text: string): void {
  dom.notice.textContent = text
  dom.notice.classList.remove('hidden')
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => dom.notice.classList.add('hidden'), 5000)
}

/** Muestra u oculta cada objeto según el progreso: lo robado no está, lo del nivel en curso lleva marcador. */
function syncObjects(): void {
  vanishing.clear()
  const stealable = !finished()
  for (const o of objects) {
    const current = o.level === progress.level
    o.mesh.visible = o.level > progress.level || (current && !progress.stolen.includes(o.index))
    o.marker.visible = current && stealable
    o.mesh.scale.setScalar(OBJECT_SCALE)
    o.mesh.position.y = o.y
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
dom.langBtn.addEventListener('click', () => setLang(lang === 'es' ? 'en' : 'es'))
document.documentElement.lang = lang

function showBanner(title: string, color: string, text: string, hint: string): void {
  setStealing(false)
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
  setStealing(false)
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
  grab = 0
  cooldown = 0
  cloakT = 0
  dashT = 0
  Object.assign(player, { x: SPAWN.x, z: SPAWN.z, dir: -Math.PI / 2 })

  const patrollers = PATROL_ORDER.filter((id) => id !== player.char.id).slice(0, cfg.patrols)
  npcs = allNpcs.filter((npc) => npc.char !== player.char)
  for (const npc of allNpcs) {
    const route = ROUTES[patrollers.indexOf(npc.char.id) % ROUTES.length]
    const start = route?.[0] ?? npc.char.home
    Object.assign(npc, {
      x: start.x, z: start.z, dir: npc.char.home.dir, route, wp: 1,
      lureT: 0, freezeT: 0, blindT: 0, seenT: 0,
    })
    npc.cone.visible = npc.char !== player.char
    npc.fig.visible = true
  }
  for (const c of CHARACTERS) if (c.hero) figureOf(c).visible = c === player.char

  for (const chair of chairs) {
    chair.x = chair.home.x
    chair.z = chair.home.z
    chair.mesh.position.set(chair.x, 0, chair.z)
  }

  syncObjects()
  total = counts[level - 1] ?? 0
  report({ action: 'start', char: player.char.id }, onSaved, onSaveFailed)

  dom.mission.textContent = t('NIVEL {n} · ROBA {total} {things}', { n: level, total, things: thingsOf(level).toUpperCase() })
  dom.stars.textContent = starsText()
  dom.abilityName.textContent = t(player.char.ability.name)
  dom.menu.classList.add('hidden')
  dom.banner.classList.replace('flex', 'hidden')
  dom.hud.classList.remove('hidden')
  ring.visible = true
  phase = 'playing'
}

/** `captured`: lo vio un vigilante. Suma una estrella; a la quinta se pierde un nivel. */
function bust(reason: string, captured: boolean): void {
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
  const photo = mugshotHtml(player.char, progress.captures)
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

function useAbility(): void {
  const { effect, cooldown: wait } = player.char.ability
  if (!effect || cooldown > 0 || phase !== 'playing') return
  cooldown = wait ?? 0
  sfx.ability()
  const near = (radius: number): Npc[] =>
    npcs.filter((n) => Math.hypot(n.x - player.x, n.z - player.z) <= radius)
  switch (effect.kind) {
    case 'lure': {
      const at = effect.at === 'self' ? { x: player.x, z: player.z } : CONFERENCE
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
      cloakT = effect.seconds
      break
    case 'dash':
      dashT = effect.seconds
      dashK = effect.factor
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
dom.abilityBox.addEventListener('click', () => useAbility())
dom.menuBtn.addEventListener('click', () => showMenu())
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
/** Botones del celular ahora y en el cuadro anterior: ability, ok y back actúan al pulsar, grab mientras se mantiene. */
let padHeld = 0
let padWas = 0

function padStatus(status: RemoteStatus): void {
  const text: Record<RemoteStatus, string> = {
    connecting: t('Preparando el mando…'),
    ready: t('Escanea con tu celular para controlar'),
    paired: t('Celular conectado ✓'),
    offline: t('Mando por celular no disponible'),
  }
  for (const box of Object.values(padBoxes)) {
    const label = box.querySelector('.padText')
    if (label) label.textContent = text[status]
    for (const part of box.querySelectorAll('.padQr, .padCode')) part.classList.toggle('hidden', status === 'paired')
  }
}

if (TV) {
  remote = new Remote(padStatus, enterWithToy)
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
  const focused = document.activeElement
  if (phase === 'menu' && dom.poster.classList.contains('hidden') && focused instanceof HTMLElement) focused.click()
  else confirm()
}

function pollPad(): void {
  padHeld = remote?.source()?.buttons ?? 0
  const pressed = padHeld & ~padWas
  padWas = padHeld
  if (pressed & PAD_BUTTON.ability) useAbility()
  if (pressed & PAD_BUTTON.back) window.tvBack?.()
  if (pressed & PAD_BUTTON.ok) padOk()
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
  if (ABILITY_KEYS.has(id) || ABILITY_KEYS.has(e.key)) useAbility()
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

function update(dt: number): void {
  clock += dt
  timeLeft -= dt
  cooldown = Math.max(0, cooldown - dt)
  cloakT = Math.max(0, cloakT - dt)
  dashT = Math.max(0, dashT - dt)

  let target: Item | undefined
  let best = REACH
  for (const item of items) {
    const d = Math.hypot(item.x - player.x, item.z - player.z)
    if (d <= best) {
      best = d
      target = item
    }
    item.marker.rotateY(dt * 3)
  }
  const grabbing = target !== undefined && (keys.has('KeyE') || (TV && keys.has('Enter')) || (padHeld & PAD_BUTTON.grab) !== 0)
  if (grabbing !== stealing) setStealing(grabbing)

  // Pantalla: derecha = (1, -1), arriba = (-1, -1) sobre XZ.
  const pad = remote?.source()
  const ix = held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft') + stick.x + (pad?.x ?? 0)
  const iy = held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown') + stick.y + (pad?.y ?? 0)
  const mx = ix - iy
  const mz = -ix - iy
  const moving = !grabbing && (mx !== 0 || mz !== 0)
  if (moving) {
    const len = Math.hypot(mx, mz)
    const speed = BASE_SPEED * (player.char.speed ?? 1) * (dashT > 0 ? dashK : 1)
    let next = resolveCircle(player.x + (mx / len) * speed * dt, player.z + (mz / len) * speed * dt, PLAYER_R, SOLID)
    for (const n of npcs) {
      const dx = next.x - n.x
      const dz = next.z - n.z
      const d = Math.hypot(dx, dz)
      if (d > 1e-6 && d < 0.6) next = { x: n.x + (dx / d) * 0.6, z: n.z + (dz / d) * 0.6 }
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
    player.x = next.x
    player.z = next.z
    player.dir = turnToward(player.dir, Math.atan2(mz, mx), 14 * dt)
  } else if (target) {
    player.dir = turnToward(player.dir, Math.atan2(target.z - player.z, target.x - player.x), 14 * dt)
  }

  const fig = figureOf(player.char)
  place(fig, player.x, player.z, player.dir, moving ? clock * 11 : undefined)
  fig.visible = cloakT <= 0 || Math.floor(clock * 12) % 2 === 0
  ring.position.set(player.x, 0.05, player.z)
  ring.material.color.set(cloakT > 0 ? 0x4dd2ff : 0x39ff88)

  let caughtBy: Npc | undefined
  let spotted = false
  for (const n of npcs) {
    updateNpc(n, dt)
    const range = cfg.range * (player.char.visibility ?? 1) * (n.blindT > 0 ? n.blindK : 1)
    updateCone(n, range)
    const sees = cloakT <= 0 && canSee({ x: n.x, z: n.z, dir: n.dir, range, halfAngle: cfg.halfAngle }, player, SIGHT)
    n.seenT = sees && grabbing ? n.seenT + dt : 0
    if (sees) spotted = true
    n.cone.material.color.set(sees ? (grabbing ? CONE.alert : CONE.inside) : CONE.idle)
    if (n.seenT > (player.char.grace ?? 0)) caughtBy ??= n
  }

  sweat.visible = spotted
  sweat.position.set(player.x, 2 + Math.sin(clock * 12) * 0.05, player.z)

  grab = grabbing ? grab + dt / (BASE_GRAB * (player.char.grabTime ?? 1)) : 0
  if (caughtBy) return bust(t('¡{name} te vio robando!', { name: caughtBy.char.name }), true)
  if (target && grab >= 1) {
    const next = steal(progress, target.index, counts)
    if (!next) throw new Error(`Robo inválido: nivel ${progress.level}, objeto ${target.index}`)
    const passed = next.level !== progress.level
    progress = next
    report({ action: 'steal', index: target.index }, onSaved, onSaveFailed)
    vanishing.set(target, 0)
    target.marker.visible = false
    items = items.filter((i) => i !== target)
    grab = 0
    sfx.pick()
    if (passed) return win()
  }
  if (timeLeft <= 0) return bust(t('Se acabó el tiempo'), false)

  dom.prompt.textContent = target ? pick('MANTÉN ROBAR', 'MANTÉN OK PARA ROBAR', 'MANTÉN E PARA ROBAR') : ''
  dom.grab.value = Math.min(grab, 1)
  dom.grab.classList.toggle('invisible', !grabbing)
}

function drawHud(): void {
  dom.count.textContent = `${total - items.length} / ${total}`
    const secs = Math.max(0, Math.ceil(timeLeft))
  dom.timer.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  dom.timer.classList.toggle('text-red-500', timeLeft <= 10)
  const { effect } = player.char.ability
  dom.abilityState.textContent = !effect ? t('PASIVA') : cooldown > 99 ? t('USADA') : cooldown > 0 ? `${Math.ceil(cooldown)} s` : pick('TOCA · LISTA', 'PLAY · LISTA', 'Q · LISTA')

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
  dot(player, '#39ff88', 4)
}

syncObjects()
if (!connecting) renderMenu()

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  pollPad()
  if (phase !== 'playing') sweat.visible = false
  if (phase === 'playing') {
    update(dt)
    drawHud()
    lookAt(player.x, player.z)
  } else if (phase === 'menu') {
    lookAt(MAP.w / 2, MAP.d / 2)
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
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
