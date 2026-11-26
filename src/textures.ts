import * as THREE from 'three'

const SIZE = 64

/** Ruido determinista (LCG) para que la textura sea idéntica en cada carga. */
function rng(seed: number): () => number {
  let s = seed
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
}

/**
 * Textura gris pequeña que multiplica el color por vértice (valores 0.84-1.0, sin mipmaps ni anisotropía).
 * `shade(x, y, rand)` devuelve el brillo 0..1 de cada píxel; la trama es periódica para que repita sin costuras.
 */
function makeTexture(seed: number, shade: (x: number, y: number, rand: () => number) => number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible para generar texturas')
  const rand = rng(seed)
  const img = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = Math.round(255 * (0.84 + 0.16 * shade(x, y, rand)))
      img.data.set([v, v, v, 255], (y * SIZE + x) * 4)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  return tex
}

/** Alfombra de oficina: grano fino con una ligera trama de hilos cada 4 px. */
export const carpetTexture = (): THREE.CanvasTexture =>
  makeTexture(7, (x, y, rand) => 0.65 * rand() + 0.35 * (((x >> 2) + (y >> 2)) & 1))
