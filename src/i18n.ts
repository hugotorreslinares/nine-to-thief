// Idiomas. El español es el texto fuente: `t(texto)` lo devuelve tal cual o su traducción.
// logic.check.ts falla si algún texto usado con t() no tiene traducción aquí.

export type Lang = 'es' | 'en'

const KEY = 'office-theft-lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // Sin localStorage (modo privado estricto, pruebas): se decide por el navegador.
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const lang: Lang = detect()

/** Guarda el idioma y recarga: los textos se pintan una sola vez al arrancar. */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next)
  } catch (err) {
    console.warn('No se pudo guardar el idioma', err)
  }
  location.reload()
}

export const EN: Readonly<Record<string, string>> = {
  // interfaz
  'MENÚ': 'MENU',
  'ROBAR': 'STEAL',
  'COMPARTIR': 'SHARE',
  'Elige a tu ladrón. Roba sin que te vean mientras lo coges. Un minuto por nivel.': 'Pick your thief. Steal without being seen while you grab it. One minute per level.',
  'ART TOY NUEVO': 'NEW ART TOY',
  'Regístralo una sola vez. Después basta con acercarlo para seguir tu partida.': 'Register it just once. After that, tap it to pick up where you left off.',
  'Tu nombre': 'Your name',
  'Tu correo': 'Your email',
  'EMPEZAR A ROBAR': 'START STEALING',
  'Tu apodo para el tablón': 'Nickname for the leaderboard',
  '🏆 TABLÓN': '🏆 LEADERBOARD',
  'CERRAR': 'CLOSE',
  '＋ AÑADIR A PANTALLA DE INICIO': '＋ ADD TO HOME SCREEN',
  'Añadir a pantalla de inicio': 'Add to Home Screen',
  'Toca el botón <b>Compartir</b> del navegador (cuadro con flecha hacia arriba).': 'Tap the browser <b>Share</b> button (square with an up arrow).',
  'Elige <b>Añadir a pantalla de inicio</b>.': 'Choose <b>Add to Home Screen</b>.',
  'Abre el juego desde el icono nuevo: pantalla completa y sin zoom.': 'Open the game from the new icon: full screen, no zoom.',
  'LISTO': 'DONE',
  'Palanca: moverse · mantén ROBAR · toca la habilidad para usarla': 'Stick: move · hold STEAL · tap the ability to use it',
  'WASD / flechas: moverse · mantén E: robar · Q: habilidad · Esc: menú': 'WASD / arrows: move · hold E: steal · Q: ability · Esc: menu',
  'Creado por @mrmonomalo': 'Created by @mrmonomalo',
  'Un juego y una colección de art toys. Sígueme en Instagram para ver los próximos personajes.': 'A game and a collection of art toys. Follow me on Instagram to see the next characters.',
  'Código abierto en': 'Open source on',
  'Proyecto de fans sin ánimo de lucro, no afiliado a la serie ni a sus dueños.': 'Non-profit fan project, not affiliated with the show or its owners.',
  'ENTER O TOCA PARA EMPEZAR': 'PRESS ENTER OR TAP TO START',
  // cuenta y art toy
  'OFICINA VACÍA': 'OFFICE EMPTIED',
  'NIVEL {n}': 'LEVEL {n}',
  'DEMO: solo el nivel 1. Acerca tu art toy para jugar los 10 niveles.': 'DEMO: level 1 only. Tap your art toy to play all 10 levels.',
  'Sin conexión: este progreso no se guardó': 'Offline: this progress was not saved',
  'Sesión terminada. Acerca tu art toy para continuar.': 'Session ended. Tap your art toy to continue.',
  'Conectando tu art toy…': 'Connecting your art toy…',
  'Art toy nuevo: regístralo para empezar': 'New art toy: register it to start',
  'Etiqueta no reconocida: juegas la demo': 'Tag not recognized: you are playing the demo',
  'No se pudo conectar: juegas la demo': 'Could not connect: you are playing the demo',
  'No se pudo registrar': 'Could not register',
  'Revisa tu nombre y tu correo': 'Check your name and email',
  // lista de espera
  '🔔 QUIERO MI ART TOY': '🔔 I WANT MY ART TOY',
  'LISTA DE ESPERA': 'WAITLIST',
  'Cada art toy es la llave de una partida completa de 10 niveles. Déjanos tu correo y te avisamos cuando salgan.': 'Each art toy is the key to a full 10-level game. Leave your email and we will let you know when they drop.',
  'AVÍSENME': 'NOTIFY ME',
  '✓ Listo. Te avisaremos cuando salgan.': '✓ Done. We will let you know when they drop.',
  'Revisa tu correo': 'Check your email address',
  'No se pudo guardar. Inténtalo de nuevo.': 'Could not save. Please try again.',
  // tablón
  'Usa 1 a 12 letras, números, espacios, - o _': 'Use 1 to 12 letters, numbers, spaces, - or _',
  'Comprobando…': 'Checking…',
  '✓ Apodo reservado para ti': '✓ Nickname reserved for you',
  '✗ Ese apodo ya es de otro jugador. Elige otro.': '✗ That nickname belongs to another player. Pick another.',
  'No se pudo comprobar el apodo': 'Could not check the nickname',
  'Cargando…': 'Loading…',
  '{i}. {name} — nivel {level}': '{i}. {name} — level {level}',
  'Tú ({name}): puesto #{rank}, nivel {level}': 'You ({name}): rank #{rank}, level {level}',
  'Nadie todavía. ¡Sé el primero!': 'Nobody yet. Be the first!',
  'Tablón no disponible ahora': 'Leaderboard unavailable right now',
  'Pon un apodo en el menú para entrar al tablón': 'Set a nickname in the menu to join the leaderboard',
  'Puesto #{place} en el tablón': 'Rank #{place} on the leaderboard',
  'Tu apodo es de otro jugador: cámbialo en el menú': 'Your nickname belongs to another player: change it in the menu',
  // compartir y retos
  'Llegué al nivel {level} en Threat Level: Theft. ¿Me superas?': 'I reached level {level} in Threat Level: Theft. Can you beat me?',
  'Llegué al nivel {level} y voy #{rank} en Threat Level: Theft. ¿Me superas?': 'I reached level {level} and I am #{rank} in Threat Level: Theft. Can you beat me?',
  'Me ficharon robando {things} en Threat Level: Theft. ¿Duras más que yo?': 'I got booked stealing {things} in Threat Level: Theft. Can you last longer?',
  '¡COPIADO!': 'COPIED!',
  '¡IMAGEN GUARDADA!': 'IMAGE SAVED!',
  '¿ME SUPERAS?': 'CAN YOU BEAT ME?',
  'RETO: supera el nivel {level} con más de {s} s de sobra': 'CHALLENGE: clear level {level} with more than {s} s to spare',
  '¡Reto superado!': 'Challenge beaten!',
  // partida
  'NIVEL {n} · ROBA {total} {things}': 'LEVEL {n} · STEAL {total} {things}',
  '¡{name} te vio robando!': '{name} saw you stealing!',
  'Se acabó el tiempo': 'Time is up',
  '{reason} Te atraparon {max} veces: pierdes un nivel y vuelves al {level}.': '{reason} Caught {max} times: you lose a level and go back to {level}.',
  '{reason} Te atraparon {max} veces: tus robos del nivel 1 vuelven a su sitio.': '{reason} Caught {max} times: your level 1 loot goes back to its place.',
  '{reason} Capturas: {stars}': '{reason} Captures: {stars}',
  'Toca para reintentar': 'Tap to retry',
  'ENTER: reintentar · ESC: cambiar de personaje': 'ENTER: retry · ESC: change character',
  'Toca para seguir': 'Tap to continue',
  'ENTER: siguiente nivel': 'ENTER: next level',
  'Toca para volver al menú': 'Tap to go back to the menu',
  'ENTER: volver al menú': 'ENTER: back to the menu',
  'Nivel {level} superado con {s} s de sobra': 'Level {level} cleared with {s} s to spare',
  '¡OFICINA VACÍA!': 'OFFICE EMPTIED!',
  'Te lo robaste todo. No queda nada.': 'You stole everything. Nothing is left.',
  'DEMO SUPERADA': 'DEMO CLEARED',
  'Acerca tu art toy para jugar los 10 niveles y guardar tu partida.': 'Tap your art toy to play all 10 levels and save your game.',
  'MANTÉN ROBAR': 'HOLD STEAL',
  'MANTÉN E PARA ROBAR': 'HOLD E TO STEAL',
  'PASIVA': 'PASSIVE',
  'USADA': 'USED',
  'TOCA · LISTA': 'TAP · READY',
  'Q · LISTA': 'Q · READY',
  // foto de fichaje
  'DEPTO. DE POLICÍA · ROBO DE OFICINA': 'POLICE DEPT. · OFFICE THEFT',
  'CAPTURA N.º {n}': 'BOOKING NO. {n}',
  // objetos de cada nivel (src/levels.ts)
  'cosedoras': 'staplers',
  'lápices': 'pencils',
  'cuadernos': 'notebooks',
  'tazas de café': 'coffee mugs',
  'mouse': 'mice',
  'teclados': 'keyboards',
  'audífonos': 'headphones',
  'calculadoras': 'calculators',
  'adornos': 'picture frames',
  'trofeos': 'trophies',
  // habilidades (src/data.ts)
  '¡Reunión!': 'Conference room!',
  'Todos miran hacia la sala de reuniones 4 s.': 'Everyone looks toward the conference room for 4 s.',
  'Poder de remolacha': 'Beet power',
  'Corre 80 % más rápido durante 3 s.': 'Runs 80% faster for 3 s.',
  'Mirada a cámara': 'Look at the camera',
  'Congela a los que están cerca 3,5 s.': 'Freezes everyone nearby for 3.5 s.',
  'Manos de recepcionista': 'Receptionist hands',
  'Pasiva: roba 40 % más rápido.': 'Passive: steals 40% faster.',
  'WUPHF': 'WUPHF',
  'Toda la oficina mira el celular: ven la mitad 3,5 s.': 'The whole office checks their phones: they see half as far for 3.5 s.',
  'Chisme': 'Gossip',
  'Los cercanos miran donde soltó el chisme 4 s.': 'Those nearby look where the gossip dropped for 4 s.',
  'Nadie mira a Toby': 'Nobody looks at Toby',
  'Pasiva: tardan 0,7 s en notar que roba.': 'Passive: it takes them 0.7 s to notice the theft.',
  'Bajo perfil': 'Low profile',
  'Pasiva: la ven 25 % menos lejos.': 'Passive: seen from 25% less distance.',
  'En realidad…': 'Actually…',
  'Una vez por nivel: +10 s de tiempo.': 'Once per level: +10 s on the clock.',
  'Chili derramado': 'Spilled chili',
  'Los cercanos miran el piso: ven 60 % menos 5 s. Es lento.': 'Those nearby stare at the floor: they see 60% less for 5 s. He is slow.',
  '¿Acaso tartamudeé?': 'Did I stutter?',
  'Congela a toda la oficina 2 s.': 'Freezes the whole office for 2 s.',
  'Inofensiva': 'Harmless',
  'Pasiva: la ven 15 % menos lejos y roba 20 % más rápido.': 'Passive: seen from 15% less distance and steals 20% faster.',
  '¿Quién es Creed?': 'Who is Creed?',
  'Invisible para todos durante 3 s.': 'Invisible to everyone for 3 s.',
  'Happy hour': 'Happy hour',
  'Corre 45 % más rápido durante 5 s.': 'Runs 45% faster for 5 s.',
  'Serenata a capela': 'A cappella serenade',
  'Los cercanos miran donde cantó 3 s. Recarga corta.': 'Those nearby look where he sang for 3 s. Short cooldown.',
  'Paso de bodega': 'Warehouse pace',
  'Pasiva: 15 % más rápido y roba 15 % más rápido.': 'Passive: 15% faster and steals 15% faster.',
}

/** Texto en el idioma activo; `{clave}` se sustituye por `vars.clave`. */
export function t(es: string, vars: Readonly<Record<string, string | number>> = {}): string {
  const text = lang === 'en' ? EN[es] ?? es : es
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}
