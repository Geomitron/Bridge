import { generateUUID, sanitizeFilename } from '../../shared/UtilFunctions'
import * as fs from 'fs'
import * as path from 'path'
import * as needle from 'needle'
// TODO: replace needle with got (for cancel() method) (if before-headers event is possible?)
import { getSettings } from '../SettingsHandler.ipc'

type EventCallback = {
  'request': () => void
  'warning': (continueAnyway: () => void) => void
  'downloadProgress': (bytesDownloaded: number) => void
  'error': (error: DownloadError, retry: () => void) => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export type DownloadError = { header: string; body: string }

/**
 * Downloads a file from `url` to `destinationFolder` and verifies that its hash matches `expectedHash`.
 * Will handle google drive virus scan warnings. Provides event listeners for download progress.
 * On error, provides the ability to retry.
 */
export class FileDownloader {
  private readonly RETRY_MAX = 2

  private callbacks = {} as Callbacks
  private retryCount: number
  private wasCanceled = false

  /**
   * @param url The download link.
   * @param destinationFolder The path to where this file should be stored.
   * @param expectedHash The hash header value that is expected for this file.
   */
  constructor(private url: string, private destinationFolder: string) { }

  /**
   * Calls `callback` when `event` fires.
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Download the file.
   */
  beginDownload() {
    // Check that the library folder has been specified
    if (getSettings().libraryPath == undefined) {
      this.callbacks.error({ header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' }, () => this.beginDownload())
      return
    }

    this.requestDownload()
  }

  /**
   * Sends a request to download the file at `this.url`.
   * @param cookieHeader the "cookie=" header to include this request.
   */
  private requestDownload(cookieHeader?: string) {
    if (this.wasCanceled) { return } // CANCEL POINT
    this.callbacks.request()
    const uuid = generateUUID()
    const req = needle.get(this.url, {
      'follow_max': 10,
      'open_timeout': 5000,
      'headers': Object.assign({
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

    req.on('err', (err: Error) => {
      this.callbacks.error({ header: 'Connection Error', body: `${err.name}: ${err.message}` }, () => this.beginDownload())
    })

    req.on('header', (statusCode, headers: Headers) => {
      if (this.wasCanceled) { return } // CANCEL POINT
      if (statusCode != 200) {
        this.callbacks.error({ header: 'Connection failed', body: `Server returned status code: ${statusCode}` }, () => this.beginDownload())
        return
      }

      const fileType = headers['content-type']
      if (fileType.startsWith('text/html')) {
        this.handleHTMLResponse(req, headers['set-cookie'])
      } else {
        const fileName = this.getDownloadFileName(headers)
        this.handleDownloadResponse(req, fileName)
      }
    })
  }

  /**
   * A Google Drive HTML response to a download request usually means this is the "file too large to scan for viruses" warning.
   * This function sends the request that results from clicking "download anyway", or throws an error if it can't be found.
   * @param req The download request.
   * @param cookieHeader The "cookie=" header of this request.
   */
  private handleHTMLResponse(req: NodeJS.ReadableStream, cookieHeader: string) {
    let virusScanHTML = ''
    req.on('data', data => virusScanHTML += data)
    req.on('done', (err: Error) => {
      if (!err) {
        try {
          const confirmTokenRegex = /confirm=([0-9A-Za-z\-_]+)&/g
          const confirmTokenResults = confirmTokenRegex.exec(virusScanHTML)
          const confirmToken = confirmTokenResults[1]
          const downloadID = this.url.substr(this.url.indexOf('id=') + 'id='.length)
          this.url = `https://drive.google.com/uc?confirm=${confirmToken}&id=${downloadID}`
          const warningCode = /download_warning_([^=]*)=/.exec(cookieHeader)[1]
          const NID = /NID=([^;]*);/.exec(cookieHeader)[1].replace('=', '%')
          const newHeader = `download_warning_${warningCode}=${confirmToken}; NID=${NID}`
          this.requestDownload(newHeader)
        } catch(e) {
          this.callbacks.error({ header: 'Invalid response', body: 'Download server returned HTML instead of a file.' }, () => this.beginDownload())
        }
      } else {
        this.callbacks.error({ header: 'Connection Failed', body: `Connection failed while downloading HTML: ${err.name}` }, () => this.beginDownload())
      }
    })
  }

  /**
   * Pipes the data from a download response to `fileName`.
   * @param req The download request.
   * @param fileName The name of the output file.
   */
  private handleDownloadResponse(req: NodeJS.ReadableStream, fileName: string) {
    this.callbacks.downloadProgress(0)
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
      if (this.wasCanceled) { return } // CANCEL POINT
      this.callbacks.complete()
    })
  }

  /**
   * Extracts the downloaded file's filename from `headers` or `this.url`, depending on the file's host server.
   * @param headers The response headers for this request.
   */
  private getDownloadFileName(headers: Headers) {
    if (headers['server'] && headers['server'] == 'cloudflare' || this.url.startsWith('https://public.fightthe.pw/')) {
      // Cloudflare and Chorus specific jazz
      return sanitizeFilename(decodeURIComponent(path.basename(this.url)))
    } else {
      // GDrive specific jazz
      const filenameRegex = /filename="(.*?)"/g
      const results = filenameRegex.exec(headers['content-disposition'])
      if (results == null) {
        console.log(`Warning: couldn't find filename in content-disposition header: [${headers['content-disposition']}]`)
        return 'unknownFilename'
      } else {
        return sanitizeFilename(results[1])
      }
    }
  }

  cancelDownload() {
    this.wasCanceled = true
  }
}