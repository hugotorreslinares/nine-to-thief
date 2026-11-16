import * as THREE from 'three'
import './style.css'
import {
  CHAIRS, CHAIR_R, CHARACTERS, CONFERENCE, FURNITURE, LEVEL_SECONDS, MAP, PATROL_ORDER, ROOMS, ROUTES, SPAWN, SPOTS, WALLS,
  levelConfig, type Character, type LevelConfig,
} from './data.ts'
import { buildFigure, swingLimbs } from './figure.ts'
import { posterHtml } from './poster.ts'
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
const TOUCH = matchMedia('(pointer: coarse)').matches
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.shadowMap.enabled = true

const figures = new Map(CHARACTERS.map((c) => [c.id, buildFigure(c.look)]))
const figureOf = (c: Character): THREE.Group => {
  const fig = figures.get(c.id)
  if (!fig) throw new Error(`Sin figura para ${c.id}`)
  return fig
}

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
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
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
  const mesh = new THREE.Mesh(UNIT_BOX, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
  mesh.scale.set(b.maxX - b.minX, h, b.maxZ - b.minZ)
  mesh.position.set((b.minX + b.maxX) / 2, y + h / 2, (b.minZ + b.maxZ) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

for (const room of ROOMS) addBox(room.box, 0.02, room.color, -0.02).castShadow = false
for (const wall of WALLS) addBox(wall, WALL_H, 0xe8e4da)
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)

function addDetail(geo: THREE.BufferGeometry, color: number, size: readonly [number, number, number], at: readonly [number, number, number]): void {
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }))
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
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7 })
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

interface Item extends Pt {
  readonly mesh: THREE.Group
}

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

const allNpcs: readonly Npc[] = CHARACTERS.map((char, i) => {
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
for (const n of allNpcs) place(n.fig, n.x, n.z, n.dir)

const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.55, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.9, depthWrite: false }),
)
ring.visible = false
scene.add(ring)

type Phase = 'menu' | 'playing' | 'won' | 'busted'

let phase: Phase = 'menu'
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
      <button id="menuBtn" class="pointer-events-auto cursor-pointer rounded border-2 border-black bg-neutral-800/80 px-3 py-1 text-sm">MENÚ</button>
    </div>
    <canvas id="radar" width="192" height="132" class="absolute bottom-16 left-10 rotate-45 rounded border-2 border-black bg-black/60 pointer-coarse:top-24 pointer-coarse:bottom-auto pointer-coarse:left-0 pointer-coarse:scale-50"></canvas>
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
      <button id="grabBtn" class="ink pointer-events-auto absolute right-6 bottom-6 size-24 touch-none rounded-full border-4 border-black bg-yellow-400/90 text-xl">ROBAR</button>
    </div>
  </div>
  <div id="banner" class="ink pointer-events-auto absolute inset-0 hidden p-4 flex-col items-center justify-center gap-3 bg-black/50 text-center">
    <div id="bannerTitle" class="text-8xl"></div>
    <div id="bannerText" class="text-xl md:text-3xl"></div>
    <div id="bannerRank" class="text-xl text-emerald-400 md:text-2xl"></div>
    <button id="shareBtn" class="hidden cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-5 py-2 text-xl">COMPARTIR</button>
    <div id="bannerHint" class="text-base text-neutral-300 md:text-xl"></div>
  </div>
  <div id="poster" class="pointer-events-auto absolute inset-0 z-10 grid cursor-pointer grid-cols-6 grid-rows-3 gap-1 bg-black p-1 md:gap-2 md:p-2 portrait:grid-cols-3 portrait:grid-rows-6">${posterHtml()}</div>
  <div id="menu" class="pointer-events-auto absolute inset-0 flex flex-col items-center gap-4 overflow-y-auto bg-black/75 p-3 md:p-6">
    <h1 class="ink text-center text-4xl text-yellow-300 md:text-7xl">THE OFFICE <span class="text-emerald-400">THEFT</span></h1>
    <p class="ink text-center text-base text-neutral-200 md:text-xl">Elige a tu ladrón. Roba sin que te vean mientras lo coges. Un minuto por nivel.</p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <input id="nick" maxlength="12" autocomplete="nickname" placeholder="Tu apodo para el tablón" class="rounded-lg border-2 border-neutral-600 bg-neutral-900 px-3 py-2 font-sans text-base text-white select-text" />
      <button id="boardBtn" class="ink cursor-pointer rounded-lg border-2 border-black bg-yellow-400 px-4 py-2 text-lg">🏆 TABLÓN</button>
    </div>
    <p id="nickStatus" class="min-h-5 font-sans text-sm text-neutral-300"></p>
    <dialog id="board" class="pointer-events-auto m-auto w-full max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 text-white backdrop:bg-black/70">
      <p class="mb-3 text-3xl text-yellow-300">TOP 10</p>
      <ol id="boardList" class="space-y-1 font-sans text-base"></ol>
      <p id="boardMe" class="mt-3 text-lg text-emerald-400"></p>
      <form method="dialog" class="mt-4 text-right">
        <button class="cursor-pointer rounded bg-yellow-300 px-4 py-1 text-lg text-black">CERRAR</button>
      </form>
    </dialog>
    <button id="installBtn" class="ink hidden cursor-pointer rounded-lg border-2 border-black bg-emerald-500 px-4 py-2 text-lg">＋ AÑADIR A PANTALLA DE INICIO</button>
    <dialog id="installHelp" class="pointer-events-auto m-auto max-w-sm rounded-xl border-2 border-yellow-300 bg-neutral-900 p-5 font-sans text-white backdrop:bg-black/70">
      <p class="font-gta mb-3 text-2xl text-yellow-300">Añadir a pantalla de inicio</p>
      <ol class="list-decimal space-y-2 pl-5 text-base">
        <li>Toca el botón <b>Compartir</b> del navegador (cuadro con flecha hacia arriba).</li>
        <li>Elige <b>Añadir a pantalla de inicio</b>.</li>
        <li>Abre el juego desde el icono nuevo: pantalla completa y sin zoom.</li>
      </ol>
      <form method="dialog" class="mt-4 text-right">
        <button class="font-gta cursor-pointer rounded bg-yellow-300 px-4 py-1 text-lg text-black">LISTO</button>
      </form>
    </dialog>
    <div id="roster" class="grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4"></div>
    <p class="ink text-center text-base text-neutral-300 md:text-lg">${TOUCH ? 'Palanca: moverse · mantén ROBAR · toca la habilidad para usarla' : 'WASD / flechas: moverse · mantén E: robar · Q: habilidad · Esc: menú'}</p>
    <footer class="pb-4 font-sans text-sm text-neutral-400">
      Código abierto en <a href="https://github.com/hugotorreslinares/the-office-theft" target="_blank" rel="noopener noreferrer" class="text-sky-300 underline hover:text-sky-200">GitHub</a>
    </footer>
  </div>`

const dom = {
  hud: el<HTMLDivElement>('#hud'),
  menu: el<HTMLDivElement>('#menu'),
  installBtn: el<HTMLButtonElement>('#installBtn'),
  installHelp: el<HTMLDialogElement>('#installHelp'),
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

// Datos estáticos propios: no hay entrada de usuario en este HTML.
dom.roster.innerHTML = CHARACTERS.map((c) => `
  <button data-id="${c.id}" class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-neutral-700 bg-neutral-900/90 p-2 text-left hover:border-yellow-300 hover:bg-neutral-800">
    <img src="${portraits.get(c.id) ?? ''}" alt="${c.name}" class="size-16 shrink-0 md:size-20" />
    <span class="flex flex-col">
      <span class="text-2xl text-yellow-300">${c.name}</span>
      <span class="text-base text-sky-300">${c.ability.name}</span>
      <span class="font-sans text-xs text-neutral-300">${c.ability.text}</span>
    </span>
  </button>`).join('')

dom.roster.addEventListener('click', (e) => {
  const button = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[data-id]') : null
  const chosen = CHARACTERS.find((c) => c.id === button?.dataset.id)
  if (!chosen) return
  audio ??= new AudioContext()
  player.char = chosen
  startLevel(1)
})

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
  if (!name) return setNickStatus('Usa 1 a 12 letras, números, espacios, - o _', 'text-red-400')
  setNickStatus('Comprobando…', 'text-neutral-300')
  claimNick(name).then(() => {
    if (dom.nick.value === typed) setNickStatus('✓ Apodo reservado para ti', 'text-emerald-400')
  }).catch((err: unknown) => {
    if (dom.nick.value !== typed) return
    if (isTaken(err)) return setNickStatus('✗ Ese apodo ya es de otro jugador. Elige otro.', 'text-red-400')
    console.error(err)
    setNickStatus('No se pudo comprobar el apodo', 'text-neutral-300')
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
  dom.boardMe.textContent = 'Cargando…'
  dom.board.showModal()
  fetchBoard(nick).then(({ top, me }) => {
    // textContent: los apodos vienen de otros jugadores.
    dom.boardList.replaceChildren(...top.map((row, i) => {
      const li = document.createElement('li')
      li.textContent = `${i + 1}. ${row.name} — nivel ${row.level}`
      return li
    }))
    dom.boardMe.textContent = me ? `Tú (${me.name}): puesto #${me.rank}, nivel ${me.level}`
      : top.length === 0 ? 'Nadie todavía. ¡Sé el primero!' : ''
  }).catch((err: unknown) => {
    console.error(err)
    dom.boardMe.textContent = 'Tablón no disponible ahora'
  })
})

function reportWin(): void {
  const name = cleanNick(dom.nick.value)
  if (!name) {
    dom.bannerRank.textContent = 'Pon un apodo en el menú para entrar al tablón'
    return
  }
  submitScore({ name, level, seconds: Math.min(99, Math.max(0, Math.ceil(timeLeft))) }).then((place) => {
    rank = place
    if (place) dom.bannerRank.textContent = `Puesto #${place} en el tablón`
  }).catch((err: unknown) => {
    if (isTaken(err)) {
      dom.bannerRank.textContent = 'Tu apodo es de otro jugador: cámbialo en el menú'
      return
    }
    console.error(err)
    dom.bannerRank.textContent = 'Tablón no disponible ahora'
  })
}

dom.shareBtn.addEventListener('click', (e) => {
  e.stopPropagation() // el cartel entero avanza de nivel al tocarlo
  const text = `Llegué al nivel ${bestLevel}${rank ? ` y voy #${rank}` : ''} en The Office Theft. ¿Me superas?`
  const url = location.origin
  const done = navigator.share
    ? navigator.share({ text, url })
    : navigator.clipboard.writeText(`${text} ${url}`).then(() => { dom.shareBtn.textContent = '¡COPIADO!' })
  done.catch((err: unknown) => {
    if (!(err instanceof DOMException && err.name === 'AbortError')) console.error('No se pudo compartir', err)
  })
})

function showBanner(title: string, color: string, text: string, hint: string): void {
  dom.bannerRank.textContent = ''
  dom.shareBtn.textContent = 'COMPARTIR'
  dom.shareBtn.classList.toggle('hidden', bestLevel === 0)
  dom.bannerTitle.textContent = title
  dom.bannerTitle.className = `text-5xl md:text-8xl ${color}`
  dom.bannerText.textContent = text
  dom.bannerHint.textContent = hint
  dom.banner.classList.replace('hidden', 'flex')
}

function showMenu(): void {
  phase = 'menu'
  dom.hud.classList.add('hidden')
  dom.banner.classList.replace('flex', 'hidden')
  dom.menu.classList.remove('hidden')
}

// ---------- Niveles ----------

function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

function makeItem(x: number, y: number, z: number): Item {
  const mesh = new THREE.Group()
  const [w, h, d] = cfg.item.size
  const body = new THREE.Mesh(UNIT_BOX, new THREE.MeshStandardMaterial({ color: cfg.item.color, roughness: 0.5 }))
  body.scale.set(w, h, d)
  body.position.y = h / 2
  body.castShadow = true
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffd400 }))
  marker.position.y = 1.1
  mesh.add(body, marker)
  mesh.position.set(x, y, z)
  scene.add(mesh)
  return { x, z, mesh }
}

function startLevel(n: number): void {
  level = n
  cfg = levelConfig(n)
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

  for (const chair of chairs) {
    chair.x = chair.home.x
    chair.z = chair.home.z
    chair.mesh.position.set(chair.x, 0, chair.z)
  }

  for (const item of items) scene.remove(item.mesh)
  items = shuffled(SPOTS).slice(0, cfg.count).map((s) => makeItem(s.x, s.y, s.z))
  total = items.length

  dom.mission.textContent = `NIVEL ${n} · ROBA ${total} ${cfg.item.plural.toUpperCase()}`
  dom.stars.textContent = '★'.repeat(Math.min(n, 6)) + '☆'.repeat(Math.max(6 - n, 0))
  dom.abilityName.textContent = player.char.ability.name
  dom.menu.classList.add('hidden')
  dom.banner.classList.replace('flex', 'hidden')
  dom.hud.classList.remove('hidden')
  ring.visible = true
  phase = 'playing'
}

function bust(reason: string): void {
  phase = 'busted'
  sfx.alarm()
  showBanner('BUSTED', 'text-red-500', reason, TOUCH ? 'Toca para reintentar' : 'ENTER: reintentar · ESC: cambiar de personaje')
}

function win(): void {
  phase = 'won'
  sfx.win()
  bestLevel = Math.max(bestLevel, level)
  showBanner('MISSION PASSED!', 'text-yellow-300', `Nivel ${level} superado con ${Math.ceil(timeLeft)} s de sobra`, TOUCH ? 'Toca para seguir' : 'ENTER: siguiente nivel')
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

/** Enter o toque: avanza desde el póster o desde el cartel de fin de nivel. */
function confirm(): void {
  if (phase === 'menu') dom.poster.classList.add('hidden')
  else if (phase === 'won') startLevel(level + 1)
  else if (phase === 'busted') startLevel(level)
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
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return // escribiendo el apodo
  keys.add(e.code)
  if (e.repeat) return
  if (e.code === 'KeyQ') useAbility()
  else if (e.code === 'Enter') confirm()
  else if (e.code === 'Escape' && phase !== 'menu') showMenu()
})
addEventListener('keyup', (e) => keys.delete(e.code))
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
    item.mesh.children[1]?.rotateY(dt * 3)
  }
  const grabbing = target !== undefined && keys.has('KeyE')

  // Pantalla: derecha = (1, -1), arriba = (-1, -1) sobre XZ.
  const ix = held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft') + stick.x
  const iy = held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown') + stick.y
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
  for (const n of npcs) {
    updateNpc(n, dt)
    const range = cfg.range * (player.char.visibility ?? 1) * (n.blindT > 0 ? n.blindK : 1)
    updateCone(n, range)
    const sees = cloakT <= 0 && canSee({ x: n.x, z: n.z, dir: n.dir, range, halfAngle: cfg.halfAngle }, player, SIGHT)
    n.seenT = sees && grabbing ? n.seenT + dt : 0
    n.cone.material.color.set(sees ? (grabbing ? CONE.alert : CONE.inside) : CONE.idle)
    if (n.seenT > (player.char.grace ?? 0)) caughtBy ??= n
  }

  grab = grabbing ? grab + dt / (BASE_GRAB * (player.char.grabTime ?? 1)) : 0
  if (caughtBy) return bust(`¡${caughtBy.char.name} te vio robando!`)
  if (target && grab >= 1) {
    scene.remove(target.mesh)
    items = items.filter((i) => i !== target)
    grab = 0
    sfx.pick()
    if (items.length === 0) return win()
  }
  if (timeLeft <= 0) return bust('Se acabó el tiempo')

  dom.prompt.textContent = target ? (TOUCH ? 'MANTÉN ROBAR' : 'MANTÉN E PARA ROBAR') : ''
  dom.grab.value = Math.min(grab, 1)
  dom.grab.classList.toggle('invisible', !grabbing)
}

function drawHud(): void {
  dom.count.textContent = `${total - items.length} / ${total}`
    const secs = Math.max(0, Math.ceil(timeLeft))
  dom.timer.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  dom.timer.classList.toggle('text-red-500', timeLeft <= 10)
  const { effect } = player.char.ability
  dom.abilityState.textContent = !effect ? 'PASIVA' : cooldown > 99 ? 'USADA' : cooldown > 0 ? `${Math.ceil(cooldown)} s` : TOUCH ? 'TOCA · LISTA' : 'Q · LISTA'

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

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  if (phase === 'playing') {
    update(dt)
    drawHud()
    lookAt(player.x, player.z)
  } else if (phase === 'menu') {
    lookAt(MAP.w / 2, MAP.d / 2)
  }
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
