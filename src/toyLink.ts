// Lado del celular de "jugar en la tele con mi art toy": envía la credencial del art toy a la tele
// por un canal WebRTC directo. Solo vive en memoria, igual que la sesión del art toy.
import { Peer } from 'peerjs'
import { peerId } from './padState.ts'

const TIMEOUT_MS = 10_000

/** Rechaza con Error('not-found') si ninguna tele tiene ese código. */
export function sendToy(tvCode: string, toy: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const peer = new Peer()
    const timer = setTimeout(() => finish(new Error('timeout')), TIMEOUT_MS)
    function finish(err?: Error): void {
      clearTimeout(timer)
      peer.destroy()
      if (err) reject(err)
      else resolve()
    }
    peer.on('error', (err) => finish(new Error(err.type === 'peer-unavailable' ? 'not-found' : err.type)))
    peer.on('open', () => {
      const conn = peer.connect(peerId(tvCode), { serialization: 'json' })
      conn.on('error', (err) => finish(err instanceof Error ? err : new Error('connection')))
      // Pequeña espera: cerrar el par al instante puede cortar el mensaje antes de que salga.
      conn.on('open', () => {
        conn.send({ toy })
        setTimeout(() => finish(), 500)
      })
    })
  })
}
