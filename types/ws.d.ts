declare module 'ws' {
  import { EventEmitter } from 'events'
  import { IncomingMessage } from 'http'

  export type RawData = Buffer | ArrayBuffer | Buffer[]

  export interface WebSocketSendOptions {
    binary?: boolean
  }

  export interface WebSocketClientOptions {
    headers?: Record<string, string>
  }

  class WebSocket extends EventEmitter {
    static readonly OPEN: number
    static readonly CONNECTING: number
    static readonly CLOSING: number
    static readonly CLOSED: number
    readonly readyState: number

    constructor(address: string, options?: WebSocketClientOptions)

    send(data: RawData | string, options?: WebSocketSendOptions): void
    close(code?: number, reason?: string): void

    on(event: 'open', listener: () => void): this
    on(event: 'message', listener: (data: RawData, isBinary: boolean) => void): this
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this
    on(event: 'error', listener: (error: Error) => void): this
  }

  export interface WebSocketServerOptions {
    noServer?: boolean
  }

  class WebSocketServer extends EventEmitter {
    constructor(options?: WebSocketServerOptions)

    handleUpgrade(
      request: IncomingMessage,
      socket: any,
      head: Buffer,
      callback: (client: WebSocket) => void
    ): void
  }

  export { WebSocketServer }
  export default WebSocket
}
