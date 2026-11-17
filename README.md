# Threat Level: Theft

Un juego de sigilo en el que te cuelas en una oficina para llevarte todo lo que puedas sin que tus compañeros te descubran. Elige a quién controlar, esquiva a quienes patrullan y aprovecha la habilidad especial de tu personaje: tienes **un minuto por nivel** para completar el robo, aunque algunas habilidades pueden darte más tiempo.

**Juega gratis:** [the-office-theft.vercel.app](https://the-office-theft.vercel.app)

Funciona en el navegador de escritorio y en el celular; también puedes añadirlo a la pantalla de inicio.

## Cómo se juega

1. **Elige un personaje.** Hay 16 personajes, cada uno con una habilidad propia: puedes distraer a los demás, correr más rápido, pasar inadvertido o robar más deprisa, entre otras ventajas.
2. **Busca los objetos marcados en amarillo.** La lista cambia entre niveles y los objetos aparecen en distintos lugares de la oficina.
3. **Acércate y mantén el botón de robar** hasta recoger cada objeto. Mientras robas no puedes moverte: si alguien te ve haciéndolo, suena la alarma y pierdes el nivel.
4. **Escapa de las miradas y vigila el radar.** Muestra dónde estás tú, dónde están los demás y dónde quedan objetos por recoger.
5. **Supera el nivel antes de que se acabe el tiempo** para pasar al siguiente. La dificultad aumenta: hay más objetos y más compañeros patrullando.

Completa tantos niveles como puedas y registra tu apodo en el menú para aparecer en el **tablón mundial**, donde cuenta primero el nivel alcanzado y luego el tiempo que te sobró.

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Moverse | WASD o flechas | Palanca en pantalla |
| Robar | Mantén `E` | Mantén **ROBAR** |
| Usar habilidad | `Q` | Toca la habilidad |
| Abrir el menú | `Esc` | Botón **MENÚ** |

## Desarrollo

```bash
npm install
npm run dev
npm test
```

Hecho con Vite, Three.js, TypeScript y Tailwind. El tablón de puntuaciones (`api/scores.ts`) usa Upstash Redis y necesita `KV_REST_API_URL` y `KV_REST_API_TOKEN` (`vercel env pull`).

## Art toys NFC

Sin art toy se juega la demo (solo el nivel 1, no se guarda). Cada art toy lleva una etiqueta NFC con una URL `/play/<código>`: el primer tap registra al jugador y los siguientes abren su partida de 10 niveles (`api/play.ts`).

```bash
node scripts/tags.ts 20
```

Emite códigos nuevos: las URLs van a `nfc-tags.csv` (privado, fuera de git; cada URL es una credencial) y sus hashes a `api/_tags.ts`, que hay que versionar y desplegar. Graba cada URL en una etiqueta NTAG213/215 como registro NDEF de tipo URL.

Quien termina la demo puede apuntarse a la lista de espera (`api/waitlist.ts`). Para verla:

```bash
node --env-file=.env.local scripts/waitlist.ts
```

El juego está en español e inglés (`src/i18n.ts`): el español es el texto fuente y `npm test` falla si falta una traducción.

Niveles y objetos se configuran en `src/levels.ts`; las reglas de capturas y progreso están en `src/progress.ts`.

Proyecto de fans sin ánimo de lucro, no afiliado a la serie ni a sus propietarios.
