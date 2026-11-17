# Nine to Thief

Un juego de sigilo en el que te cuelas en una oficina para llevarte todo lo que puedas sin que tus compañeros te descubran. Controla a Nine, el ladrón enmascarado, o a otro de los personajes, esquiva a quienes patrullan y aprovecha la habilidad especial de tu personaje: tienes **un minuto por nivel** para completar el robo, aunque algunas habilidades pueden darte más tiempo.

**Juega gratis:** [nine-to-thief.vercel.app](https://nine-to-thief.vercel.app)

Funciona en el navegador de escritorio y en el celular (también puedes añadirlo a la pantalla de inicio) y tiene una app para **Android TV**: [nine-to-thief.vercel.app/tv](https://nine-to-thief.vercel.app/tv/).

## Cómo se juega

1. **Elige un personaje.** Hay 16: **Nine**, el protagonista (el del art toy), y 15 oficinistas originales. Cada uno tiene una habilidad propia: puedes distraer a los demás, correr más rápido, pasar inadvertido o robar más deprisa, entre otras ventajas.
2. **Busca los objetos marcados en amarillo.** La lista cambia entre niveles y los objetos aparecen en distintos lugares de la oficina.
3. **Acércate y mantén el botón de robar** hasta recoger cada objeto. Mientras robas no puedes moverte: si alguien te ve haciéndolo, suena la alarma y pierdes el nivel.
4. **Escapa de las miradas y vigila el radar.** Muestra dónde estás tú, dónde están los demás y dónde quedan objetos por recoger. Cuando un vigilante te tiene en su cono de visión, te sale una gotita de sudor sobre la cabeza.
5. **Supera el nivel antes de que se acabe el tiempo** para pasar al siguiente. La dificultad aumenta: hay más objetos y más compañeros patrullando.

Completa tantos niveles como puedas y registra tu apodo en el menú para aparecer en el **tablón mundial**, donde cuenta primero el nivel alcanzado y luego el tiempo que te sobró.

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Moverse | WASD o flechas | Palanca en pantalla |
| Robar | Mantén `E` | Mantén **ROBAR** |
| Usar habilidad | `Q` | Toca la habilidad |
| Abrir el menú | `Esc` | Botón **MENÚ** |

En la tele: flechas, **OK** (mantener para robar), **Play/Pausa** para la habilidad y **Atrás** para el menú. También se puede usar el celular como mando (ver Android TV).

## Desarrollo

```bash
npm install
npm run dev
npm test
```

Hecho con Vite, Three.js (fijada en r162), TypeScript y Tailwind. El tablón de puntuaciones (`api/scores.ts`) usa Upstash Redis y necesita `KV_REST_API_URL` y `KV_REST_API_TOKEN` (`vercel env pull`).

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

Con art toy se juega siempre con **Nine**. Niveles y objetos se configuran en `src/levels.ts`; los personajes (aspecto, habilidad, sitio en la oficina) en `src/data.ts`; las reglas de capturas y progreso en `src/progress.ts`.

**Direcciones:** el juego vive en `nine-to-thief.vercel.app`, pero las etiquetas NFC ya grabadas llevan la dirección antigua `the-office-theft.vercel.app` y no se pueden reescribir. Ambas apuntan al mismo proyecto de Vercel: **no borres la dirección antigua**.

Todos los personajes y situaciones son ficticios.

## Android TV

App Capacitor en `android/` que abre el juego publicado (`server.url` en `capacitor.config.ts`), así que las actualizaciones web llegan sin recompilar el APK. El APK se compila en GitHub Actions (workflow **Android APK**):

```bash
gh run download --name nine-to-thief-apk --dir release/android
adb connect IP_DE_LA_TELE:5555
adb install -r release/android/app-debug.apk
```

- **Descarga pública:** la página `/tv/` explica la instalación y `/apk` redirige a la última versión, publicada en la release `tv` de este repositorio cada vez que se sube a `main`.
- Mando a distancia: flechas, OK (mantener para robar), Play/Pausa (habilidad) y Atrás (menú, y salir desde el menú).
- Celular como mando: el póster del televisor muestra un QR y un código de 5 letras que abren `/pad.html` y conectan por WebRTC (PeerJS), con palanca y botones.
- **Dos jugadores:** si se conectan dos celulares con el mismo QR, juegan de a dos en la misma tele (ver abajo).
- **Jugar en la tele con art toy:** se abre el art toy en el celular, se toca "Jugar en la tele" y se escribe el código de la tele. La credencial viaja directa del celular a la tele y solo vive en memoria (`src/toyLink.ts`). La tele solo entra con art toys ya registrados.
- Televisores con GPU débil (Mali-470) solo dan WebGL 1: por eso Three.js está fijada en r162, la última con soporte, y hay un modo ligero (`src/device.ts`) sin sombras y con menos polígonos.
- APK de depuración: cada compilación lleva otra firma, desinstala antes de actualizar.
- Identificador de la app: `dev.ninetothief.app`.

## Dos jugadores en la tele

Modo cooperativo con dos celulares en el mismo televisor: escanean el mismo QR (el primero es el Jugador 1, el segundo el 2), cada uno controla a su personaje y entre los dos roban los objetos del nivel, con un 40 % más de objetos. Si un vigilante ve robar a cualquiera de los dos, pierden los dos. Un tercer celular recibe "Sala llena".

Hecho: la etapa 1 (dos jugadores jugando). Pendiente: elegir personaje desde el celular y pausar si uno se desconecta. Decisiones y plan en [docs/dos-jugadores.md](docs/dos-jugadores.md).
