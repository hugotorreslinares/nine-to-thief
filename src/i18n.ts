// Idiomas. El español es el texto fuente: `t(texto)` lo devuelve tal cual o su traducción.
// logic.check.ts falla si algún texto usado con t() no tiene traducción aquí.

export type Lang = 'es' | 'en'

const KEY = 'office-theft-lang'

function detect(): Lang {
  // Un enlace a /en pide inglés, diga lo que diga el navegador.
  if (typeof location !== 'undefined' && /^\/en(\/|$)/.test(location.pathname)) return 'en'
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
  'Flechas: moverse · mantén OK: robar · PLAY: habilidad · Atrás: menú': 'Arrows: move · hold OK: steal · PLAY: ability · Back: menu',
  'OK: reintentar · Atrás: cambiar de personaje': 'OK: retry · Back: change character',
  'OK: siguiente nivel': 'OK: next level',
  'OK: volver al menú': 'OK: back to the menu',
  'MANTÉN OK PARA ROBAR': 'HOLD OK TO STEAL',
  'PLAY · LISTA': 'PLAY · READY',
  'OK PARA EMPEZAR': 'PRESS OK TO START',
  'ROBA LA OFICINA SIN QUE TE VEAN': 'STEAL THE OFFICE WITHOUT GETTING CAUGHT',
  'Preparando el mando…': 'Getting the controller ready…',
  'Escanea con tu celular para controlar': 'Scan with your phone to play',
  'Celular conectado ✓': 'Phone connected ✓',
  'Jugador 1 conectado ✓ Otro celular puede unirse para jugar de a dos': 'Player 1 connected ✓ Another phone can join to play together',
  'Jugadores 1 y 2 conectados ✓': 'Players 1 and 2 connected ✓',
  'LISTA': 'READY',
  'Mando por celular no disponible': 'Phone controller unavailable',
  'Código del juego': 'Game code',
  'CONECTAR': 'CONNECT',
  'HABILIDAD': 'ABILITY',
  'Conectando con {code}…': 'Connecting to {code}…',
  'No hay ningún juego con el código {code}': 'No game with the code {code}',
  'Sin conexión ({type})': 'No connection ({type})',
  'Conectado ✓': 'Connected ✓',
  'Sala llena: ya hay 2 jugadores': 'Room full: there are already 2 players',
  'JUGADOR {n}': 'PLAYER {n}',
  'PARTIDA EN PAUSA': 'GAME PAUSED',
  'Jugador {n} desconectado. Esperando… {s} s': 'Player {n} disconnected. Waiting… {s} s',
  'Ese personaje ya lo eligió el jugador 2': 'Player 2 already picked that character',
  'ELEGIR PERSONAJE': 'PICK CHARACTER',
  'Elige tu personaje': 'Pick your character',
  'Tu personaje: {name}': 'Your character: {name}',
  'Aún no eliges: se te asigna uno': 'Not picked yet: one will be assigned',
  'Ocupado por el otro jugador': 'Taken by the other player',
  'Conexión perdida': 'Connection lost',
  'El código tiene 5 letras o números': 'The code has 5 letters or numbers',
  'Escribe el código que muestra la tele': 'Type the code shown on the TV',
  'Descargar para Android TV': 'Download for Android TV',
  'Volver al juego': 'Back to the game',
  'JUEGA EN TU TELEVISOR': 'PLAY ON YOUR TV',
  'Roba objetos de la oficina sin que te vean, ahora en Android TV y Google TV. Gratis.': 'Steal things from the office without getting caught, now on Android TV and Google TV. Free.',
  'DESCARGAR APK': 'DOWNLOAD APK',
  'unos 7 MB': 'about 7 MB',
  'CÓMO INSTALARLO': 'HOW TO INSTALL',
  'ANTES DE INSTALAR': 'BEFORE YOU INSTALL',
  'En tu tele abre la tienda de aplicaciones e instala la app gratuita "Downloader".': 'On your TV, open the app store and install the free "Downloader" app.',
  'En los ajustes de la tele permite que Downloader instale apps de origen desconocido (el menú cambia según la marca).': 'In your TV settings, allow Downloader to install apps from unknown sources (the menu varies by brand).',
  'Abre Downloader y escribe esta dirección con el mando:': 'Open Downloader and type this address with your remote:',
  'Descarga el archivo, pulsa Instalar y después Abrir.': 'Download the file, press Install and then Open.',
  'Para jugar con el celular como mando, escanea el código QR que sale en la pantalla de inicio.': 'To use your phone as a controller, scan the QR code on the start screen.',
  'Es un juego gratuito, sin anuncios y sin pagos dentro de la app.': 'A free game: no ads and no in-app payments.',
  'La app no está en Google Play: instálala solo desde esta página. Android avisará de que viene de un origen desconocido, es normal en las apps que no pasan por la tienda.': 'The app is not on Google Play: install it only from this page. Android will warn that it comes from an unknown source, which is normal for apps outside the store.',
  'En la tele se juega la demo (nivel 1). Para los 10 niveles, abre tu art toy en el celular, toca "Jugar en la tele" y escribe el código que muestra la tele.': 'On the TV you play the demo (level 1). For all 10 levels, open your art toy on your phone, tap "Play on the TV" and type the code shown on the TV.',
  'Probado en un televisor Hisense con Android 9. Necesita Android TV o Google TV con Android 7 o superior e internet.': 'Tested on a Hisense TV running Android 9. Needs Android TV or Google TV with Android 7 or newer, and internet.',
  'Para actualizar, desinstala la versión anterior antes de instalar la nueva.': 'To update, uninstall the previous version before installing the new one.',
  '📺 JUGAR EN LA TELE': '📺 PLAY ON THE TV',
  'Abre la app en tu tele y escribe aquí el código de 5 letras que muestra en la pantalla de inicio.': 'Open the app on your TV and type here the 5-letter code shown on its start screen.',
  'Código de la tele': 'TV code',
  'ENVIAR': 'SEND',
  'Enviando…': 'Sending…',
  'Enviado: mira la tele ✓': 'Sent: check the TV ✓',
  'No hay ninguna tele con ese código': 'No TV with that code',
  'No se pudo enviar': 'Could not send',
  'Art toy nuevo: regístralo primero en tu celular': 'New art toy: register it on your phone first',
  'DEMO: solo el nivel 1. En tu celular abre tu art toy y toca "Jugar en la tele".': 'DEMO: level 1 only. On your phone, open your art toy and tap "Play on the TV".',
  'Creado por @mrmonomalo': 'Created by @mrmonomalo',
  'Un juego y una colección de art toys. Sígueme en Instagram para ver los próximos personajes.': 'A game and a collection of art toys. Follow me on Instagram to see the next characters.',
  'Código abierto en': 'Open source on',
  'Todos los personajes y situaciones son ficticios.': 'All characters and situations are fictional.',
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
  'Llegué al nivel {level} en Nine to Thief. ¿Me superas?': 'I reached level {level} in Nine to Thief. Can you beat me?',
  'Llegué al nivel {level} y voy #{rank} en Nine to Thief. ¿Me superas?': 'I reached level {level} and I am #{rank} in Nine to Thief. Can you beat me?',
  'Me ficharon robando {things} en Nine to Thief. ¿Duras más que yo?': 'I got booked stealing {things} in Nine to Thief. Can you last longer?',
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
  '¡Junta de emergencia!': 'Emergency meeting!',
  'Todos miran hacia la sala de reuniones 4 s.': 'Everyone looks toward the conference room for 4 s.',
  'Café doble': 'Double espresso',
  'Corre 80 % más rápido durante 3 s.': 'Runs 80% faster for 3 s.',
  'Chiste malo': 'Bad joke',
  'Congela a los que están cerca 3,5 s.': 'Freezes everyone nearby for 3.5 s.',
  'Manos ágiles': 'Quick hands',
  'Pasiva: roba 40 % más rápido.': 'Passive: steals 40% faster.',
  'Notificación masiva': 'Mass notification',
  'Toda la oficina mira el celular: ven la mitad 3,5 s.': 'The whole office checks their phones: they see half as far for 3.5 s.',
  'Rumor de pasillo': 'Hallway rumor',
  'Los cercanos miran donde soltó el chisme 4 s.': 'Those nearby look where the gossip dropped for 4 s.',
  'Invisible por costumbre': 'Invisible by habit',
  'Pasiva: tardan 0,7 s en notar que roba.': 'Passive: it takes them 0.7 s to notice the theft.',
  'Bajo perfil': 'Low profile',
  'Pasiva: la ven 25 % menos lejos.': 'Passive: seen from 25% less distance.',
  'Dato curioso': 'Fun fact',
  'Una vez por nivel: +10 s de tiempo.': 'Once per level: +10 s on the clock.',
  'Café derramado': 'Spilled coffee',
  'Los cercanos miran el piso: ven 60 % menos 5 s. Es lento.': 'Those nearby stare at the floor: they see 60% less for 5 s. Moves slowly.',
  'Silencio incómodo': 'Awkward silence',
  'Congela a toda la oficina 2 s.': 'Freezes the whole office for 2 s.',
  'Cara de buena persona': 'Nice-guy face',
  'Pasiva: la ven 15 % menos lejos y roba 20 % más rápido.': 'Passive: seen from 15% less distance and steals 20% faster.',
  'Estornudo': 'Sneeze',
  'Congela a los cercanos 2,5 s.': 'Freezes those nearby for 2.5 s.',
  'Hora feliz': 'Happy hour',
  'Corre 45 % más rápido durante 5 s.': 'Runs 45% faster for 5 s.',
  'Karaoke de oficina': 'Office karaoke',
  'Los cercanos miran donde cantó 3 s. Recarga corta.': 'Those nearby look where they sang for 3 s. Short cooldown.',
  'Modo sombra': 'Shadow mode',
  'Invisible para todos durante 2,5 s. Además roba 15 % más rápido.': 'Invisible to everyone for 2.5 s. Also steals 15% faster.',
}

/** Texto en el idioma activo; `{clave}` se sustituye por `vars.clave`. */
export function t(es: string, vars: Readonly<Record<string, string | number>> = {}): string {
  const text = lang === 'en' ? EN[es] ?? es : es
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}
