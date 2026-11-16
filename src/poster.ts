import { CHARACTERS, type Character, type Look } from './data.ts'

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`

/** Fondos saturados de cada viñeta: [arriba, abajo]. */
const PANELS: readonly (readonly [string, string])[] = [
  ['#ff9f1a', '#d9480f'], ['#22b8cf', '#0b7285'], ['#f06595', '#a61e4d'], ['#ffd43b', '#e67700'],
  ['#9775fa', '#5f3dc4'], ['#51cf66', '#2b8a3e'], ['#4dabf7', '#1864ab'], ['#ff6b6b', '#c92a2a'],
]

const HEAD = 'M58 95 Q58 40 100 40 Q142 40 142 95 Q142 140 120 160 Q100 172 80 160 Q58 140 58 95Z'
const TOP_HAIR = 'M55 94 Q50 28 100 28 Q150 28 145 94 Q136 60 100 57 Q64 60 55 94Z'

function hair(look: Look, layer: 'back' | 'front'): string {
  const fill = hex(look.hair)
  const style = look.hairStyle
  if (layer === 'back') {
    return style === 'long'
      ? `<path d="M50 95 Q40 18 100 22 Q160 18 150 95 L158 200 L42 200Z" fill="${fill}"/>`
      : ''
  }
  switch (style) {
    case 'bald':
      return ''
    case 'balding':
      return `<path d="M56 104 Q48 70 68 56 L65 98Z" fill="${fill}"/><path d="M144 104 Q152 70 132 56 L135 98Z" fill="${fill}"/>`
    case 'curly':
      return [[62, 62], [78, 42], [100, 34], [122, 42], [138, 62], [56, 86], [144, 86]]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="19" fill="${fill}"/>`).join('')
    case 'bun':
      return `<circle cx="100" cy="20" r="17" fill="${fill}"/><path d="${TOP_HAIR}" fill="${fill}"/>`
    case 'short':
    case 'long':
      return `<path d="${TOP_HAIR}" fill="${fill}"/>`
  }
}

const STROKE = 'stroke="#111" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'

/** Capas del busto en un lienzo de 200 × 260, comunes al póster y a la foto de fichaje. */
function layers(look: Look): { readonly behind: string; readonly head: string; readonly over: string } {
  const skin = hex(look.skin)
  const shirt = look.tie === undefined ? '' : `
    <path d="M78 180 L100 222 L122 180Z" fill="#f4f4f4"/>
    <path d="M94 186 L106 186 L110 248 L100 262 L90 248Z" fill="${hex(look.tie)}"/>`
  const glasses = look.glasses ? `
    <rect x="68" y="88" width="28" height="20" rx="5" fill="none"/>
    <rect x="104" y="88" width="28" height="20" rx="5" fill="none"/>
    <path d="M96 96 L104 96" fill="none"/>` : ''
  const beard = look.beard
    ? `<path d="M62 118 Q64 160 100 171 Q136 160 138 118 Q120 134 100 131 Q80 134 62 118Z" fill="${hex(look.hair)}"/>` : ''
  const mustache = look.mustache
    ? `<path d="M82 132 Q100 120 118 132 L118 139 Q100 131 82 139Z" fill="${hex(look.hair)}"/>` : ''
  return {
    behind: `
      ${hair(look, 'back')}
      <g transform="translate(100 0) scale(${look.wide ?? 1} 1) translate(-100 0)">
        <path d="M8 262 Q18 192 72 180 L128 180 Q182 192 192 262Z" fill="${hex(look.top)}"/>
        ${shirt}
      </g>
      <path d="M84 148 L84 184 Q100 196 116 184 L116 148Z" fill="${skin}"/>
      <ellipse cx="56" cy="104" rx="7" ry="12" fill="${skin}"/>
      <ellipse cx="144" cy="104" rx="7" ry="12" fill="${skin}"/>`,
    head: `
      <path d="${HEAD}" fill="${skin}"/>
      <path d="M100 40 Q142 40 142 95 Q142 140 120 160 Q110 167 100 169Z" fill="#000" opacity="0.2" stroke="none"/>
      ${beard}
      ${hair(look, 'front')}`,
    over: `${mustache}${glasses}`,
  }
}

/** Busto ilustrado de trazo grueso y sombra dura, a partir del mismo `Look` que la figura 3D. */
function bust(c: Character, index: number): string {
  const [top, bottom] = PANELS[index % PANELS.length] ?? ['#888888', '#444444']
  const { behind, head, over } = layers(c.look)
  return `
  <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMax slice" class="absolute inset-0 size-full" role="img" aria-label="${c.name}">
    <defs><linearGradient id="bg-${c.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="200" height="260" fill="url(#bg-${c.id})"/>
    <path d="M-40 260 L120 -20 L170 -20 L10 260Z" fill="#ffffff" opacity="0.12"/>
    <g ${STROKE}>
      ${behind}
      ${head}
      <ellipse cx="82" cy="99" rx="8" ry="4.5" fill="#fff" stroke-width="2"/>
      <ellipse cx="118" cy="99" rx="8" ry="4.5" fill="#fff" stroke-width="2"/>
      <circle cx="83" cy="99" r="3" fill="#111" stroke="none"/>
      <circle cx="119" cy="99" r="3" fill="#111" stroke="none"/>
      <path d="M71 87 L93 85 M107 85 L129 87" fill="none" stroke-width="5"/>
      <path d="M101 102 L96 123 L105 125" fill="none" stroke-width="2.5"/>
      <path d="M88 142 Q100 147 113 141" fill="none" stroke-width="3"/>
      ${over}
    </g>
  </svg>`
}

/**
 * Foto de fichaje: el personaje atrapado, triste, con el antifaz caído al cuello y su placa.
 * `capture` es el número de captura que sale en la placa. Solo datos estáticos propios.
 */
export function mugshotHtml(c: Character, capture: number): string {
  const { look } = c
  const skin = hex(look.skin)
  const { behind, head, over } = layers(look)
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
  <svg viewBox="0 0 240 300" class="h-full w-auto" role="img" aria-label="Foto de fichaje de ${c.name}">
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
      <text x="120" y="233" font-size="8" textLength="128" lengthAdjust="spacingAndGlyphs">DEPTO. DE POLICÍA · ROBO DE OFICINA</text>
      <text x="120" y="256" font-size="24" letter-spacing="2" textLength="${Math.min(120, c.name.length * 17)}" lengthAdjust="spacingAndGlyphs">${c.name.toUpperCase()}</text>
      <text x="120" y="267" font-size="8" letter-spacing="2">CAPTURA N.º ${String(capture).padStart(3, '0')}</text>
    </g>
    <rect width="240" height="300" fill="url(#mug-flash)"/>
  </svg>`
}

/** Póster de inicio: viñetas con bordes negros y el logo en el centro. Solo datos estáticos propios. */
export function posterHtml(): string {
  const panels = CHARACTERS.map((c, i) => `
    <div class="relative overflow-hidden">
      ${bust(c, i)}
      <span class="ink absolute bottom-1 left-2 text-sm md:text-2xl">${c.name.toUpperCase()}</span>
    </div>`).join('')
  return `
    ${panels}
    <div class="ink col-span-2 col-start-3 row-start-2 flex portrait:col-start-1 portrait:row-start-3 flex-col items-center justify-center bg-black text-center leading-none">
      <span class="text-[min(4vw,5vh)] tracking-widest text-white">THE OFFICE</span>
      <span class="text-[min(11vw,13vh)] text-emerald-400">THEFT</span>
      <span class="mt-2 animate-pulse text-[min(3vw,3.5vh)] text-yellow-300">ENTER O TOCA PARA EMPEZAR</span>
    </div>`
}
