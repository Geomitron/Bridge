import { generateUUID, sanitizeFilename } from '../../shared/UtilFunctions'
import * as fs from 'fs'
import * as path from 'path'
import * as needle from 'needle'
import InitSettingsHandler from '../InitSettingsHandler.ipc'
type EventCallback = {
  'wait': (waitTime: number) => void
  'waitProgress': (secondsRemaining: number) => void
  'request': () => void
  'warning': (continueAnyway: () => void) => void
  'download': (filename: string, filesize?: number) => void
  'downloadProgress': (bytesDownloaded: number) => void
  'complete': () => void
  'error': (error: DownloadError, retry: () => void) => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export type DownloadError = { header: string, body: string }

export class FileDownloader {
  private RATE_LIMIT_DELAY: number
  private readonly RETRY_MAX = 3
  private static waitTime = 0
  private static clock: NodeJS.Timer

  private callbacks = {} as Callbacks
  private retryCount: number

  constructor(private url: string, private destinationFolder: string, private expectedHash?: string) {
    if (FileDownloader.clock == undefined) {
      FileDownloader.clock = setInterval(() => FileDownloader.waitTime = Math.max(0, FileDownloader.waitTime - 1), 1000)
    }
  }

  /**
   * Calls <callback> when <event> fires.
   * @param event The event to listen for.
   * @param callback The function to be called when the event fires.
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Wait RATE_LIMIT_DELAY seconds between each download,
   * then download the file.
   */
  async beginDownload() {
    const settings = await InitSettingsHandler.getSettings()
    if (settings.libraryPath == undefined) {
      this.callbacks.error({header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.'}, () => this.beginDownload())
      return
    }
    this.RATE_LIMIT_DELAY = (await InitSettingsHandler.getSettings()).rateLimitDelay
    let waitTime = FileDownloader.waitTime
    if (this.url.toLocaleLowerCase().includes('google')) {
      FileDownloader.waitTime += this.RATE_LIMIT_DELAY
    } else {
      waitTime = 0 // Don't rate limit if not downloading from Google
    }
    this.callbacks.wait(waitTime)
    const clock = setInterval(() => {
      waitTime--
      this.callbacks.waitProgress(waitTime)
      if (waitTime <= 0) {
        this.retryCount = 0
        this.requestDownload()
        clearInterval(clock)
      }
    }, 1000)
  }

  /**
   * Sends a request to download the file at <this.url>.
   * @param cookieHeader the "cookie=" header to include this request.
   */
  private requestDownload(cookieHeader?: string) {
    this.callbacks.request()
    let uuid = generateUUID()
    const req = needle.get(this.url, {
      follow_max: 10,
      headers: Object.assign({
        'User-Agent': 'PostmanRuntime/7.22.0',
        'Referer': this.url,
        'Accept': '*/*',
        'Postman-Token': uuid
      },
        (cookieHeader ? { 'Cookie': cookieHeader } : undefined)
      )
    })

    req.on('timeout', (type: string) => {
      this.retryCount++
      if (this.retryCount <= this.RETRY_MAX) {
        console.log(`TIMEOUT: Retry attempt ${this.retryCount}...`)
        this.requestDownload(cookieHeader)
      } else {
        this.callbacks.error({ header: 'Timeout', body: `The download server could not be reached. (type=${type})` }, () => this.beginDownload())
      }
    })

    req.on('err', (err) => {
      // TODO: this is called on timeout; if there are other cases where this can fail, they should be printed correctly
      // this.callbacks.error({ header: 'Error', description: `${err}` }, () => this.beginDownload())
    })

    req.on('header', (statusCode, headers: Headers) => {
      if (statusCode != 200) {
        this.callbacks.error({ header: 'Connection failed', body: `Server returned status code: ${statusCode}` }, () => this.beginDownload())
        return
      }

      let fileType = headers['content-type']
      if (fileType.startsWith('text/html')) {
        this.handleHTMLResponse(req, headers['set-cookie'])
      } else {
        const fileName = this.getDownloadFileName(headers)
        const downloadHash = this.getDownloadHash(headers)
        if (this.expectedHash !== undefined && downloadHash !== this.expectedHash) {
          this.callbacks.warning(() => {
            //TODO: check if this will actually work (or will the data get lost in the time before the button is clicked?)
            // Maybe show the message at the end, and ask if they want to keep it.
            this.handleDownloadResponse(req, fileName, headers['content-length'])
          })
        } else {
          this.handleDownloadResponse(req, fileName, headers['content-length'])
        }
      }
    })
  }

  /**
   * A Google Drive HTML response to a download request means this is the "file too large to scan for viruses" warning.
   * This function sends the request that results from clicking "download anyway".
   * @param req The download request.
   * @param cookieHeader The "cookie=" header of this request.
   */
  private handleHTMLResponse(req: NodeJS.ReadableStream, cookieHeader: string) {
    let virusScanHTML = ''
    req.on('data', data => virusScanHTML += data)
    req.on('done', (err: Error) => {
      if (!err) {
        const confirmTokenRegex = /confirm=([0-9A-Za-z\-_]+)&/g
        const confirmTokenResults = confirmTokenRegex.exec(virusScanHTML)
        if (confirmTokenResults != null) {
          const confirmToken = confirmTokenResults[1]
          const downloadID = this.url.substr(this.url.indexOf('id=') + 'id='.length)
          this.url = `https://drive.google.com/uc?confirm=${confirmToken}&id=${downloadID}`
          const warningCode = /download_warning_([^=]*)=/.exec(cookieHeader)[1]
          const NID = /NID=([^;]*);/.exec(cookieHeader)[1].replace('=', '%')
          const newHeader = `download_warning_${warningCode}=${confirmToken}; NID=${NID}`
          this.requestDownload(newHeader)
        } else {
          this.callbacks.error({ header: 'Invalid response', body: 'Download server returned HTML instead of a file.' }, () => this.beginDownload())
        }
      } else {
        this.callbacks.error({ header: 'Connection Failed', body: `Connection failed while downloading HTML: ${err.name}` }, () => this.beginDownload())
      }
    })
  }

  /**
   * Pipes the data from a download response to <filename> and extracts it if <isArchive> is true.
   * @param req The download request.
   * @param fileName The name of the output file.
   * @param contentLength The number of bytes to be downloaded.
   */
  private handleDownloadResponse(req: NodeJS.ReadableStream, fileName: string, contentLength?: number) {
    this.callbacks.download(fileName, contentLength)
    let downloadedSize = 0
    const filePath = path.join(this.destinationFolder, fileName)
    req.pipe(fs.createWriteStream(filePath))
    req.on('data', (data) => {
      downloadedSize += data.length
      this.callbacks.downloadProgress(downloadedSize)
    })

    req.on('err', (err: Error) => {
      this.callbacks.error({ header: 'Connection Failed', body: `Connection failed while downloading file: ${err.name}` }, () => this.beginDownload())
    })

    req.on('end', () => {
      this.callbacks.complete()
    })
  }

  /**
   * Extracts the downloaded file's filename from <headers> or <url>, depending on the file's host server.
   * @param url The URL of this request.
   * @param headers The response headers for this request.
   */
  private getDownloadFileName(headers: Headers) {
    if (headers['server'] && headers['server'] == 'cloudflare' || this.url.startsWith('https://public.fightthe.pw/')) {
      // Cloudflare and Chorus specific jazz
      return sanitizeFilename(decodeURIComponent(path.basename(this.url)))
    } else {
      // GDrive specific jazz
      const filenameRegex = /filename="(.*?)"/g
      let results = filenameRegex.exec(headers['content-disposition'])
      if (results == null) {
        console.log(`Warning: couldn't find filename in content-disposition header: [${headers['content-disposition']}]`)
        return 'unknownFilename'
      } else {
        return sanitizeFilename(results[1])
      }
    }
  }

  /**
   * Extracts the downloaded file's hash from <headers>, depending on the file's host server.
   * @param url The URL of the request.
   * @param headers The response headers for this request.
   */
  private getDownloadHash(headers: Headers): string {
    if (headers['server'] && headers['server'] == 'cloudflare' || this.url.startsWith('https://public.fightthe.pw/')) {
      // Cloudflare and Chorus specific jazz
      return String(headers['content-length']) // No good hash is provided in the header, so this is the next best thing
    } else {
      // GDrive specific jazz
      return headers['x-goog-hash']
    }
  }
}