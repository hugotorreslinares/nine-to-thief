import assert from 'node:assert/strict'
import { decode, encode, parseClaim, parseEntry } from '../api/scores.ts'
import { box, canSee, rayDistance, resolveCircle, turnToward } from './logic.ts'

const viewer = { x: 0, z: 0, dir: 0, range: 5, halfAngle: Math.PI / 6 }
const wall = [box(2, 0, 0.3, 4)]

assert.equal(canSee(viewer, { x: 3, z: 0 }, []), true, 've de frente')
assert.equal(canSee(viewer, { x: -3, z: 0 }, []), false, 'no ve atrás')
assert.equal(canSee(viewer, { x: 3, z: 3 }, []), false, 'fuera del cono')
assert.equal(canSee(viewer, { x: 6, z: 0 }, []), false, 'fuera de alcance')
assert.equal(canSee(viewer, { x: 3, z: 0 }, wall), false, 'la pared tapa')
assert.equal(canSee(viewer, { x: 1.5, z: 0 }, wall), true, 've delante de la pared')

assert.ok(Math.abs(rayDistance(0, 0, 1, 0, 5, wall) - 1.85) < 1e-9, 'rayo corta en la pared')
assert.equal(rayDistance(0, 0, 0, 1, 5, wall), 5, 'rayo paralelo no choca')

const pushed = resolveCircle(1.7, 0, 0.35, wall)
assert.ok(Math.abs(pushed.x - 1.5) < 1e-9, 'el círculo sale de la pared')

assert.equal(turnToward(3, -3, 10), -3, 'gira por el camino corto')
assert.ok(turnToward(3, -3, 0.1) > 3, 'cruza por ±π')

assert.deepEqual(decode(encode(7, 42)), { level: 7, seconds: 42 }, 'puntaje ida y vuelta')
assert.ok(encode(3, 0) > encode(2, 99), 'el nivel pesa más que el tiempo')
const token = '123e4567-e89b-42d3-a456-426614174000'
assert.deepEqual(parseEntry({ name: '  Ana ', token, level: 2, seconds: 10 }), { name: 'Ana', token, level: 2, seconds: 10 })
assert.equal(typeof parseClaim({ name: 'Ana' }), 'string', 'rechaza reserva sin token')
assert.equal(typeof parseClaim({ name: 'Ana', token: 'corto' }), 'string', 'rechaza token mal formado')
assert.equal(typeof parseEntry({ name: '<b>x</b>', token, level: 2, seconds: 10 }), 'string', 'rechaza HTML en el apodo')
assert.equal(typeof parseEntry({ name: 'Ana', token, level: 2.5, seconds: 10 }), 'string', 'rechaza nivel no entero')
assert.equal(typeof parseEntry({ name: 'Ana', token, level: 500, seconds: 10 }), 'string', 'rechaza nivel imposible')

console.log('logic ok')
