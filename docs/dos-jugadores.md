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

## Etapas

1. **Dos jugadores jugando.** Dos celulares conectados, cada uno controla un personaje (asignado automáticamente), cámara compartida, anillos de color, robo en equipo, alarma compartida y más objetos.
2. **Elegir personaje desde el celular.** La página de mando muestra la lista; la tele solo confirma.
3. **Pulido.** Reconexión y pausa, equilibrio de dificultad probado con jugadores reales, y detalles de interfaz.

## Cambios técnicos previstos

- **Un jugador por todas partes.** Hoy el movimiento, el robo, la habilidad, las recargas, la gotita de sudor y el marcador asumen un único jugador. Hay que pasarlos a un estado por jugador (una lista de jugadores) y recorrerla en cada cuadro.
- **Mando por celular (`src/remote.ts`, `src/padState.ts`).** Hoy admite un solo celular y solo recibe. Debe admitir dos conexiones con un número de jugador y poder responderles (mensajes de la tele al celular: jugador asignado, personajes ocupados, sala llena).
- **Servidor sin cambios.** `api/play.ts` ya guarda el progreso por cuenta; los robos de cualquiera de los dos cuentan sobre la misma cuenta y una captura cuenta una sola vez por alarma.
- **Pruebas.** Lógica pura con `npm test` (reparto de jugadores, unión, mensajes) y comprobación real con la tele y dos pestañas haciendo de celulares.

## Fuera de alcance por ahora

- Pantalla partida, más de dos jugadores y modo competitivo.
- Variante "solo cae el atrapado".
- Dos jugadores en escritorio o celular.
