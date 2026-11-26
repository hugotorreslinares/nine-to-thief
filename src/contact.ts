import * as THREE from 'three'

/** Sombras de contacto falsas: dos mallas (una fija, una móvil) = 2 llamadas de dibujo, sirven también sin sombras reales (LITE). */

const OPACITY = 0.38
const LIFT = 0.03 // sobre el suelo y las alfombras (0.024); bajo las franjas de luz (0.035). No escribe profundidad

/** Textura 64x64 de alfa generada por píxel (negro con transparencia). */
function makeTexture(alphaAt: (u: number, v: number) => number): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Sin contexto 2D para la sombra de contacto')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) img.data[(y * size + x) * 4 + 3] = Math.round(255 * alphaAt((x + 0.5) / size, (y + 0.5) / size))
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

const smooth = (t: number): number => {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

function makeMesh(tex: THREE.Texture, quads: number): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const geo = new THREE.BufferGeometry()
  const uv = new Float32Array(quads * 8)
  const index = new Uint16Array(quads * 6)
  for (let q = 0; q < quads; q++) {
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], q * 8)
    index.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2], q * 6)
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(quads * 12), 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: OPACITY, depthWrite: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = -1 // tras el suelo opaco, antes de lo demás
  mesh.frustumCulled = false
  return mesh
}

/** Escribe un cuadrado centrado en (x, z) con media arista `r` en el quad `q`. */
function setQuad(pos: Float32Array, q: number, x0: number, z0: number, x1: number, z1: number): void {
  const o = q * 12
  pos[o] = x0; pos[o + 1] = LIFT; pos[o + 2] = z0
  pos[o + 3] = x1; pos[o + 4] = LIFT; pos[o + 5] = z0
  pos[o + 6] = x1; pos[o + 7] = LIFT; pos[o + 8] = z1
  pos[o + 9] = x0; pos[o + 10] = LIFT; pos[o + 11] = z1
}

/** Oclusión ambiental falsa de los muebles fijos: un rectángulo difuso algo mayor que cada base, todo en una malla. */
export function addFixedContact(scene: THREE.Scene, boxes: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[]): void {
  const edge = (t: number): number => smooth(Math.min(t, 1 - t) / 0.3)
  const mesh = makeMesh(makeTexture((u, v) => edge(u) * edge(v)), boxes.length)
  const pos = mesh.geometry.getAttribute('position').array as Float32Array
  const m = 0.3 // margen que asoma alrededor de la base
  boxes.forEach((b, q) => setQuad(pos, q, b.minX - m, b.minZ - m, b.maxX + m, b.maxZ + m))
  scene.add(mesh)
}

/** Sombra circular bajo cada objeto móvil (figuras, sillas, plantas); `update` la recoloca cada cuadro. */
export function createMovingContact(scene: THREE.Scene, targets: readonly { readonly obj: THREE.Object3D; readonly radius: number }[]): () => void {
  const mesh = makeMesh(makeTexture((u, v) => Math.pow(Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 2), 1.4)), targets.length)
  const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const pos = attr.array as Float32Array
  scene.add(mesh)
  return () => {
    targets.forEach(({ obj, radius }, q) => {
      const { x, z } = obj.position
      // sin escena u oculto: el quad se colapsa y no pinta nada
      const r = obj.parent && obj.visible ? radius : 0
      setQuad(pos, q, x - r, z - r, x + r, z + r)
    })
    attr.needsUpdate = true
  }
}
