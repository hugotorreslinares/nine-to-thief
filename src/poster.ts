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

/** Busto ilustrado de trazo grueso y sombra dura, a partir del mismo `Look` que la figura 3D. */
function bust(c: Character, index: number): string {
  const { look } = c
  const [top, bottom] = PANELS[index % PANELS.length] ?? ['#888888', '#444444']
  const skin = hex(look.skin)
  const wide = look.wide ?? 1
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
  return `
  <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMax slice" class="absolute inset-0 size-full" role="img" aria-label="${c.name}">
    <defs><linearGradient id="bg-${c.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="200" height="260" fill="url(#bg-${c.id})"/>
    <path d="M-40 260 L120 -20 L170 -20 L10 260Z" fill="#ffffff" opacity="0.12"/>
    <g stroke="#111" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      ${hair(look, 'back')}
      <g transform="translate(100 0) scale(${wide} 1) translate(-100 0)">
        <path d="M8 262 Q18 192 72 180 L128 180 Q182 192 192 262Z" fill="${hex(look.top)}"/>
        ${shirt}
      </g>
      <path d="M84 148 L84 184 Q100 196 116 184 L116 148Z" fill="${skin}"/>
      <ellipse cx="56" cy="104" rx="7" ry="12" fill="${skin}"/>
      <ellipse cx="144" cy="104" rx="7" ry="12" fill="${skin}"/>
      <path d="${HEAD}" fill="${skin}"/>
      <path d="M100 40 Q142 40 142 95 Q142 140 120 160 Q110 167 100 169Z" fill="#000" opacity="0.2" stroke="none"/>
      ${beard}
      ${hair(look, 'front')}
      <ellipse cx="82" cy="99" rx="8" ry="4.5" fill="#fff" stroke-width="2"/>
      <ellipse cx="118" cy="99" rx="8" ry="4.5" fill="#fff" stroke-width="2"/>
      <circle cx="83" cy="99" r="3" fill="#111" stroke="none"/>
      <circle cx="119" cy="99" r="3" fill="#111" stroke="none"/>
      <path d="M71 87 L93 85 M107 85 L129 87" fill="none" stroke-width="5"/>
      <path d="M101 102 L96 123 L105 125" fill="none" stroke-width="2.5"/>
      <path d="M88 142 Q100 147 113 141" fill="none" stroke-width="3"/>
      ${mustache}
      ${glasses}
    </g>
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
