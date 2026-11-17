// Página /tv: descarga del APK para Android TV, instrucciones y aviso de proyecto de fans.
import './style.css'
import { t } from './i18n.ts'

const APK_URL = '/apk'
const SHORT_URL = 'nine-to-thief.vercel.app/apk'
const REPO = 'https://github.com/hugotorreslinares/nine-to-thief'

const step = (n: number, text: string): string => `
  <li class="flex gap-3">
    <span class="ink flex size-8 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-lg text-black">${n}</span>
    <span class="font-sans text-base text-neutral-200">${text}</span>
  </li>`

const steps = [
  t('En tu tele abre la tienda de aplicaciones e instala la app gratuita "Downloader".'),
  t('En los ajustes de la tele permite que Downloader instale apps de origen desconocido (el menú cambia según la marca).'),
  t('Abre Downloader y escribe esta dirección con el mando:') + ` <b class="text-emerald-300 select-text">${SHORT_URL}</b>`,
  t('Descarga el archivo, pulsa Instalar y después Abrir.'),
  t('Para jugar con el celular como mando, escanea el código QR que sale en la pantalla de inicio.'),
]

const notes = [
  t('Es un juego hecho por un fan, gratis, sin anuncios y sin pagos dentro de la app.'),
  t('No tiene relación con la serie The Office, ni con sus creadores, productoras o cadenas. No está afiliado, patrocinado ni respaldado por ellos. Los nombres y personajes de la serie pertenecen a sus respectivos dueños.'),
  t('La app no está en Google Play: instálala solo desde esta página. Android avisará de que viene de un origen desconocido, es normal en las apps que no pasan por la tienda.'),
  t('En la tele se juega la demo (nivel 1). Para los 10 niveles, abre tu art toy en el celular, toca "Jugar en la tele" y escribe el código que muestra la tele.'),
  t('Probado en un televisor Hisense con Android 9. Necesita Android TV o Google TV con Android 7 o superior e internet.'),
  t('Para actualizar, desinstala la versión anterior antes de instalar la nueva.'),
]

const root = document.querySelector('#tv')
if (!root) throw new Error('Falta #tv en tv/index.html')
// Datos estáticos propios: no hay entrada de usuario en este HTML.
root.innerHTML = `
  <header class="ink flex flex-col gap-1">
    <a href="/" class="text-sm text-sky-300 underline">← ${t('Volver al juego')}</a>
    <h1 class="text-4xl text-yellow-300 md:text-6xl">NINE TO <span class="text-emerald-400">THIEF</span></h1>
    <p class="text-2xl">${t('JUEGA EN TU TELEVISOR')}</p>
  </header>
  <p class="font-sans text-lg text-neutral-200">${t('Roba objetos de la oficina sin que te vean, ahora en Android TV y Google TV. Gratis.')}</p>
  <a href="${APK_URL}" class="ink w-fit rounded-lg border-2 border-black bg-emerald-500 px-6 py-3 text-2xl hover:brightness-110">⬇ ${t('DESCARGAR APK')}</a>
  <p class="-mt-3 font-sans text-sm text-neutral-400">nine-to-thief.apk · ${t('unos 5 MB')}</p>
  <section class="flex flex-col gap-3">
    <h2 class="ink text-2xl text-yellow-300">${t('CÓMO INSTALARLO')}</h2>
    <ol class="flex flex-col gap-3">${steps.map((text, i) => step(i + 1, text)).join('')}</ol>
  </section>
  <section class="flex flex-col gap-3 rounded-lg border-2 border-neutral-700 bg-neutral-900 p-4">
    <h2 class="ink text-2xl text-yellow-300">${t('ANTES DE INSTALAR')}</h2>
    <ul class="flex list-disc flex-col gap-2 pl-5 font-sans text-sm text-neutral-300">${notes.map((text) => `<li>${text}</li>`).join('')}</ul>
  </section>
  <footer class="font-sans text-sm text-neutral-400">
    ${t('Código abierto en')} <a href="${REPO}" target="_blank" rel="noopener noreferrer" class="text-sky-300 underline">GitHub</a>
  </footer>`
