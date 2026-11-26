// Eventos personalizados de Vercel Analytics: dónde toca la gente en el menú y en los diálogos.
// Un solo listener delegado: añadir un botón al seguimiento es añadir su id aquí.

export {}

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

document.addEventListener(
  'click',
  (event) => {
    const target = event.target instanceof Element ? event.target.closest('[id]') : null
    const name = target ? EVENTS[target.id] : undefined
    if (name) window.va?.('event', { name })
  },
  true,
)
