/** Pantalla táctil (celular o tableta). */
export const TOUCH = matchMedia('(pointer: coarse)').matches

/** Televisor Android: sin puntero ni teclado, solo el mando a distancia (flechas, OK, Atrás). */
export const TV = !TOUCH && (/Android/i.test(navigator.userAgent) || new URLSearchParams(location.search).has('tv'))

/** GPU débil (los televisores baratos traen Mali-470): menos polígonos, materiales simples y sin sombras. */
export const LITE = TV
