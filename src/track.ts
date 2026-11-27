// Eventos personalizados de Vercel Analytics: dónde toca la gente en el menú y en los diálogos.
// Un solo listener delegado: añadir un botón al seguimiento es añadir su id aquí.

declare global {
  interface Window {
    va?: (command: 'event', payload: { name: string; data?: Record<string, string | number> }) => void
  }
}

/** id del botón → nombre del evento. Los controles de partida (lanzar, zoom, robar) no se registran. */
const EVENTS: Readonly<Record<string, string>> = {
  supportBtn: 'support_click',
  preorderBtn: 'preorder_menu_click',
  preorderBannerBtn: 'preorder_banner_click',
  preorderGo: 'preorder_checkout_click',
  waitBtn: 'waitlist_menu_click',
  waitBannerBtn: 'waitlist_banner_click',
  waitSend: 'waitlist_submit',
  fbBtn: 'feedback_open',
  fbSend: 'feedback_submit',
  muteBtn: 'mute_toggle',
  langBtn: 'language_toggle',
  signupBtn: 'signup_click',
  tvLinkBtn: 'tv_link_click',
  boardBtn: 'leaderboard_click',
  installBtn: 'install_click',
  shareBtn: 'share_click',
  menuBtn: 'back_to_menu_click',
}

const SOURCE_KEY = 'n2t_src'

/** Origen de la visita: `?utm_source=`, `?ref=` o el dominio de referencia. Se fija en la primera página y dura la pestaña. */
function visitSource(): string {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY)
    if (saved) return saved
    const params = new URLSearchParams(location.search)
    const referrer = document.referrer ? new URL(document.referrer).hostname : ''
    const source = (params.get('utm_source') ?? params.get('ref') ?? referrer ?? '').slice(0, 40) || 'direct'
    sessionStorage.setItem(SOURCE_KEY, source)
    return source
  } catch {
    return 'direct'
  }
}

const source = visitSource()

/** Evento con su origen, para saber qué canal trae jugadores que de verdad juegan. */
export function track(name: string, data: Readonly<Record<string, string | number>> = {}): void {
  window.va?.('event', { name, data: { ...data, src: source } })
  if (name === 'level_start') countPlayer()
}

const ID_KEY = 'n2t_id'

/** Cuenta al jugador (id anónimo del navegador) en el servidor; falla en silencio, es solo estadística. */
function countPlayer(): void {
  try {
    const id = localStorage.getItem(ID_KEY) ?? crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
    void fetch('/api/stats', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, src: source }) }).catch(() => undefined)
  } catch {
    // sin localStorage no hay id estable: no se cuenta
  }
}

document.addEventListener(
  'click',
  (event) => {
    const target = event.target instanceof Element ? event.target.closest('[id]') : null
    const name = target ? EVENTS[target.id] : undefined
    if (name) track(name)
  },
  true,
)
