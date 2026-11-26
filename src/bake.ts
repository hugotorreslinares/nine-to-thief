import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { LITE } from './device.ts'

/** UV planares en mundo: caras horizontales -> (x, z); laterales -> (x|z, y). Una repetición cada `metersPerTile` m. */
function addWorldUV(geo: THREE.BufferGeometry, metersPerTile: number): void {
  const pos = geo.getAttribute('position')
  const normal = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  // La geometría es non-indexed: cada 3 vértices son un triángulo y comparten eje de proyección (evita franjas en los cilindros).
  for (let t = 0; t < pos.count; t += 3) {
    let nx = 0
    let ny = 0
    let nz = 0
    for (let k = t; k < t + 3; k++) {
      nx += normal.getX(k)
      ny += normal.getY(k)
      nz += normal.getZ(k)
    }
    const [ax, ay, az] = [Math.abs(nx), Math.abs(ny), Math.abs(nz)]
    for (let i = t; i < t + 3; i++) {
      const [u, v] = ay >= ax && ay >= az ? [pos.getX(i), pos.getZ(i)] : ax > az ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)]
      uv.set([u / metersPerTile, v / metersPerTile], i * 2)
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * Funde varias mallas en una sola con el color en los vértices: una llamada de dibujo en vez de decenas.
 * Cada malla aporta su geometría ya transformada y el color de su material.
 */
export function mergeColored(
  meshes: readonly THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>[],
  roughness: number,
  texture?: { readonly map: THREE.Texture; readonly metersPerTile: number },
): THREE.Mesh | undefined {
  if (meshes.length === 0) return undefined
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix()
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    geo.deleteAttribute('uv')
    geo.applyMatrix4(mesh.matrix)
    if (texture) addWorldUV(geo, texture.metersPerTile)
    const count = geo.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    const { r, g, b } = mesh.material.color
    for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  })
  const geometry = mergeGeometries(geometries)
  for (const geo of geometries) geo.dispose()
  const map = texture?.map
  // `map: undefined` en los parámetros hace que Three avise por consola en cada material.
  const textured = map ? { map } : {}
  const material = LITE ? new THREE.MeshLambertMaterial({ vertexColors: true, ...textured }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness, ...textured })
  return new THREE.Mesh(geometry, material)
}

/** Sustituye las mallas hijas directas de un grupo por una sola fundida; las marcadas con userData.keep se quedan. */
export function bakeChildren(group: THREE.Object3D, roughness: number): void {
  const parts = group.children.filter((c): c is THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> => c instanceof THREE.Mesh && c.userData.keep !== true)
  const merged = mergeColored(parts, roughness)
  if (!merged) return
  merged.castShadow = true
  group.remove(...parts)
  group.add(merged)
}
