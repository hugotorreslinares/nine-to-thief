import * as THREE from 'three'
import { LITE } from './device.ts'

export type Surface = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial

/** Material mate; en GPU débil, el sombreado simple de Lambert en lugar del físico. */
export const surface = (color: number, roughness = 0.8): Surface =>
  LITE ? new THREE.MeshLambertMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness })
