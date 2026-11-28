import type { Character, Look } from './data.ts'
import { TV } from './device.ts'
import { t } from './i18n.ts'

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`

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
  nine: { neck: 'suit' },
  bea: { neck: 'suit', hair: 'bob' },
  teo: { hair: 'messy' },
  lucia: { hair: 'bob', lanyard: true },
  omar: { neck: 'suit' },
  sara: { earrings: true },
  felix: { sad: true },
  elsa: { glasses: true },
  pablo: { glasses: true },
  dani: { neck: 'vest' },
  clara: { neck: 'vneck', glasses: true },
  nacho: { wrinkles: true },
  rita: { hair: 'top-bun', lanyard: true },
}

/** Dibuja una pieza y su reflejo respecto al eje de la cara. */
const both = (svg: string): string => `${svg}<g transform="translate(200 0) scale(-1 1)">${svg}</g>`

/** Aclara (amount > 0) u oscurece (< 0) un color 0xRRGGBB. */
function shade(n: number, amount: number): string {
  const mix = (c: number): number => Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`
}

const dots = (points: readonly (readonly [number, number])[], r: number, fill: string, opacity: number): string =>
  points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}" stroke="none"/>`).join('')

const FRECKLES = both(dots([[78, 119], [84, 124], [90, 119], [81, 128], [88, 128]], 1.7, '#8a4b2a', 0.55))
const STUBBLE = dots([[72, 142], [78, 150], [86, 157], [96, 162], [104, 162], [114, 157], [122, 150], [128, 142], [90, 142], [110, 142], [100, 156]], 1.2, '#000', 0.35)
const BAGS = `<path d="M71 112 Q82 120 93 112 M107 112 Q118 120 129 112" fill="none" stroke="#5b4636" stroke-width="2.2" opacity="0.55"/>`

/** Color de ojos por personaje (el resto, marrón). */
const IRIS: Readonly<Record<string, number>> = {
  nine: 0x3a5a7a, bea: 0x6a8caf, teo: 0x4f7fb5, sara: 0x5b8a5b, felix: 0x6a8caf, elsa: 0x7aa0b8, pablo: 0x3f3a36,
  dani: 0x4f9d9d, clara: 0x5b8a5b, ivan: 0x4f7fb5,
}

/** Acabado común: iris con brillo, cejas del color del pelo, pestañas y labios (con falda), nariz y trazos de pelo. */
function finish(c: Character): string {
  const { look } = c
  const iris = hex(IRIS[c.id] ?? 0x5a3a22)
  const brow = look.hairStyle === 'bald' ? shade(look.skin, -0.45) : shade(look.hair, c.id === 'elsa' || c.id === 'bea' ? -0.25 : 0)
  const eyes = [82, 118].map((x) => `<circle cx="${x}" cy="102.5" r="4.6" fill="${iris}" stroke="none"/><circle cx="${x}" cy="102.5" r="2.4" fill="#111" stroke="none"/><circle cx="${x - 1.8}" cy="100.6" r="1.5" fill="#fff" stroke="none"/>`).join('')
  const brows = `<path d="M69 90 Q80 82 94 80 M106 80 Q120 82 131 90" fill="none" stroke="#111" stroke-width="7"/><path d="M69 90 Q80 82 94 80 M106 80 Q120 82 131 90" fill="none" stroke="${brow}" stroke-width="4.2"/>`
  const lashes = look.skirt ? `<path d="M73 98 L66 94 M74 94 L69 88 M127 98 L134 94 M126 94 L131 88" fill="none" stroke-width="2.2"/>` : ''
  const lips = look.skirt ? `<path d="M85 147 Q100 134 115 147" fill="none" stroke="#c2415a" stroke-width="5" opacity="0.75" stroke-linecap="round"/>` : ''
  const nostrils = `<ellipse cx="97" cy="125" rx="1.8" ry="1.2" fill="#000" opacity="0.5" stroke="none"/><ellipse cx="105" cy="126" rx="1.8" ry="1.2" fill="#000" opacity="0.5" stroke="none"/>`
  const strands = look.hairStyle === 'bald' ? '' : `<path d="M62 76 Q68 50 86 38 M78 64 Q86 46 102 36 M100 60 Q112 44 126 40 M120 62 Q130 50 138 56" fill="none" stroke="${shade(look.hair, -0.4)}" stroke-width="1.6" opacity="0.55" stroke-linecap="round"/>`
  return `${strands}${eyes}${brows}${lashes}${lips}${nostrils}`
}

/** Rasgos propios de cada personaje: `face` va sobre la cara (bajo ojos y boca), `over` encima de todo y `neck` junto al cuello. */
function extras(c: Character): { readonly face: string; readonly over: string; readonly neck: string } {
  const { look } = c
  const hairColor = hex(look.hair)
  const none = { face: '', over: '', neck: '' }
  switch (c.id) {
    case 'nine':
      return { ...none, face: `<path d="M67 83 L79 99" fill="none" stroke="#9b4a3a" stroke-width="2.6"/><path d="M70 82 L73 86 M74 90 L78 88" fill="none" stroke="#9b4a3a" stroke-width="1.6"/>` }
    case 'bea': {
      const pearls = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8
        const x = (1 - t) ** 2 * 72 + 2 * (1 - t) * t * 100 + t ** 2 * 128
        const y = (1 - t) ** 2 * 177 + 2 * (1 - t) * t * 199 + t ** 2 * 177
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#f6efe6" stroke="#b9a98f" stroke-width="1.2"/>`
      }).join('')
      return { ...none, neck: pearls, face: `<path d="M76 134 Q71 140 76 147 M124 134 Q129 140 124 147" fill="none" stroke-width="1.6" opacity="0.45"/>` }
    }
    case 'marco':
      return { ...none, face: BAGS, neck: `<ellipse cx="64" cy="189" rx="6" ry="4" fill="#5a3a22" opacity="0.6" stroke="none"/>` }
    case 'teo':
      return { ...none, face: FRECKLES }
    case 'lucia':
      return { ...none, over: `<path d="M147 88 L153 128" stroke="#f28ab2" stroke-width="4.5" fill="none"/><path d="M147 88 L145 82" stroke="#111" stroke-width="3" fill="none"/>` }
    case 'omar':
      return { ...none, face: STUBBLE, over: `<ellipse cx="147" cy="110" rx="3.5" ry="6" fill="#f4f4f4" stroke-width="1.6"/><path d="M147 114 L147 130" stroke="#f4f4f4" stroke-width="3.5" fill="none"/>` }
    case 'sara':
      return { ...none, face: FRECKLES + dots([[117, 135]], 2.4, '#2d1a10', 0.9) }
    case 'felix':
      return { ...none, face: BAGS + STUBBLE }
    case 'elsa':
      return { ...none, over: `<path d="M57 93 Q38 150 66 190 M143 93 Q162 150 134 190" fill="none" stroke="#c9b27c" stroke-width="2.2"/>${[[44,128],[45,148],[53,172]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#f6efe6" stroke="none"/>`).join('')}`, face: `<path d="M78 66 Q100 61 122 66 M82 74 Q100 70 118 74" fill="none" stroke-width="1.6" opacity="0.45"/>` }
    case 'pablo':
      return { ...none, neck: dots([[114, 187], [121, 187], [128, 187]], 2.8, '#e5383b', 1) }
    case 'dani':
      return { ...none, face: `<path d="M84 135 Q100 127 116 135 Q100 142 84 135Z" fill="#6b4226" opacity="0.75" stroke="none"/><path d="M120 112 Q125 120 121 126 Q116 122 120 112Z" fill="#6b4226" opacity="0.8" stroke="none"/>` }
    case 'ramon':
      return { ...none, face: `<ellipse cx="84" cy="52" rx="14" ry="6" fill="#fff" opacity="0.4" stroke="none" transform="rotate(-25 84 52)"/><path d="M80 66 Q100 60 120 66 M84 75 Q100 70 116 75" fill="none" stroke-width="1.8" opacity="0.5"/>` }
    case 'clara':
      return { ...none, face: FRECKLES + both(`<circle cx="76" cy="124" r="9" fill="#ff8fa3" opacity="0.28" stroke="none"/>`) }
    case 'nacho':
      return { ...none, over: `<circle cx="101" cy="124" r="7" fill="#e5534b" opacity="0.85" stroke-width="2"/><path d="M104 130 Q108 139 105 144 Q101 141 104 130Z" fill="#bfe3ff" stroke-width="1.4"/>` }
    case 'rita':
      return { ...none, over: `<g transform="translate(70 58)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-6.5" rx="4.4" ry="6.5" fill="#ff6b9d" stroke-width="1.6" transform="rotate(${a})"/>`).join('')}<circle r="3.4" fill="#ffd166" stroke-width="1.4"/></g>` }
    case 'ivan':
      return { ...none, over: both(`<circle cx="54" cy="112" r="4.5" fill="#f4f4f4" stroke-width="1.8"/><path d="M52 116 Q42 152 70 190" fill="none" stroke="#f4f4f4" stroke-width="2.4"/>`) }
    case 'lobo':
      return {
        face: `<ellipse cx="100" cy="137" rx="26" ry="21" fill="${shade(look.skin, 0.3)}" stroke="none"/>${both(`<path d="M59 108 L43 116 L58 124 L45 134 L60 142 L49 154 L64 154Z" fill="${hairColor}" stroke-width="2.4"/>`)}`,
        neck: `<path d="M58 160 L48 178 L64 172 L60 190 L78 180 L80 198 L92 184 L100 202 L108 184 L120 198 L122 180 L140 190 L136 172 L152 178 L142 160Z" fill="${hairColor}" stroke-width="2.4"/>`,
        over: both(`<path d="M62 56 L46 6 L92 40Z" fill="${hairColor}" stroke-width="3"/><path d="M63 48 L55 22 L80 40Z" fill="#e9a3a3" stroke="none"/>`)
          + `<path d="M89 117 Q100 110 111 117 Q109 129 100 131 Q91 129 89 117Z" fill="#111" stroke-width="2"/><ellipse cx="97" cy="116" rx="4" ry="1.8" fill="#fff" opacity="0.6" stroke="none"/>`
          + [82, 118].map((x) => `<circle cx="${x}" cy="102.5" r="4.8" fill="#f59e0b" stroke="none"/><ellipse cx="${x}" cy="102.5" rx="1.3" ry="4.2" fill="#111" stroke="none"/><circle cx="${x - 1.6}" cy="100.8" r="1.2" fill="#fff" stroke="none"/>`).join('')
          + `<path d="M87 148 L91 160 L96 148Z M104 148 L109 160 L113 148Z" fill="#fff" stroke-width="1.6"/>`,
      }
    default:
      return none
  }
}

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
  const gear = new Set(look.gear ?? [])
  const tieColor = look.tie ?? (gear.has('bowtie') ? 0xc1121f : undefined)
  const neck = detail.neck ?? (tieColor === undefined ? 'round' : 'shirt')
  const extra = extras(c)
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
  const isBowtie = detail.bowtie === true || gear.has('bowtie')
  // El moño va sobre el antifaz caído; la corbata asoma por debajo.
  const bowtie = tieColor !== undefined && isBowtie
    ? both(`<path d="M100 190 L76 178 L76 202Z" fill="${hex(tieColor)}"/>`) + `<rect x="93" y="183" width="14" height="14" rx="3" fill="${hex(tieColor)}"/>` : ''
  const tie = tieColor === undefined || isBowtie ? ''
    : `<path d="M93 197 L107 197 L104 209 L96 209Z" fill="${hex(tieColor)}"/>
       <path d="M96 209 L104 209 L110 250 L100 262 L90 250Z" fill="${hex(tieColor)}"/>`
  const lanyard = detail.lanyard || gear.has('lanyard') ? `
    <path d="M85 183 L99 214 M115 183 L101 214" fill="none" stroke-width="2.5"/>
    <rect x="88" y="212" width="24" height="18" rx="2" fill="#f4f4f4" stroke-width="2.5"/>
    <rect x="91" y="216" width="8" height="10" fill="#4dabf7" stroke-width="1.5"/>
    <path d="M102 218 h7 M102 223 h7" fill="none" stroke-width="1.5"/>` : ''
  const cat = detail.cat
    ? `<path d="M128 214 L131 204 L137 210 L143 210 L149 204 L152 214 Q152 226 140 226 Q128 226 128 214Z" fill="#8e5bd0" stroke-width="2"/>` : ''
  const earrings = detail.earrings || gear.has('earrings') ? both(`<circle cx="55" cy="124" r="10" fill="none" stroke="#9aa0a6" stroke-width="4"/>`) : ''
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
  const headset = gear.has('headset') ? `
    <path d="M57 94 Q54 34 100 32 Q146 34 143 94" fill="none" stroke="#2b2b30" stroke-width="6"/>
    ${both(`<rect x="47" y="92" width="13" height="32" rx="6" fill="#2b2b30"/><rect x="50" y="98" width="5" height="20" rx="2.5" fill="#5a5a66" stroke="none"/>`)}
    <path d="M52 122 Q58 152 86 152" fill="none" stroke="#2b2b30" stroke-width="3"/><circle cx="88" cy="152" r="5" fill="#2b2b30"/>` : ''
  const cap = gear.has('cap') ? `
    <path d="M58 70 Q58 22 100 20 Q142 22 142 70Z" fill="#1d4ed8"/>
    <path d="M100 21 L100 68 M80 26 Q76 48 78 69 M120 26 Q124 48 122 69" fill="none" stroke="#1e3a8a" stroke-width="1.6" opacity="0.6"/>
    <circle cx="100" cy="21" r="4.5" fill="#1e3a8a"/>
    <path d="M50 70 Q100 54 150 70 Q152 80 100 82 Q48 80 50 70Z" fill="#1e40af"/>` : ''
  const scarf = gear.has('scarf') ? `
    <path d="M66 176 Q100 200 134 176 L138 194 Q100 220 62 194Z" fill="#e11d48"/>
    <path d="M80 192 L84 200 M96 197 L98 205 M112 197 L114 205 M126 190 L128 198" fill="none" stroke="#fda4af" stroke-width="2"/>
    <path d="M104 204 L128 202 L132 236 L108 240Z" fill="#be123c"/>` : ''
  const sheen = look.hairStyle === 'bald' ? '' : `<path d="M72 52 Q100 40 128 52" fill="none" stroke="${shade(look.hair, 0.4)}" stroke-width="4" opacity="0.5" stroke-linecap="round"/>
      <path d="M66 64 Q72 56 82 52" fill="none" stroke="${shade(look.hair, 0.4)}" stroke-width="2.5" opacity="0.4" stroke-linecap="round"/>`
  return {
    behind: `
      ${hair(look, detail, 'back')}
      ${wide(`<path d="M8 262 Q18 192 72 180 L128 180 Q182 192 192 262Z" fill="${top}"/>${opening}`)}
      <path d="M84 148 L84 184 Q100 196 116 184 L116 148Z" fill="${skin}"/>
      ${wide(`${collar}${tie}${lanyard}${cat}`)}
      <path d="M84 160 Q100 178 116 160 L116 184 Q100 194 84 184Z" fill="#000" opacity="0.16" stroke="none"/>
      <ellipse cx="56" cy="104" rx="7" ry="12" fill="${skin}"/>
      <ellipse cx="144" cy="104" rx="7" ry="12" fill="${skin}"/>
      <path d="M54 99 Q58 106 55 113 M146 99 Q142 106 145 113" fill="none" stroke-width="1.6" opacity="0.5"/>
      ${earrings}`,
    head: `
      <path d="${HEAD}" fill="${skin}"/>
      <path d="M100 40 Q142 40 142 95 Q142 140 120 160 Q110 167 100 169Z" fill="#000" opacity="0.2" stroke="none"/>
      ${beard}
      ${hair(look, detail, 'front')}
      ${sheen}
      ${extra.face}
      ${wrinkles}`,
    over: `${finish(c)}${scarf}${bowtie}${extra.neck}${mustache}${glasses}${headset}${cap}${extra.over}`,
    sad: detail.sad === true,
  }
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

/** Portada: el art toy como héroe sobre rayos de color, con el título. Solo datos estáticos propios. */
export function posterHtml(): string {
  const outline = '[-webkit-text-stroke:0.07em_black] [paint-order:stroke_fill]'
  return `
    <div class="group absolute right-[8%] bottom-0 aspect-[0.58] h-[96%] max-w-[46%] drop-shadow-[10px_12px_0_rgb(0_0_0/0.35)] portrait:top-[3%] portrait:right-1/2 portrait:bottom-auto portrait:h-[54%] portrait:max-w-[80%] portrait:translate-x-1/2">
      <img src="/toy-hide.webp" alt="" class="absolute inset-0 size-full object-contain object-bottom transition duration-300 group-hover:scale-95 group-hover:opacity-0" />
      <img src="/toy.webp" alt="" class="absolute inset-0 size-full origin-bottom scale-90 object-contain object-bottom opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100" />
    </div>
    <div class="ink absolute top-[40%] left-[5%] flex -translate-y-1/2 flex-col leading-[0.9] portrait:inset-x-0 portrait:top-auto portrait:bottom-[5%] portrait:left-0 portrait:translate-y-0 portrait:items-center portrait:text-center">
      <span class="font-title text-[min(6vw,8.5vh)] text-white ${outline}">NINE TO</span>
      <span class="font-title text-[min(14vw,20vh)] text-yellow-300 ${outline}">THIEF</span>
      <span class="mt-3 text-[min(2.8vw,3.8vh)] text-white ${outline}">${t('ROBA LA OFICINA SIN QUE TE VEAN')}</span>
      <span class="mt-4 animate-pulse text-[min(2.6vw,3.4vh)] text-yellow-300 ${outline}">${TV ? t('OK PARA EMPEZAR') : t('ENTER O TOCA PARA EMPEZAR')}</span>
    </div>`
}
