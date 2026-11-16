# The Office Theft

Juego de sigilo isométrico para navegador y celular: elige un personaje y roba objetos de la oficina sin que te vean mientras los coges. Un minuto por nivel.

Jugar: https://the-office-theft.vercel.app

## Desarrollo

```bash
npm install
npm run dev
npm test
```

Hecho con Vite, Three.js, TypeScript y Tailwind. El tablón (`api/scores.ts`) usa Upstash Redis; necesita `KV_REST_API_URL` y `KV_REST_API_TOKEN` (`vercel env pull`).

Proyecto de fans sin ánimo de lucro, no afiliado a la serie ni a sus dueños.
