/** Art toys disponibles en la preventa. */
export const PRESALE_LIMIT = 10

/** Unidades que quedan, según las vendidas (nunca negativo). */
export const presaleLeft = (sold: number): number => Math.max(0, PRESALE_LIMIT - sold)
