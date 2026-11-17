import { CHARACTERS, type Character, type Look } from './data.ts'
import { TV } from './device.ts'
import { t } from './i18n.ts'

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`

/** Fondos saturados de cada viñeta: [arriba, abajo]. */
const PANELS: readonly (readonly [string, string])[] = [
  ['#ff9f1a', '#d9480f'], ['#22b8cf', '#0b7285'], ['#f06595', '#a61e4d'], ['#ffd43b', '#e67700'],
  ['#9775fa', '#5f3dc4'], ['#51cf66', '#2b8a3e'], ['#4dabf7', '#1864ab'], ['#ff6b6b', '#c92a2a'],
]

const HEAD = 'M58 95 Q58 40 100 40 Q142 40 142 95 Q142 140 120 160 Q100 172 80 160 Q58 140 58 95Z'
const TOP_HAIR = 'M55 94 Q50 28 100 28 Q150 28 145 94 Q136 60 100 57 Q64 60 55 94Z'

/** Rasgos solo de la ilustración (el muñeco 3D no los lleva), por id de personaje. */
interface Detail {
  /** Cuello de la ropa. Por defecto: camisa si lleva corbata, redondo si no. */
  readonly neck?: 'suit' | 'vest' | 'open' | 'vneck'
  readonly hair?: 'messy' | 'bob' | 'top-bun' | 'crop'
  readonly lanyard?: boolean
  readonly earrings?: boolean
  readonly bowtie?: boolean
  readonly cat?: boolean
  readonly glasses?: boolean
  readonly wrinkles?: boolean
  readonly sad?: boolean
}

const DETAILS: Readonly<Record<string, Detail>> = {
  michael: { neck: 'suit' },
  jim: { hair: 'messy' },
  pam: { hair: 'bob', lanyard: true },
  ryan: { neck: 'suit' },
  kelly: { earrings: true },
  toby: { sad: true },
  angela: { cat: true },
  oscar: { glasses: true },
  kevin: { neck: 'vest' },
  stanley: { hair: 'crop' },
  phyllis: { neck: 'vneck', glasses: true },
  creed: { wrinkles: true },
  meredith: { hair: 'top-bun', lanyard: true },
  andy: { neck: 'vest', bowtie: true },
  darryl: { neck: 'open', hair: 'crop' },
}

/** Dibuja una pieza y su reflejo respecto al eje de la cara. */
const both = (svg: string): string => `${svg}<g transform="translate(200 0) scale(-1 1)">${svg}</g>`

function hair(look: Look, detail: Detail, layer: 'back' | 'front'): string {
  const fill = hex(look.hair)
  const style = detail.hair ?? look.hairStyle
  if (layer === 'back') {
    switch (style) {
      case 'long':
        return `<path d="M50 95 Q40 18 100 22 Q160 18 150 95 L158 200 L42 200Z" fill="${fill}"/>`
      case 'bob':
        return `<path d="M52 96 Q42 20 100 22 Q158 20 148 96 Q164 150 142 180 L58 180 Q36 150 52 96Z" fill="${fill}"/>`
      case 'bun':
        return `<circle cx="148" cy="92" r="18" fill="${fill}"/>`
      case 'top-bun':
        return `<circle cx="132" cy="42" r="19" fill="${fill}"/>`
      default:
        return ''
    }
  }
  switch (style) {
    case 'bald':
      return ''
    case 'balding':
      return `<path d="M56 104 Q48 70 68 56 L65 98Z" fill="${fill}"/><path d="M144 104 Q152 70 132 56 L135 98Z" fill="${fill}"/>`
    case 'curly':
      return [[62, 62], [78, 42], [100, 34], [122, 42], [138, 62], [56, 86], [144, 86]]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="19" fill="${fill}"/>`).join('')
    case 'messy':
      return `<path d="M54 98 Q44 28 100 24 Q156 28 146 98 Q142 76 130 62 L122 76 L112 58 L101 74 L90 58 L80 74 L70 60 Q58 76 54 98Z" fill="${fill}"/>`
    case 'crop':
      return `<path d="M57 88 Q52 36 100 34 Q148 36 143 88 Q138 58 100 54 Q62 58 57 88Z" fill="${fill}"/>`
    case 'bob':
      return `<path d="M55 96 Q48 28 100 28 Q152 28 145 96 Q140 62 112 54 Q84 62 55 96Z" fill="${fill}"/>`
    case 'bun':
    case 'top-bun':
    case 'short':
    case 'long':
      return `<path d="${TOP_HAIR}" fill="${fill}"/>`
  }
}

const STROKE = 'stroke="#111" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'

/** Capas del busto en un lienzo de 200 × 260, comunes al póster y a la foto de fichaje. */
function layers(c: Character): { readonly behind: string; readonly head: string; readonly over: string; readonly sad: boolean } {
  const { look } = c
  const detail = DETAILS[c.id] ?? {}
  const skin = hex(look.skin)
  const top = hex(look.top)
  const neck = detail.neck ?? (look.tie === undefined ? 'round' : 'shirt')
  const wide = (svg: string): string => `<g transform="translate(100 0) scale(${look.wide ?? 1} 1) translate(-100 0)">${svg}</g>`
  // Lo que asoma por el escote, por debajo del cuello.
  const opening = {
    suit: `<path d="M72 180 L100 228 L128 180Z" fill="#f4f4f4"/>`,
    vest: `<path d="M74 180 L100 240 L126 180Z" fill="#f4f4f4"/>`,
    open: `<path d="M82 180 L100 216 L118 180Z" fill="${skin}"/>`,
    vneck: `<path d="M76 180 L100 224 L124 180Z" fill="${skin}"/>`,
    shirt: '',
    round: '',
  }[neck]
  const flaps = (fill: string): string => both(`<path d="M80 177 L100 198 L89 212 L74 188Z" fill="${fill}"/>`)
  const collar = {
    suit: both(`<path d="M72 181 L100 229 L84 248 L56 198Z" fill="${top}"/>`) + flaps('#f4f4f4'),
    vest: flaps('#f4f4f4'),
    open: both(`<path d="M80 177 L101 204 L84 216 L70 190Z" fill="${top}"/>`),
    vneck: '',
    shirt: flaps(top),
    round: `<path d="M80 183 Q100 204 120 183" fill="none"/>`,
  }[neck]
  const tie = look.tie === undefined ? '' : detail.bowtie
    ? both(`<path d="M100 204 L78 194 L78 216Z" fill="${hex(look.tie)}"/>`) + `<rect x="94" y="198" width="12" height="13" rx="3" fill="${hex(look.tie)}"/>`
    : `<path d="M93 197 L107 197 L104 209 L96 209Z" fill="${hex(look.tie)}"/>
       <path d="M96 209 L104 209 L110 250 L100 262 L90 250Z" fill="${hex(look.tie)}"/>`
  const lanyard = detail.lanyard ? `
    <path d="M85 183 L99 214 M115 183 L101 214" fill="none" stroke-width="2.5"/>
    <rect x="88" y="212" width="24" height="18" rx="2" fill="#f4f4f4" stroke-width="2.5"/>
    <rect x="91" y="216" width="8" height="10" fill="#4dabf7" stroke-width="1.5"/>
    <path d="M102 218 h7 M102 223 h7" fill="none" stroke-width="1.5"/>` : ''
  const cat = detail.cat
    ? `<path d="M128 214 L131 204 L137 210 L143 210 L149 204 L152 214 Q152 226 140 226 Q128 226 128 214Z" fill="#8e5bd0" stroke-width="2"/>` : ''
  const earrings = detail.earrings ? both(`<circle cx="55" cy="124" r="10" fill="none" stroke="#9aa0a6" stroke-width="4"/>`) : ''
  const glasses = look.glasses || detail.glasses ? `
    <rect x="66" y="87" width="30" height="22" rx="6" fill="#ffffff" fill-opacity="0.18" stroke-width="3"/>
    <rect x="104" y="87" width="30" height="22" rx="6" fill="#ffffff" fill-opacity="0.18" stroke-width="3"/>
    <path d="M96 96 L104 96 M66 95 L57 92 M134 95 L143 92" fill="none" stroke-width="3"/>` : ''
  const beard = look.beard
    ? `<path d="M62 118 Q64 160 100 171 Q136 160 138 118 Q120 134 100 131 Q80 134 62 118Z" fill="${hex(look.hair)}"/>` : ''
  const mustache = look.mustache
    ? `<path d="M82 132 Q100 120 118 132 L118 139 Q100 131 82 139Z" fill="${hex(look.hair)}"/>` : ''
  const wrinkles = detail.wrinkles ? `
    <path d="M82 66 Q100 61 118 66 M85 74 Q100 70 115 74 M66 108 L61 113 M134 108 L139 113 M80 132 Q76 140 80 148 M120 132 Q124 140 120 148" fill="none" stroke-width="1.8" opacity="0.55"/>
    <path d="M70 44 L66 30 M82 38 L80 24 M100 36 L100 22 M118 38 L120 24 M130 44 L134 30" fill="none" stroke="${hex(look.hair)}" stroke-width="2"/>` : ''
  return {
    behind: `
      ${hair(look, detail, 'back')}
      ${wide(`<path d="M8 262 Q18 192 72 180 L128 180 Q182 192 192 262Z" fill="${top}"/>${opening}`)}
      <path d="M84 148 L84 184 Q100 196 116 184 L116 148Z" fill="${skin}"/>
      ${wide(`${collar}${tie}${lanyard}${cat}`)}
      <ellipse cx="56" cy="104" rx="7" ry="12" fill="${skin}"/>
      <ellipse cx="144" cy="104" rx="7" ry="12" fill="${skin}"/>
      ${earrings}`,
    head: `
      <path d="${HEAD}" fill="${skin}"/>
      <path d="M100 40 Q142 40 142 95 Q142 140 120 160 Q110 167 100 169Z" fill="#000" opacity="0.2" stroke="none"/>
      ${beard}
      ${hair(look, detail, 'front')}
      ${wrinkles}`,
    over: `${mustache}${glasses}`,
    sad: detail.sad === true,
  }
}

/** Busto ilustrado de trazo grueso y sombra dura, a partir del mismo `Look` que la figura 3D. */
function bust(c: Character, index: number): string {
  const [top, bottom] = PANELS[index % PANELS.length] ?? ['#888888', '#444444']
  const { behind, head, over, sad } = layers(c)
  return `
  <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMax slice" class="absolute inset-0 size-full" role="img" aria-label="${c.name}">
    <defs><linearGradient id="bg-${c.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="200" height="260" fill="url(#bg-${c.id})"/>
    <path d="M-40 260 L120 -20 L170 -20 L10 260Z" fill="#ffffff" opacity="0.12"/>
    <!-- Encogido hacia la base: las viñetas anchas recortan por arriba y se comían el pelo. -->
    <g ${STROKE} transform="translate(100 262) scale(0.88) translate(-100 -262)">
      ${behind}
      ${head}
      <ellipse cx="82" cy="99" rx="8.5" ry="6.5" fill="#fff" stroke-width="2"/>
      <ellipse cx="118" cy="99" rx="8.5" ry="6.5" fill="#fff" stroke-width="2"/>
      <circle cx="83" cy="${sad ? 100.5 : 99}" r="3.6" fill="#111" stroke="none"/>
      <circle cx="119" cy="${sad ? 100.5 : 99}" r="3.6" fill="#111" stroke="none"/>
      <circle cx="81.8" cy="97.6" r="1.2" fill="#fff" stroke="none"/>
      <circle cx="117.8" cy="97.6" r="1.2" fill="#fff" stroke="none"/>
      <path d="${sad ? 'M70 88 Q80 82 93 81 M107 81 Q120 82 130 88' : 'M71 86 Q82 81 93 85 M107 85 Q118 81 129 86'}" fill="none" stroke-width="3.5"/>
      <path d="M101 102 L96 123 L105 125" fill="none" stroke-width="2.5"/>
      <path d="${sad ? 'M88 146 Q100 140 112 146' : 'M88 141 Q100 149 113 141'}" fill="none" stroke-width="3"/>
      ${over}
    </g>
  </svg>`
}

/**
 * Foto de fichaje: el personaje atrapado, triste, con el antifaz caído al cuello y su placa.
 * `capture` es el número de captura que sale en la placa. Solo datos estáticos propios.
 * `fill`: ocupa todo su contenedor recortando, en vez de ajustarse a su alto.
 */
export function mugshotHtml(c: Character, capture: number, fill = false): string {
  const { look } = c
  const skin = hex(look.skin)
  const { behind, head, over } = layers(c)
  const marks = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const y = 24 + i * 34
    return `
      <path d="M0 ${y} H240" stroke="#3b3a36" stroke-width="${i % 2 ? 1 : 2.2}"/>
      <path d="M0 ${y + 17} H14 M226 ${y + 17} H240" stroke="#3b3a36" stroke-width="1"/>
      ${i % 2 ? '' : `<text x="6" y="${y - 4}" font-size="10" fill="#3b3a36">${(1.9 - i * 0.1).toFixed(2)}</text>
      <text x="234" y="${y - 4}" font-size="10" fill="#3b3a36" text-anchor="end">${(1.9 - i * 0.1).toFixed(2)}</text>`}`
  }).join('')
  const hand = (x: number): string => `
    <rect x="${x}" y="222" width="30" height="34" rx="11" fill="${skin}"/>
    <path d="M${x + 4} 232 h22 M${x + 4} 240 h22 M${x + 4} 248 h22" fill="none" stroke-width="2"/>`
  return `
  <svg viewBox="0 0 240 300" ${fill ? 'preserveAspectRatio="xMidYMid slice" class="size-full"' : 'class="h-full w-auto"'} role="img" aria-label="Foto de fichaje de ${c.name}">
    <defs>
      <linearGradient id="mug-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e9e4d6"/><stop offset="1" stop-color="#b9b3a2"/>
      </linearGradient>
      <radialGradient id="mug-flash" cx="0.5" cy="0.38" r="0.75">
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>
    <rect width="240" height="300" fill="url(#mug-wall)"/>
    <g font-family="monospace" font-weight="700">${marks}</g>
    <ellipse cx="132" cy="150" rx="74" ry="120" fill="#000" opacity="0.18"/>
    <g transform="translate(20 22)" ${STROKE}>
      ${behind}
      <!-- antifaz caído al cuello -->
      <path d="M70 176 Q100 198 130 176 L132 190 Q100 214 68 190Z" fill="#16161a"/>
      <ellipse cx="88" cy="191" rx="7" ry="4" fill="${hex(look.top)}" stroke-width="2"/>
      <ellipse cx="112" cy="191" rx="7" ry="4" fill="${hex(look.top)}" stroke-width="2"/>
      ${head}
      <!-- rubor y ojeras -->
      <ellipse cx="76" cy="121" rx="10" ry="6" fill="#e2574c" opacity="0.35" stroke="none"/>
      <ellipse cx="124" cy="121" rx="10" ry="6" fill="#e2574c" opacity="0.35" stroke="none"/>
      <path d="M74 109 Q82 113 90 109 M110 109 Q118 113 126 109" fill="none" stroke-width="1.6" opacity="0.5"/>
      <!-- ojos grandes y húmedos, mirando al suelo -->
      <ellipse cx="82" cy="100" rx="9" ry="7" fill="#fff" stroke-width="2"/>
      <ellipse cx="118" cy="100" rx="9" ry="7" fill="#fff" stroke-width="2"/>
      <circle cx="82" cy="102.5" r="4.2" fill="#111" stroke="none"/>
      <circle cx="118" cy="102.5" r="4.2" fill="#111" stroke="none"/>
      <circle cx="80.5" cy="100.5" r="1.5" fill="#fff" stroke="none"/>
      <circle cx="116.5" cy="100.5" r="1.5" fill="#fff" stroke="none"/>
      <path d="M72 97 Q82 91 92 97 M108 97 Q118 91 128 97" fill="${skin}" stroke-width="2.4"/>
      <path d="M77 107 Q82 110 87 107 M113 107 Q118 110 123 107" fill="none" stroke="#8ecbff" stroke-width="2.2"/>
      <!-- cejas de pena -->
      <path d="M69 90 Q80 82 94 80 M106 80 Q120 82 131 90" fill="none" stroke-width="5"/>
      <path d="M96 76 L98 71 M104 76 L102 71" fill="none" stroke-width="1.8" opacity="0.6"/>
      <path d="M101 104 L96 124 L105 126" fill="none" stroke-width="2.5"/>
      <!-- puchero -->
      <path d="M85 147 Q100 134 115 147" fill="none" stroke-width="3.2"/>
      <path d="M93 152 Q100 149 107 152" fill="none" stroke-width="2" opacity="0.6"/>
      <!-- lágrimas y gota de sudor -->
      <path d="M124 108 Q131 122 127 130 Q121 134 119 127 Q118 120 124 108Z" fill="#8ecbff" stroke-width="1.8"/>
      <path d="M79 109 Q75 118 78 122 Q82 123 82 118Z" fill="#8ecbff" stroke-width="1.6"/>
      <path d="M150 62 Q157 74 153 80 Q147 82 146 76 Q146 70 150 62Z" fill="#bfe3ff" stroke-width="1.8"/>
      ${over}
    </g>
    <!-- placa sostenida con las dos manos -->
    <g ${STROKE}>
      <rect x="34" y="214" width="172" height="62" rx="4" fill="#16161a"/>
      <rect x="40" y="220" width="160" height="50" rx="2" fill="none" stroke="#f4f4f4" stroke-width="1.5"/>
      ${hand(18)}${hand(192)}
    </g>
    <g font-family="Impact, 'Arial Narrow Bold', sans-serif" fill="#f4f4f4" text-anchor="middle">
      <text x="120" y="233" font-size="8" textLength="128" lengthAdjust="spacingAndGlyphs">${t('DEPTO. DE POLICÍA · ROBO DE OFICINA')}</text>
      <text x="120" y="256" font-size="24" letter-spacing="2" textLength="${Math.min(120, c.name.length * 17)}" lengthAdjust="spacingAndGlyphs">${c.name.toUpperCase()}</text>
      <text x="120" y="267" font-size="8" letter-spacing="2">${t('CAPTURA N.º {n}', { n: String(capture).padStart(3, '0') })}</text>
    </g>
    <rect width="240" height="300" fill="url(#mug-flash)"/>
  </svg>`
}

/** Póster de inicio: viñetas con bordes negros y el logo en el centro. Solo datos estáticos propios. */
export function posterHtml(): string {
  // Al pasar el cursor, la viñeta enseña la foto de fichaje del personaje.
  const panels = CHARACTERS.map((c, i) => `
    <div class="group relative overflow-hidden">
      ${bust(c, i)}
      <div class="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">${mugshotHtml(c, i + 1, true)}</div>
      <span class="ink absolute bottom-1 left-2 text-sm transition-opacity group-hover:opacity-0 md:text-2xl">${c.name.toUpperCase()}</span>
    </div>`).join('')
  return `
    ${panels}
    <div class="ink col-span-2 col-start-3 row-start-2 flex portrait:col-start-1 portrait:row-start-3 flex-col items-center justify-center bg-[#0f1838] text-center leading-none">
      <span class="text-[min(5.2vw,6.5vh)] text-yellow-300 italic">THREAT LEVEL:</span>
      <span class="text-[min(11vw,13vh)] text-emerald-400">THEFT</span>
      <span class="mt-2 animate-pulse text-[min(2.6vw,3.2vh)] text-yellow-400">${TV ? t('OK PARA EMPEZAR') : t('ENTER O TOCA PARA EMPEZAR')}</span>
    </div>`
}
