import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { LITE } from './device.ts'

/**
 * Funde varias mallas en una sola con el color en los vértices: una llamada de dibujo en vez de decenas.
 * Cada malla aporta su geometría ya transformada y el color de su material.
 */
export function mergeColored(meshes: readonly THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>[], roughness: number): THREE.Mesh | undefined {
  if (meshes.length === 0) return undefined
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix()
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    geo.deleteAttribute('uv')
    geo.applyMatrix4(mesh.matrix)
    const count = geo.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    const { r, g, b } = mesh.material.color
    for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  })
  const geometry = mergeGeometries(geometries)
  for (const geo of geometries) geo.dispose()
  const material = LITE ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness })
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
