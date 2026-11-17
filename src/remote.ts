// Lado del televisor del "celular como mando": abre una sala en el broker público de PeerJS y recibe
// el estado del mando por un canal de datos WebRTC (directo entre dispositivos).
import { Peer, type DataConnection } from 'peerjs'
import { parsePadState, parseToy, peerId, type PadState } from './padState.ts'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin caracteres ambiguos
/** Sin mensajes en este tiempo se da por perdido el celular y se suelta la palanca. */
const SILENCE_MS = 1500

export type RemoteStatus = 'connecting' | 'ready' | 'paired' | 'offline'

export class Remote {
  readonly code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join('')
  private state: PadState | undefined
  private heardAt = 0
  private conn: DataConnection | undefined

  /** `onToy` recibe la credencial de un art toy que un celular envía para entrar a la tele. */
  constructor(onStatus: (status: RemoteStatus) => void, onToy: (toy: string) => void) {
    const peer = new Peer(peerId(this.code))
    onStatus('connecting')
    peer.on('open', () => onStatus('ready'))
    peer.on('disconnected', () => {
      if (!this.conn) onStatus('offline')
      if (!peer.destroyed) peer.reconnect()
    })
    peer.on('error', (err) => {
      console.warn(`Mando por celular: ${err.type}`)
      if (!this.conn) onStatus('offline')
    })
    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        // Un celular que solo trae un art toy no debe desconectar al que está jugando de mando.
        const toy = parseToy(data)
        if (toy) {
          onToy(toy)
          conn.close()
          return
        }
        const next = parsePadState(data)
        if (!next) return
        // Un solo celular de mando a la vez: el último en enviar su palanca sustituye al anterior.
        if (this.conn !== conn) {
          this.conn?.close()
          this.conn = conn
          onStatus('paired')
        }
        this.state = next
        this.heardAt = performance.now()
      })
      conn.on('close', () => {
        if (this.conn !== conn) return
        this.conn = undefined
        this.state = undefined
        onStatus(peer.disconnected ? 'offline' : 'ready')
      })
    })
  }

  /** Último estado del mando, o undefined si no hay celular o dejó de enviar (pantalla apagada, sin red). */
  readonly source = (): PadState | undefined =>
    this.state && performance.now() - this.heardAt < SILENCE_MS ? this.state : undefined
}
