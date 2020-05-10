import { AnyFunction } from '../../shared/UtilFunctions'
import { createWriteStream } from 'fs'
import * as needle from 'needle'
// TODO: replace needle with got (for cancel() method) (if before-headers event is possible?)
import { getSettings } from '../SettingsHandler.ipc'
import { googleTimer } from './GoogleTimer'
import { DownloadError } from './ChartDownload'

type EventCallback = {
  'waitProgress': (remainingSeconds: number, totalSeconds: number) => void
  /** Note: this event can be called multiple times if the connection times out or a large file is downloaded */
  'requestSent': () => void
  'downloadProgress': (bytesDownloaded: number) => void
  /** Note: after calling retry, the event lifecycle restarts */
  'error': (err: DownloadError, retry: () => void) => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

const downloadErrors = {
  libraryFolder: () => { return { header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' } },
  timeout: (type: string) => { return { header: 'Timeout', body: `The download server could not be reached. (type=${type})` } },
  connectionError: (err: Error) => { return { header: 'Connection Error', body: `${err.name}: ${err.message}` } },
  responseError: (statusCode: number) => { return { header: 'Connection failed', body: `Server returned status code: ${statusCode}` } },
  htmlError: () => { return { header: 'Invalid response', body: 'Download server returned HTML instead of a file.' } }
}

/**
 * Downloads a file from `url` to `fullPath`.
 * Will handle google drive virus scan warnings. Provides event listeners for download progress.
 * On error, provides the ability to retry.
 * Will only send download requests once every `getSettings().rateLimitDelay` seconds.
 */
export class FileDownloader {
  private readonly RETRY_MAX = 2

  private callbacks = {} as Callbacks
  private retryCount: number
  private wasCanceled = false

  /**
   * @param url The download link.
   * @param fullPath The full path to where this file should be stored (including the filename).
   */
  constructor(private url: string, private fullPath: string) { }

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancelDownload()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Download the file after waiting for the google rate limit.
   */
  beginDownload() {
    console.log('Begin download...')
    if (getSettings().libraryPath == undefined) {
      this.failDownload(downloadErrors.libraryFolder())
    } else {
      googleTimer.on('waitProgress', this.cancelable((remainingSeconds, totalSeconds) => {
        this.callbacks.waitProgress(remainingSeconds, totalSeconds)
      }))

      googleTimer.on('complete', this.cancelable(() => {
        this.requestDownload()
      }))
    }
  }

  /**
   * Sends a request to download the file at `this.url`.
   * @param cookieHeader the "cookie=" header to include this request.
   */
  private requestDownload(cookieHeader?: string) {
    this.callbacks.requestSent()
    const req = needle.get(this.url, {
      'follow_max': 10,
      'open_timeout': 5000,
      'headers': Object.assign({
        'Referer': this.url,
        'Accept': '*/*'
      },
      (cookieHeader ? { 'Cookie': cookieHeader } : undefined)
      )
    })

    req.on('timeout', this.cancelable((type: string) => {
      this.retryCount++
      if (this.retryCount <= this.RETRY_MAX) {
        console.log(`TIMEOUT: Retry attempt ${this.retryCount}...`)
        this.requestDownload(cookieHeader)
      } else {
        this.failDownload(downloadErrors.timeout(type))
      }
    }))

    req.on('err', this.cancelable((err: Error) => {
      this.failDownload(downloadErrors.connectionError(err))
    }))

    req.on('header', this.cancelable((statusCode, headers: Headers) => {
      if (statusCode != 200) {
        this.failDownload(downloadErrors.responseError(statusCode))
        return
      }

      if (headers['content-type'].startsWith('text/html')) {
        this.handleHTMLResponse(req, headers['set-cookie'])
      } else {
        this.handleDownloadResponse(req)
      }
    }))
  }

  /**
   * A Google Drive HTML response to a download request usually means this is the "file too large to scan for viruses" warning.
   * This function sends the request that results from clicking "download anyway", or generates an error if it can't be found.
   * @param req The download request.
   * @param cookieHeader The "cookie=" header of this request.
   */
  private handleHTMLResponse(req: NodeJS.ReadableStream, cookieHeader: string) {
    console.log('HTML Response...')
    let virusScanHTML = ''
    req.on('data', this.cancelable(data => virusScanHTML += data))
    req.on('done', this.cancelable((err: Error) => {
      if (err) {
        this.failDownload(downloadErrors.connectionError(err))
      } else {
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
          this.failDownload(downloadErrors.htmlError())
        }
      }
    }))
  }

  /**
   * Pipes the data from a download response to `this.fullPath`.
   * @param req The download request.
   */
  private handleDownloadResponse(req: NodeJS.ReadableStream) {
    console.log('Download response...')
    this.callbacks.downloadProgress(0)
    let downloadedSize = 0
    req.pipe(createWriteStream(this.fullPath))
    req.on('data', this.cancelable((data) => {
      downloadedSize += data.length
      this.callbacks.downloadProgress(downloadedSize)
    }))

    req.on('err', this.cancelable((err: Error) => {
      this.failDownload(downloadErrors.connectionError(err))
    }))

    req.on('end', this.cancelable(() => {
      this.callbacks.complete()
    }))
  }

  /**
   * Display an error message and provide a function to retry the download.
   */
  private failDownload(error: DownloadError) {
    this.callbacks.error(error, this.cancelable(() => this.beginDownload()))
  }

  /**
   * Stop the process of downloading the file. (no more events will be fired after this is called)
   */
  cancelDownload() {
    this.wasCanceled = true
    googleTimer.cancelTimer() // Prevents timer from trying to activate a download and resetting
  }

  /**
   * Wraps a function that is able to be prevented if `this.cancelDownload()` was called.
   */
  private cancelable<F extends AnyFunction>(fn: F) {
    return (...args: Parameters<F>): ReturnType<F> => {
      if (this.wasCanceled) { return }
      return fn(...Array.from(args))
    }
  }
}