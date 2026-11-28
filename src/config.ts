import config from '../game.config.json' with { type: 'json' }

// Ajustes que se cambian en game.config.json, sin tocar el código. Se aplican al desplegar.

/** Niveles que se juegan gratis, sin art toy. */
export const FREE_LEVELS: number = config.freeLevels

if (!Number.isInteger(FREE_LEVELS) || FREE_LEVELS < 1) throw new Error('game.config.json: freeLevels debe ser un entero de 1 o más')
