# Modo de dos jugadores (solo televisor)

Fase 2 del juego: dos personas juegan a la vez en la misma tele, cada una con su celular como mando, y se organizan para robar los objetos de la oficina y subir de nivel. Solo aplica al televisor; en escritorio y celular no tiene sentido y no se toca.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Si un vigilante ve robar a alguno | **Pierden los dos**: suena la alarma y el nivel se repite para ambos | Es lo más simple y obliga a coordinarse (uno vigila, el otro roba). Variante "solo cae el atrapado" descartada por ahora: exige diseñar el regreso y el reloj |
| Dificultad con dos | **Más objetos**: unos 40 % más por nivel, con el mismo minuto | Que ir de a dos no sea trivial. Es un valor de partida; se ajusta jugando |
| Cómo se unen | El **mismo QR** de la tele: el primero que escanea es Jugador 1, el segundo Jugador 2. Un tercero recibe "sala llena" | No hace falta otro código ni otra pantalla |
| Elegir personaje | En **el propio celular**, con la lista de nombres y habilidades. **No se puede repetir** | La tele queda libre y cada quien decide sin pisarse |
| Con un solo celular | Se juega como hoy (un jugador) | Sin cambios para quien no use el modo |
| Cámara | **Una sola**, sigue el punto medio entre los dos y se aleja si se separan. Sin pantalla partida | La GPU de la tele (Mali-470) no aguanta dibujar la escena dos veces |
| Quién es quién | Anillo de color propio bajo cada jugador (verde y celeste), nombre sobre la cabeza y su propia gotita de sudor | Se distinguen de un vistazo |
| Objetivo y habilidades | Mismo reloj y misma meta compartida: lo que roba uno cuenta para los dos. Cada uno usa su habilidad con su propia recarga | Cooperativo de verdad |
| Progreso y art toy | Si alguien abre un art toy, la partida avanza en **esa cuenta**. Quien juega sin art toy entra como invitado y no guarda nada | Una cuenta por art toy; el invitado no necesita registro |
| Si un celular se desconecta | La partida **se pausa** unos segundos para que vuelva | Evita perder un nivel por un corte de red |

## Estado

- **Etapa 1: hecha.** Dos celulares se unen con el mismo QR (Jugador 1 y 2), cada uno controla un personaje, la cámara sigue el punto medio y se aleja si se separan, cada jugador tiene su anillo (verde y celeste), su gotita de sudor y su habilidad con recarga propia, el robo cuenta para los dos, la alarma es compartida y hay un 40 % más de objetos. El segundo personaje se asigna solo: Nine si el Jugador 1 no lo eligió, y si no, el primero de la lista. Un tercer celular recibe "Sala llena".
- **Etapa 2: hecha.** Cada celular abre la lista de personajes (botón **ELEGIR PERSONAJE** en la página de mando) y elige el suyo; el que ya tomó el otro aparece ocupado. La tele marca J1 o J2 en el menú y OK desde cualquier celular empieza la partida con lo elegido, incluso desde el póster. Quien no elige recibe uno asignado. Con art toy, el Jugador 1 es siempre el personaje de la cuenta y el segundo no puede repetirlo. Si un celular se va, queda libre su personaje.
- **Etapa 3: hecha, salvo el equilibrio.** Si un celular que ya jugaba el nivel deja de enviar durante 3 s (se cayó la red, apagó la pantalla o cerró la página), la partida se pausa: el reloj y los vigilantes se detienen y sale "PARTIDA EN PAUSA" con una cuenta atrás de 15 s. Si el celular vuelve, sigue donde estaba; si no, la partida continúa sin él (su personaje se queda quieto). La página de mando reintenta conectarse sola cada 2 s (hasta 20 veces) sin tener que recargar. Cada jugador lleva su nombre sobre la cabeza ("J1 · NINE", "J2 · BEA") con el color de su anillo.
- **Equilibrio: pendiente de jugar.** Se afina con partidas reales. Las perillas son `COOP_EXTRA` (fracción de objetos extra, hoy 0,4) en `src/data.ts`, `LEVEL_SECONDS` (el minuto) y `PAUSE_GIVE_UP_S` / `PAD_QUIET_MS` (pausa) en `src/main.ts`.

## Cómo se implementó la etapa 1

- Los objetos extra salen de `extraObjects` (`src/data.ts`) en escritorios libres y no se guardan. Con extras pendientes, el último objeto del nivel se retiene sin guardarse hasta robarlos todos, para que el progreso del art toy no avance si el equipo falla en los extras.
- La cámara usa `coopZoom` (`src/logic.ts`), que calcula el zoom exacto según dónde caen los dos jugadores en la vista isométrica.
- `src/remote.ts` admite dos mandos y responde a cada celular con su jugador (`HostMessage` en `src/padState.ts`).

## Etapas

1. **Dos jugadores jugando.** Dos celulares conectados, cada uno controla un personaje (asignado automáticamente), cámara compartida, anillos de color, robo en equipo, alarma compartida y más objetos.
2. **Elegir personaje desde el celular.** La página de mando muestra la lista; la tele solo confirma (hecho).
3. **Pulido.** Reconexión y pausa (hecho), nombres sobre los jugadores (hecho) y equilibrio de dificultad probado con jugadores reales (pendiente).

## Cambios técnicos previstos

- **Un jugador por todas partes.** Hoy el movimiento, el robo, la habilidad, las recargas, la gotita de sudor y el marcador asumen un único jugador. Hay que pasarlos a un estado por jugador (una lista de jugadores) y recorrerla en cada cuadro.
- **Mando por celular (`src/remote.ts`, `src/padState.ts`).** Hoy admite un solo celular y solo recibe. Debe admitir dos conexiones con un número de jugador y poder responderles (mensajes de la tele al celular: jugador asignado, personajes ocupados, sala llena).
- **Servidor sin cambios.** `api/play.ts` ya guarda el progreso por cuenta; los robos de cualquiera de los dos cuentan sobre la misma cuenta y una captura cuenta una sola vez por alarma.
- **Pruebas.** Lógica pura con `npm test` (reparto de jugadores, unión, mensajes) y comprobación real con la tele y dos pestañas haciendo de celulares.

## Fuera de alcance por ahora

- Pantalla partida, más de dos jugadores y modo competitivo.
- Variante "solo cae el atrapado".
- Dos jugadores en escritorio o celular.
