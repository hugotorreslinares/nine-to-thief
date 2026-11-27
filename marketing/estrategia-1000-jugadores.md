# Nine to Thief: estrategia para llegar a 1.000 jugadores al mes

Informe para evaluar antes de implementar. Fecha: 27 de noviembre de 2026.

**Aviso sobre las cifras.** Los números de este informe (alcances, costos, conversiones) son estimaciones basadas en rangos típicos de la industria y en mi conocimiento general. No los he medido con datos de Nine to Thief ni verificado precios actuales de las plataformas. Se tratan como hipótesis que se validan con experimentos pequeños (sección 9) antes de comprometer dinero o semanas de trabajo.

---

## 1. Resumen ejecutivo

- **La meta es alcanzable.** 1.000 jugadores al mes son unos 33 por día. Con un juego que se abre al instante en el navegador y sin registro, hace falta llevar unas 2.000 a 2.500 visitas mensuales, porque no todo el que llega pulsa jugar.
- **Recomendación: estrategia mixta, sin depender de un solo canal.** Combinar contenido corto en video (gratis, hecho una vez por semana), publicaciones en comunidades de juegos (gratis, puntuales), mejorar la presencia en itch.io (gratis) y un presupuesto pequeño de anuncios para asegurar el piso mensual (USD 100 a 300).
- **Lo más importante antes de gastar un peso:** medir bien de dónde llega cada jugador (parámetros UTM y eventos) y añadir mecanismos para que cada jugador traiga a otro (compartir resultado, retos). Sin eso no se sabe qué canal funciona.
- **Piso realista con esfuerzo gratuito constante:** 300 a 800 jugadores al mes en 2 a 3 meses, con mucha varianza. Con anuncios pequeños encima, 1.000 es un objetivo razonable para el mes 2 o 3.
- **Riesgos que conviene resolver pronto:** el plan gratuito de Vercel (Hobby) está pensado para uso no comercial y el juego tiene preventa y donaciones; los portales de juegos exigen quitar botones de pago; el límite de uso de la base de datos gratuita. Detalle en la sección 8.

---

## 2. Punto de partida (lo que sé del proyecto)

| Activo | Estado |
|---|---|
| Juego web (Three.js), gratis, sin registro | Funcionando en nine-to-thief.vercel.app |
| Demo | Niveles 1 y 2 gratis; 10 niveles con el art toy (NFC) |
| Idiomas | Español e inglés |
| Plataformas | Navegador (escritorio y celular), app Android TV |
| itch.io | Página publicada (mrmonomalo.itch.io/nine-to-thief) |
| SEO | Sitemap, hreflang, datos estructurados, llms.txt, guías "cómo jugar" |
| Analítica | Vercel Analytics y GTM instalados; eventos personalizados en botones (los eventos personalizados de Vercel pueden requerir plan de pago) |
| Social | Instagram @mrmonomalo; imágenes promocionales ya creadas |
| Retroalimentación | Botón de opinión: 0 comentarios hasta hoy. Lista de espera: 2 inscritos (uno es del propio autor) |
| Mecánicas virales existentes | Tablón mundial, "retos", botón de compartir al ganar |
| Google Play | Preparado pero pospuesto |

**Lectura honesta:** el producto está listo para recibir tráfico, pero casi nadie lo conoce todavía. La base de usuarios actual es muy pequeña, así que cualquier canal parte de cero y no hay datos propios de conversión.

---

## 3. Qué significa "1.000 jugadores al mes"

Hay que definirlo antes de medir. Propuesta:

> **Jugador = persona (navegador o dispositivo) distinta que empieza al menos un nivel en el mes.**

No es lo mismo que visitante (llega a la página) ni que sesión. Con esta definición:

- Embudo estimado: 100 visitas → 50 a 70 abren el juego y ven el menú → 35 a 55 empiezan un nivel (hipótesis).
- Para 1.000 jugadores hacen falta **2.000 a 2.800 visitas únicas al mes**.
- Una pantalla de selección más sencilla (por ejemplo, empezar directo con un personaje) probablemente sube la conversión de visita a jugador. Es una mejora de producto con efecto inmediato sobre cualquier canal.

Metas secundarias recomendadas: **retención a 7 días** (que vuelvan), **tasa de compartir** y **lista de espera / interés en el art toy**, porque el objetivo comercial de fondo es vender el juguete, no solo acumular partidas.

---

## 4. Alternativas gratuitas

Cada fila indica esfuerzo, potencial estimado de jugadores al mes en un buen caso y variabilidad. "Potencial" es una hipótesis, no una promesa.

### 4.1 Contenido corto en video (TikTok, Reels, YouTube Shorts)

- **Qué es:** clips de 15 a 30 segundos de la jugada: robar sin que te vean, el momento de susto, el personaje con su historia graciosa, el art toy junto a la pantalla. Publicar 3 a 5 por semana en las tres plataformas con el mismo video.
- **Por qué encaja:** el juego es visual, gracioso y se entiende en segundos; el art toy físico es muy fotogénico.
- **Esfuerzo:** medio (grabar pantalla, editar, subtítulos). Se puede grabar un lote por semana.
- **Potencial:** muy variable. Regla aproximada: entre 0,5 % y 2 % de las vistas termina en una visita. Un video con 50.000 vistas podría traer 250 a 1.000 visitas. La mayoría no despega.
- **Clave:** enlace en la biografía, un gancho en los primeros 2 segundos y repetir formatos que funcionen.
- **Riesgo:** resultados irregulares; requiere constancia de varios meses.

### 4.2 Comunidades y foros de juegos

- **Reddit:** r/WebGames, r/playmygame, r/IndieGaming, r/IndieDev y comunidades en español de videojuegos. Publicar con contexto ("hice este juego de sigilo, ¿qué opinan?"), respetar las reglas de autopromoción de cada comunidad y participar en los comentarios.
- **Show HN (Hacker News):** un juego 3D que corre en el navegador sin descarga suele interesar a esa audiencia. Resultado muy variable (de casi nada a miles de visitas en un día).
- **Discord:** servidores de desarrollo indie y de juegos casuales; secciones de "muestra tu juego".
- **Foros y plataformas:** Newgrounds, Game Jolt, IndieDB, TIGSource.
- **Esfuerzo:** bajo a medio, por publicación.
- **Potencial:** 100 a 1.500 jugadores por una buena publicación; ráfagas de un día, poca cola.
- **Riesgo:** moderadores pueden borrar publicaciones vistas como promoción; las comunidades indie dan buena crítica pero poco volumen sostenido.

### 4.3 Optimizar itch.io

- **Qué hacer:** usar el texto ya preparado (`marketing/itch/description.md`), capturas y portada, etiquetas bien elegidas, publicar **devlogs** periódicos (cada devlog aparece en el feed de seguidores), pedir feedback en la sección de comentarios y participar en **game jams** (hay jams temáticas con miles de participantes que juegan y comentan los juegos de otros).
- **Esfuerzo:** bajo a medio.
- **Potencial:** modesto por sí solo (decenas a unos cientos al mes); mejora mucho con jams y con tráfico externo que apunte ahí, porque itch.io premia el tráfico propio.
- **Nota:** verificar fechas y reglas de las jams antes de planear; algunas exigen crear el juego dentro del evento.

### 4.4 Portales de juegos web (CrazyGames, Poki, Y8, Kongregate, GameDistribution, Newgrounds)

- **Qué es:** plataformas que reciben juegos HTML5 y los distribuyen a su propia audiencia, normalmente con reparto de ingresos por publicidad.
- **Potencial:** el mayor de todas las opciones gratuitas. Un juego aceptado en un portal grande puede recibir miles de partidas al mes sin esfuerzo adicional.
- **Obstáculos:**
  - Procesos de aprobación selectivos; hay que cumplir requisitos de calidad y rendimiento.
  - Exigen integrar su SDK (anuncios, eventos) y suelen **prohibir enlaces externos, donaciones y pagos** dentro del juego. Habría que preparar una **versión para portales** sin los botones Apóyame, Preventa y art toy, o con una variante aceptable.
  - El juego usa 3D con Three.js: hay que verificar rendimiento en equipos modestos.
  - La audiencia del portal no pasa por el sitio propio, así que **no sirve para vender el art toy** salvo que el portal permita un enlace a una marca. Cuenta como "jugadores", no como clientes.
- **Esfuerzo:** alto (versión específica, solicitud, integración del SDK).
- **Recomendación:** dejarlo para el mes 2 o 3, si la versión actual ya muestra buena retención.

### 4.5 Comunidad local, amigos y entorno cercano

- Grupo de WhatsApp de vecinos (imagen y texto ya preparados), grupos de familiares y amigos, comunidades de colegio o universidad, grupos de vecinos de otros barrios, grupos de creadores locales.
- **Potencial:** 50 a 200 jugadores, de una sola vez, con feedback valioso y de confianza.
- **Esfuerzo:** muy bajo. **Es el mejor primer paso para conseguir los primeros comentarios**, que hoy son cero.

### 4.6 Micro-creadores y streamers pequeños (sin pagar)

- Escribir a 30 o 50 creadores pequeños (de 500 a 20.000 seguidores) que hacen videos de juegos indie, juegos de navegador o "juegos cortos": ofrecer acceso gratis y, si les interesa, una versión del juego con su nombre o un personaje con su cara como guiño.
- **Potencial:** bajo por creador, pero acumulable; también produce contenido reutilizable.
- **Esfuerzo:** medio (investigar y escribir mensajes personalizados). Tasa de respuesta típica baja, por eso hay que escribir a muchos.

### 4.7 Mecánicas de producto que traen más jugadores

Gratis para el bolsillo, requieren desarrollo. Son las que multiplican el efecto de todo lo demás.

1. **Compartir resultado con enlace** (ya existe el botón; mejorar la tarjeta con el puntaje, el personaje y un reto "supera mi tiempo").
2. **Reto diario o semanal** con tablón propio: una razón para volver y para compartir.
3. **Invitar a un amigo** (modo de a dos) con un enlace que arranque la partida cooperativa.
4. **Entrada más corta al juego**, con menos pasos antes de jugar (más conversión de visita a jugador).
5. **Instalar como app (PWA)** y recordatorios simples para recuperar jugadores.
6. **Códigos QR** en el empaque del art toy y en las publicaciones, que abran directamente el juego (con parámetros que distingan el origen).

### 4.8 SEO y descubrimiento por inteligencia artificial

- Ya está hecho el trabajo técnico base. Falta lo que más pesa: **enlaces entrantes** (menciones en blogs, listas de "mejores juegos de navegador", directorios, wikis de juegos indie) y un **dominio propio** en lugar de `vercel.app`, que da más confianza y es más fácil de recordar.
- **Search Console y Bing Webmaster:** enviar el sitemap y vigilar la indexación (queda pendiente en el lado del usuario).
- **Potencial:** crece lento, pero es tráfico gratuito y estable a 3 a 6 meses. Poco útil como canal principal para el primer mes.

### 4.9 Eventos y ferias (presencial)

- Ferias de cómics, juguetes de colección y videojuegos; mercados de diseñadores; tiendas de juguetes de arte. Una mesa pequeña con el art toy y un celular o una pantalla para probar el juego con un QR.
- **Potencial:** dos a cuatro cientos de jugadores por evento bien elegido, más ventas de juguete en el lugar.
- **Esfuerzo y costo:** alto en tiempo y a menudo con costo de stand. Verificar fechas, requisitos y costos de cada feria local.

---

## 5. Alternativas de pago

### 5.1 Anuncios en Meta (Instagram y Facebook)

- **Ideal para este caso:** el creativo (imagen o video del juego) ya existe y se puede segmentar por país, edad e intereses (videojuegos, juegos casuales, coleccionismo).
- **Costo estimado (hipótesis):** en Colombia el costo por clic suele ser bajo, del orden de USD 0,02 a 0,10; el costo por jugador, contando que solo parte de los clics termina en una partida, **entre USD 0,10 y 0,40**. Eso daría USD 100 a 400 por 1.000 jugadores. Hay que medirlo con una prueba pequeña.
- **Formatos recomendados:** video corto de la jugada con botón "Jugar ahora"; campaña de tráfico o de interacción con destino al juego.
- **Riesgos:** tráfico de baja calidad (clics que rebotan), audiencia que no vuelve. Medir retención y no solo clics.

### 5.2 Anuncios en TikTok

- Costos similares o algo menores por vista; muy buen formato para juegos casuales. Requiere videos nativos (no anuncios reciclados de imagen).
- **Costo estimado:** del orden de USD 0,10 a 0,50 por jugador (hipótesis). Presupuesto mínimo diario suele ser bajo.

### 5.3 Anuncios en Google (Ads) y campañas de app

- **Búsqueda:** palabras como "juego de sigilo en el navegador" tienen poca competencia pero también poco volumen; útil como complemento, no como canal principal.
- **Campañas de instalación de app (Android):** requieren que la app esté publicada en Google Play. Solo tiene sentido cuando se retome la publicación.

### 5.4 Influencers y creadores pagados

- **Micro-creadores** (5.000 a 50.000 seguidores) por una publicación o video: en Colombia puede ir de unos COP 100.000 a varios cientos de miles, según el tamaño (rangos orientativos, hay que cotizar).
- **Ventaja:** audiencia que ya confía en el creador y contenido que luego se reutiliza.
- **Riesgo:** resultado difícil de predecir; conviene pagar por canje (el juguete como regalo) o por rendimiento antes que una tarifa fija alta.

### 5.5 Anuncios en Reddit, X y newsletters

- Reddit Ads y patrocinios en newsletters de juegos indie o de desarrollo: audiencia calificada, costo por jugador más alto (probablemente USD 0,50 o más) y tráfico en inglés. Útil para pruebas puntuales, no como motor.

### 5.6 Promoción dentro de itch.io y portales

- itch.io permite destacar juegos en ciertas ofertas y colecciones de pago; los portales a veces ofrecen posicionamiento pagado. Evaluar caso por caso; suele rendir poco para un juego sin historial.

### 5.7 Herramientas que apoyan (no atraen jugadores por sí solas)

- Dominio propio (USD 10 a 15 al año), plan de Vercel que permita uso comercial y eventos personalizados, edición de video (CapCut tiene versión gratuita), GA4 y GTM (gratuitos).

---

## 6. Comparación resumida

| Canal | Costo | Esfuerzo | Potencial mensual (hipótesis) | Velocidad | Recomendación |
|---|---|---|---|---|---|
| Comunidad local / WhatsApp | USD 0 | Muy bajo | 50 a 200 (una vez) | Inmediata | **Hacer ya** |
| Reddit y comunidades indie | USD 0 | Bajo a medio | 100 a 1.500 por buena publicación | Días | **Hacer en semanas 2 a 4** |
| Video corto orgánico | USD 0 | Medio, constante | 100 a 1.000+ (muy variable) | Semanas a meses | **Base del plan** |
| Mejorar itch.io y devlogs | USD 0 | Bajo a medio | 50 a 300 | Semanas | Hacer |
| Mecánicas virales en el juego | Tiempo de desarrollo | Medio | Multiplica los demás canales | Semanas | **Prioridad alta** |
| Meta Ads | USD 100 a 400 por 1.000 jugadores | Bajo a medio | Previsible: sube con el presupuesto | Días | **Probar con USD 20 y escalar** |
| TikTok Ads | Similar a Meta | Medio (videos) | Previsible | Días | Probar después de Meta |
| Micro-creadores pagados | COP 100.000 a 500.000 por pieza | Medio | 50 a 500 por pieza | Semanas | Probar 2 o 3 |
| Portales (CrazyGames, etc.) | USD 0 (versión específica) | Alto | Miles potencialmente | 1 a 3 meses | Mes 2 o 3 |
| SEO y enlaces | USD 0 a 15 | Medio, lento | Crece con el tiempo | 3 a 6 meses | Mantener |
| Ferias y eventos | Variable | Alto | 200 a 400 por evento | Según fecha | Evaluar a futuro |
| Google Ads / apps | Variable | Medio | Bajo al inicio | Semanas | Después de Google Play |

---

## 7. Presupuestos y escenarios para llegar a 1.000

Los porcentajes son estimaciones de aporte; la suma depende de qué tan bien salgan las publicaciones.

### Escenario A: solo gratuito (USD 0)

- Comunidad local: 100
- Una a dos publicaciones en Reddit o Hacker News: 200 a 600
- Video corto orgánico (constante): 100 a 400
- itch.io y devlogs: 50 a 150
- **Total estimado: 450 a 1.250 al mes**, con mucha incertidumbre. Es posible llegar a 1.000 en el mes 2 o 3 con constancia.

### Escenario B: gratuito más anuncios pequeños (USD 100 a 150 al mes)

- Todo lo del escenario A, más Meta Ads con USD 100 a 150 (500 a 1.000 jugadores adicionales con un costo de USD 0,10 a 0,30).
- **Total estimado: 800 a 1.500 al mes.** Es el escenario que recomiendo para tener un piso seguro.

### Escenario C: más presión (USD 300 a 500 al mes)

- Anuncios en Meta y TikTok, 2 a 3 micro-creadores, dominio propio.
- **Total estimado: 1.500 a 3.000 al mes.** Solo tiene sentido si la prueba confirma que los jugadores de pago vuelven y que el juego retiene.

### Qué hacer con el dinero

- No gastar más de USD 20 hasta tener los eventos y UTM funcionando.
- Pausar cualquier campaña donde el costo por jugador supere el doble de lo previsto después de unos USD 20 a 30 de prueba.
- Evaluar canales por **retención a 7 días y clics en la lista de espera**, no solo por costo por jugador.

---

## 8. Riesgos y puntos a resolver antes de escalar

1. **Plan de Vercel Hobby.** Está pensado para uso personal no comercial. El juego tiene preventa y donaciones, y con anuncios aumentaría la exposición. Conviene revisar los términos vigentes y, si aplica, pasar al plan Pro (que además habilita eventos personalizados de analítica). Verificar precios actuales.
2. **Límites de la base de datos gratuita (Redis/KV).** El tablón, el progreso y las puntuaciones hacen llamadas por partida. Con 1.000 jugadores al mes probablemente alcanza, pero hay que revisar cuotas actuales y activar alertas.
3. **Portales y política de pagos.** Los portales y Google Play suelen restringir pagos externos y donaciones dentro del juego. Hay que decidir qué botones se ocultan en cada versión.
4. **Menores y publicidad.** Si la audiencia incluye niños, las plataformas de anuncios y la privacidad (COPPA y equivalentes, política de datos) aplican con más rigor. Mantener la política de privacidad actualizada y evitar recolectar datos innecesarios.
5. **Medición.** Sin UTM, eventos y una definición única de "jugador", cualquier decisión será una suposición. Es el primer entregable de ingeniería.
6. **Dependencia de la varianza.** Los canales orgánicos fluctúan mucho; no planificar ingresos ni compromisos sobre una publicación que "podría" funcionar.
7. **Rendimiento.** Más tráfico significa más dispositivos modestos. Verificar el rendimiento real en celulares de gama baja antes de anunciar a escala (hoy solo se probó en navegador de escritorio y con GPU por software).

---

## 9. Plan de 90 días (propuesta)

### Semanas 0 a 1: base de medición y primer contacto
- Añadir **parámetros UTM** en todos los enlaces y registrar el origen del primer ingreso.
- Definir y registrar el evento "empieza nivel" (jugador) y "termina nivel", "comparte", "abre feedback", "se une a la lista de espera".
- Publicar en el grupo de WhatsApp de vecinos. Objetivo: 50 jugadores y los **primeros 10 comentarios**.
- Revisar el flujo de entrada: reducir pasos antes de jugar si se puede.

### Semanas 2 a 4: primeros canales
- Grabar 12 a 15 clips cortos en lote y publicarlos 3 a 5 por semana.
- Una publicación en Reddit (con contexto y reglas respetadas) y, si hay buen resultado, un Show HN.
- Devlog en itch.io con novedades (carrusel de personajes, historias, efectos).
- **Prueba de anuncios:** USD 20 en Meta durante 5 a 7 días para medir costo real por jugador y retención.
- Mejorar la tarjeta para compartir y añadir el reto por enlace.

### Mes 2: escalar lo que funciona
- Si el costo por jugador es aceptable, subir el presupuesto a USD 100 a 150 al mes.
- Contactar 30 a 50 micro-creadores; probar 2 o 3 pagos o por canje.
- Añadir reto diario o semanal con tablón.
- Dominio propio y envío de sitemap a Search Console y Bing.

### Mes 3: ampliar
- Preparar la versión para portales y enviar solicitud a uno o dos.
- Retomar Google Play (publicación pendiente) y evaluar campañas de app.
- Evaluar una feria o evento local si el calendario lo permite.
- Revisión de resultados: ¿qué canal dio jugadores que vuelven y se interesan por el art toy?

---

## 10. Indicadores a seguir (tablero mensual)

| Indicador | Qué indica | Meta orientativa |
|---|---|---|
| Jugadores únicos del mes | Meta principal | 1.000 |
| Visitas únicas por canal (UTM) | Qué canal trae | Seguir semanalmente |
| Conversión visita a jugador | Calidad de entrada | Por encima del 40 % |
| Costo por jugador (pago) | Eficiencia | Por debajo de USD 0,30 |
| Retención a 7 días | Calidad del jugador | 15 % a 25 % (a validar) |
| Partidas por jugador | Enganche | 3 o más |
| Tasa de compartir | Viralidad | 3 % a 8 % de los jugadores |
| Inscritos en lista de espera / clics en preventa | Valor comercial | Crecer cada mes |
| Comentarios de feedback | Aprendizaje | 10 el primer mes |

---

## 11. Recomendación final y primeros pasos (esta semana)

1. **Definir "jugador" y registrar el evento** de inicio de nivel con UTM (la base de todo).
2. **Publicar en el grupo de vecinos** para conseguir los primeros jugadores y comentarios.
3. **Grabar un lote de 10 a 12 clips cortos** y programar su publicación.
4. **Hacer una prueba de USD 20 en Meta** con el video más claro, para conocer el costo real por jugador.
5. **Mejorar la tarjeta de compartir** y añadir el reto por enlace.

Con estos cinco pasos, en 2 a 4 semanas habrá datos propios para decidir si el camino al 1.000 es principalmente orgánico, de pago o mixto.

## 12. Decisiones que necesito de ti

- ¿Cuánto presupuesto mensual estás dispuesto a invertir al inicio (USD 0, 50, 150, 300)?
- ¿Cuántas horas por semana puedes dedicar a contenido (video, publicaciones)?
- ¿La meta es solo jugadores o también venta del art toy? Cambia qué canales priorizar (los portales dan jugadores pero no ventas).
- ¿Aceptas preparar una versión sin botones de pago para portales y Google Play?
- ¿Quieres un dominio propio (por ejemplo, ninetothief.com)?
- ¿Cuál es la audiencia principal: Colombia, Latinoamérica o también inglés?

Con tus respuestas puedo convertir este informe en un plan semanal con tareas concretas y empezar por la medición y la mecánica de compartir.

## Medición implementada

Cada evento de Vercel Analytics lleva `src` (de `?utm_source=`, `?ref=` o el dominio de referencia; fija por pestaña). Eventos nuevos: `level_start`, `level_win`, `level_lose` (con `level`).

Define "jugador" = `level_start` de un visitante. Enlaces por canal (cambia `utm_source`):

- WhatsApp: `https://nine-to-thief.vercel.app/?utm_source=whatsapp`
- Reddit: `?utm_source=reddit`
- TikTok / Reels: `?utm_source=tiktok`
- Meta Ads: `?utm_source=meta`
- itch.io: `?utm_source=itch`

En Vercel Analytics: Events → `level_start`, filtra por propiedad `src`.
