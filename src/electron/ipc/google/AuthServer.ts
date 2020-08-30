import * as http from 'http'
import { URL } from 'url'
import { REDIRECT_PATH, REDIRECT_BASE, SERVER_PORT } from '../../shared/Paths'

type EventCallback = {
  'listening': () => void
  'authCode': (authCode: string) => Promise<void>
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

class AuthServer {

  private server: http.Server
  private callbacks = {} as Callbacks
  private connections = {}

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancelDownload()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Starts listening on `SERVER_PORT` for the authentication callback.
   * Emits the 'listening' event when the server is ready to listen.
   * Emits the 'authCode' event when the callback request provides the authentication code.
   */
  startServer() {
    if (this.server != null) {
      this.callbacks.listening()
    } else {
      this.server = http.createServer(this.requestListener.bind(this))
      this.server.on('connection', (conn) => {
        const key = conn.remoteAddress + ':' + conn.remotePort
        this.connections[key] = conn
        conn.on('close', () => delete this.connections[key])
      })

      this.server.listen(SERVER_PORT, () => this.callbacks.listening())
    }
  }

  private requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.url.includes(REDIRECT_PATH)) {
      const searchParams = new URL(req.url, REDIRECT_BASE).searchParams
      res.end()
      this.destroyServer()
      this.callbacks.authCode(searchParams.get('code'))
    }
  }

  private destroyServer() {
    this.server.close()
    for (const key in this.connections) {
      this.connections[key].destroy()
    }
    this.server = null
  }
}

export const authServer = new AuthServer()