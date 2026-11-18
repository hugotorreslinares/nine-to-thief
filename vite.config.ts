import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

/**
 * Sirve api/*.ts en `npm run dev`, igual que Vercel en producción. No lee .env.local: sin
 * KV_REST_API_URL y KV_REST_API_TOKEN en el entorno la API responde 503 y no toca datos reales.
 */
const devApi: Plugin = {
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const name = /^\/api\/(\w+)(?:\?|$)/.exec(req.url ?? '')?.[1]
      if (!name || !req.method) return next()
      try {
        const handlers = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, ((request: Request) => Promise<Response>) | undefined>
        const handler = handlers[req.method]
        if (!handler) return next()
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const response = await handler(new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: { 'Content-Type': req.headers['content-type'] ?? '' },
          body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
        }))
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await response.text())
      } catch (err) {
        next(err)
      }
    })
  },
}

export default defineConfig({
  plugins: [tailwindcss(), devApi],
  // /en es la misma app con metadatos en inglés para compartir; /pad.html es el celular usado como mando de la tele.
  // es2022: el juego espera a cargar el modelo del protagonista antes de arrancar (await al nivel del módulo).
  build: { target: 'es2022', rolldownOptions: { input: { main: 'index.html', en: 'en/index.html', pad: 'pad.html', tv: 'tv/index.html' } } },
})
