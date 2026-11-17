// Lado del televisor del "celular como mando": abre una sala en el broker público de PeerJS y recibe
// el estado del mando por un canal de datos WebRTC (directo entre dispositivos).
import { Peer, type DataConnection } from 'peerjs'
import { parsePadState, peerId, type PadState } from './padState.ts'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin caracteres ambiguos
/** Sin mensajes en este tiempo se da por perdido el celular y se suelta la palanca. */
const SILENCE_MS = 1500

export type RemoteStatus = 'connecting' | 'ready' | 'paired' | 'offline'

export class Remote {
  readonly code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join('')
  private state: PadState | undefined
  private heardAt = 0
  private conn: DataConnection | undefined

  constructor(onStatus: (status: RemoteStatus) => void) {
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
      // Un solo celular a la vez: el último en conectar sustituye al anterior.
      this.conn?.close()
      this.conn = conn
      conn.on('open', () => onStatus('paired'))
      conn.on('data', (data) => {
        const next = parsePadState(data)
        if (!next) return
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
