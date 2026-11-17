// Página del celular-mando: se abre desde el QR del televisor y envía palanca y botones.
import { Peer, type DataConnection } from 'peerjs'
import './style.css'
import { t } from './i18n.ts'
import { PAD_BUTTON, peerId } from './padState.ts'

const SEND_EVERY_MS = 100 // además de enviar al cambiar: si se pierde un mensaje, el siguiente lo corrige
const STICK_TRAVEL = 56
const STICK_DEAD = 12

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Falta ${selector} en el mando`)
  return found
}

const button = (id: string, label: string, style: string): string =>
  `<button id="${id}" class="ink touch-none rounded-full border-4 border-black ${style}">${label}</button>`

el<HTMLDivElement>('#pad').innerHTML = `
  <div class="flex h-full flex-col justify-between p-4 pb-8">
    <div class="ink flex items-center justify-between gap-2">
      <span class="text-xl text-yellow-300">NINE TO <span class="text-emerald-400">THIEF</span></span>
      <span id="status" class="font-sans text-sm text-neutral-300"></span>
    </div>
    <form id="join" hidden class="flex items-center justify-center gap-2">
      <input id="code" maxlength="5" autocomplete="off" autocapitalize="characters" aria-label="${t('Código del juego')}" class="w-32 rounded-lg border-2 border-neutral-600 bg-neutral-900 px-3 py-2 text-center font-sans text-xl tracking-widest text-white uppercase" />
      <button class="cursor-pointer rounded-lg bg-yellow-300 px-4 py-2 text-xl text-black">${t('CONECTAR')}</button>
    </form>
    <div class="flex items-end justify-between gap-3">
      <div id="stick" class="flex size-40 shrink-0 touch-none items-center justify-center rounded-full border-4 border-white/50 bg-white/10">
        <div id="knob" class="size-20 rounded-full bg-white/70"></div>
      </div>
      <div class="flex flex-col items-end gap-3">
        <div class="flex gap-3">
          ${button('back', t('MENÚ'), 'bg-neutral-700 px-4 py-2 text-base')}
          ${button('ok', 'OK', 'bg-emerald-500 px-6 py-2 text-base')}
        </div>
        ${button('grab', t('ROBAR'), 'size-32 bg-yellow-400 text-2xl')}
        ${button('ability', t('HABILIDAD'), 'h-14 w-36 bg-sky-400 text-lg')}
      </div>
    </div>
  </div>`

const status = el<HTMLSpanElement>('#status')
const form = el<HTMLFormElement>('#join')
const codeInput = el<HTMLInputElement>('#code')
const stickEl = el<HTMLDivElement>('#stick')
const knob = el<HTMLDivElement>('#knob')

let conn: DataConnection | undefined
let x = 0
let y = 0
let buttons = 0

const send = (): void => {
  if (conn?.open) conn.send([Math.round(x * 100) / 100, Math.round(y * 100) / 100, buttons])
}

// Palanca
function moveStick(e: PointerEvent): void {
  const r = stickEl.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  const len = Math.hypot(dx, dy)
  const k = len > STICK_TRAVEL ? STICK_TRAVEL / len : 1
  knob.style.translate = `${dx * k}px ${dy * k}px`
  x = len < STICK_DEAD ? 0 : dx / len
  y = len < STICK_DEAD ? 0 : -dy / len
  send()
}
function releaseStick(): void {
  x = 0
  y = 0
  knob.style.translate = ''
  send()
}
stickEl.addEventListener('pointerdown', (e) => {
  stickEl.setPointerCapture(e.pointerId)
  moveStick(e)
})
stickEl.addEventListener('pointermove', (e) => {
  if (stickEl.hasPointerCapture(e.pointerId)) moveStick(e)
})
stickEl.addEventListener('pointerup', releaseStick)
stickEl.addEventListener('pointercancel', releaseStick)

// Botones: mantener pulsado = bit activo
function hold(id: string, bit: number): void {
  const node = el<HTMLButtonElement>(`#${id}`)
  const set = (on: boolean): void => {
    buttons = on ? buttons | bit : buttons & ~bit
    if (on) navigator.vibrate?.(12)
    send()
  }
  node.addEventListener('pointerdown', () => set(true))
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) node.addEventListener(type, () => set(false))
}
hold('grab', PAD_BUTTON.grab)
hold('ability', PAD_BUTTON.ability)
hold('ok', PAD_BUTTON.ok)
hold('back', PAD_BUTTON.back)

// iOS ignora user-scalable=no: se cancelan el pellizco y los gestos de zoom.
addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('contextmenu', (e) => e.preventDefault())

// Conexión
function connect(code: string): void {
  status.textContent = t('Conectando con {code}…', { code })
  form.hidden = true
  const peer = new Peer()
  const fail = (text: string): void => {
    status.textContent = text
    form.hidden = false
    peer.destroy()
  }
  peer.on('error', (err) => fail(err.type === 'peer-unavailable'
    ? t('No hay ningún juego con el código {code}', { code })
    : t('Sin conexión ({type})', { type: err.type })))
  peer.on('open', () => {
    const c = peer.connect(peerId(code), { serialization: 'json' })
    c.on('open', () => {
      conn = c
      status.textContent = t('Conectado ✓')
      send()
    })
    c.on('close', () => {
      conn = undefined
      fail(t('Conexión perdida'))
    })
  })
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const code = codeInput.value.trim().toUpperCase()
  if (/^[A-Z0-9]{5}$/.test(code)) connect(code)
  else status.textContent = t('El código tiene 5 letras o números')
})

const fromUrl = new URLSearchParams(location.search).get('c')?.toUpperCase() ?? ''
if (/^[A-Z0-9]{5}$/.test(fromUrl)) connect(fromUrl)
else {
  status.textContent = t('Escribe el código que muestra la tele')
  form.hidden = false
}

setInterval(send, SEND_EVERY_MS)
// Mantener la pantalla encendida mientras se juega (no disponible en todos los navegadores).
navigator.wakeLock?.request('screen').catch((err: unknown) => console.warn('Sin wake lock:', err))
