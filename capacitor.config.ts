import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.threatleveltheft.app',
  appName: 'Threat Level: Theft',
  webDir: 'dist',
  // La app abre el juego publicado: el tablón (/api) y las actualizaciones funcionan sin recompilar el APK.
  server: { url: 'https://the-office-theft.vercel.app', cleartext: false },
}

export default config
