import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.ninetothief.app',
  appName: 'Nine to Thief',
  webDir: 'dist',
  // La app abre el juego publicado: el tablón (/api) y las actualizaciones funcionan sin recompilar el APK.
  server: { url: 'https://nine-to-thief.vercel.app', cleartext: false },
}

export default config
