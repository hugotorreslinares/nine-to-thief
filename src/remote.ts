// Lado del televisor del "celular como mando": abre una sala en el broker público de PeerJS y recibe
// el estado de hasta dos mandos por canales de datos WebRTC (directos entre dispositivos).
import { Peer, type DataConnection } from 'peerjs'
import { parsePadState, parseToy, peerId, type HostMessage, type PadState } from './padState.ts'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin caracteres ambiguos
/** Sin mensajes en este tiempo se suelta la palanca de ese celular (pantalla apagada, sin red). */
const SILENCE_MS = 1500
/** Un celular callado tanto tiempo deja su lugar a otro que quiera entrar. */
const STALE_MS = 10_000

export type RemoteStatus = 'connecting' | 'ready' | 'offline'
export const MAX_PADS = 2

interface Pad {
  readonly conn: DataConnection
  state: PadState
  heardAt: number
}

export class Remote {
  readonly code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join('')
  private readonly pads: (Pad | undefined)[] = Array.from({ length: MAX_PADS }, () => undefined)
  private status: RemoteStatus = 'connecting'
  private readonly onStatus: (status: RemoteStatus, connected: number) => void

  /** `onToy` recibe la credencial de un art toy que un celular envía para entrar a la tele. */
  constructor(onStatus: (status: RemoteStatus, connected: number) => void, onToy: (toy: string) => void) {
    this.onStatus = onStatus
    const peer = new Peer(peerId(this.code))
    this.notify()
    peer.on('open', () => this.setStatus('ready'))
    peer.on('disconnected', () => {
      if (this.connected() === 0) this.setStatus('offline')
      if (!peer.destroyed) peer.reconnect()
    })
    peer.on('error', (err) => {
      console.warn(`Mando por celular: ${err.type}`)
      if (this.connected() === 0) this.setStatus('offline')
    })
    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        // Un celular que solo trae un art toy no debe ocupar un lugar de mando.
        const toy = parseToy(data)
        if (toy) {
          onToy(toy)
          conn.close()
          return
        }
        const next = parsePadState(data)
        if (!next) return
        const known = this.pads.findIndex((pad) => pad?.conn === conn)
        if (known >= 0) {
          const pad = this.pads[known]
          if (pad) {
            pad.state = next
            pad.heardAt = performance.now()
          }
          return
        }
        const slot = this.claimSlot()
        if (slot < 0) {
          conn.send({ full: true } satisfies HostMessage)
          // Cerrar al instante puede cortar el aviso antes de que salga.
          setTimeout(() => conn.close(), 500)
          return
        }
        this.pads[slot] = { conn, state: next, heardAt: performance.now() }
        conn.send({ slot: slot === 0 ? 0 : 1 } satisfies HostMessage)
        this.notify()
      })
      conn.on('close', () => {
        const slot = this.pads.findIndex((pad) => pad?.conn === conn)
        if (slot < 0) return
        this.pads[slot] = undefined
        this.notify()
      })
    })
  }

  /** Primer lugar libre; si hay uno ocupado por un celular que lleva rato callado, lo libera. */
  private claimSlot(): number {
    const now = performance.now()
    const slot = this.pads.findIndex((pad) => !pad || now - pad.heardAt > STALE_MS)
    if (slot >= 0) this.pads[slot]?.conn.close()
    return slot
  }

  private setStatus(next: RemoteStatus): void {
    this.status = next
    this.notify()
  }

  private notify(): void {
    this.onStatus(this.status, this.connected())
  }

  /** Celulares conectados ahora (0, 1 o 2). */
  connected(): number {
    return this.pads.filter((pad) => pad !== undefined).length
  }

  /** Último estado del mando de ese jugador, o undefined si no hay celular o dejó de enviar. */
  readonly source = (slot: number): PadState | undefined => {
    const pad = this.pads[slot]
    return pad && performance.now() - pad.heardAt < SILENCE_MS ? pad.state : undefined
  }
}
