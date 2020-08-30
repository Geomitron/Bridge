import { AnyFunction } from '../../shared/UtilFunctions'
import { createWriteStream } from 'fs'
import * as needle from 'needle'
import { Readable } from 'stream'
// TODO: replace needle with got (for cancel() method) (if before-headers event is possible?)
import { googleTimer } from './GoogleTimer'
import { DownloadError } from './ChartDownload'
import { googleAuth } from '../google/GoogleAuth'
import { google } from 'googleapis'
import Bottleneck from 'bottleneck'
const drive = google.drive('v3')
const limiter = new Bottleneck({
  minTime: 200 // Wait 200 ms between API requests
})

const RETRY_MAX = 2

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
export type FileDownloader = APIFileDownloader | SlowFileDownloader

const downloadErrors = {
  timeout: (type: string) => { return { header: 'Timeout', body: `The download server could not be reached. (type=${type})` } },
  connectionError: (err: Error) => { return { header: 'Connection Error', body: `${err.name}: ${err.message}` } },
  responseError: (statusCode: number) => { return { header: 'Connection failed', body: `Server returned status code: ${statusCode}` } },
  htmlError: () => { return { header: 'Invalid response', body: 'Download server returned HTML instead of a file.' } },
  linkError: (url: string) => { return { header: 'Invalid link', body: `The download link is not formatted correctly: ${url}` } }
}

/**
 * Downloads a file from `url` to `fullPath`.
 * Will handle google drive virus scan warnings. Provides event listeners for download progress.
 * On error, provides the ability to retry.
 * Will only send download requests once every `getSettings().rateLimitDelay` seconds if a Google account has not been authenticated.
 * @param url The download link.
 * @param fullPath The full path to where this file should be stored (including the filename).
 */
export async function getDownloader(url: string, fullPath: string): Promise<FileDownloader> {
  if (await googleAuth.attemptToAuthenticate()) {
    return new APIFileDownloader(url, fullPath)
  } else {
    return new SlowFileDownloader(url, fullPath)
  }
}

/**
 * Downloads a file from `url` to `fullPath`.
 * On error, provides the ability to retry.
 */
class APIFileDownloader {
  private readonly URL_REGEX = /uc\?id=([^&]*)&export=download/u

  private callbacks = {} as Callbacks
  private retryCount: number
  private wasCanceled = false
  private fileID: string
  private downloadStream: Readable

  /**
   * @param url The download link.
   * @param fullPath The full path to where this file should be stored (including the filename).
   */
  constructor(private url: string, private fullPath: string) {
    // url looks like: "https://drive.google.com/uc?id=1TlxtOZlVgRgX7-1tyW0d5QzXVfL-MC3Q&export=download"
    this.fileID = this.URL_REGEX.exec(url)[1]
  }

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
    if (this.fileID == undefined) {
      this.failDownload(downloadErrors.linkError(this.url))
    }

    this.startDownloadStream()
  }

  /**
   * Uses the Google Drive API to start a download stream for the file with `this.fileID`.
   */
  private startDownloadStream() {
    limiter.schedule(this.cancelable(async () => {
      this.callbacks.requestSent()
      try {
        this.downloadStream = (await drive.files.get({
          fileId: this.fileID,
          alt: 'media'
        }, {
          responseType: 'stream'
        })).data

        if (this.wasCanceled) { return }

        this.handleDownloadResponse()
      } catch (err) {
        this.retryCount++
        if (this.retryCount <= RETRY_MAX) {
          console.log(`Failed to get file: Retry attempt ${this.retryCount}...`)
          if (this.wasCanceled) { return }
          this.startDownloadStream()
        } else {
          console.log(err)
          this.failDownload(downloadErrors.responseError(err ? (err.code ?? 'unknown') : 'unknown'))
        }
      }
    }))
  }

  /**
   * Pipes the data from a download response to `this.fullPath`.
   * @param req The download request.
   */
  private handleDownloadResponse() {
    this.callbacks.downloadProgress(0)
    let downloadedSize = 0
    try {
      this.downloadStream.pipe(createWriteStream(this.fullPath))
    } catch (err) {
      this.failDownload(downloadErrors.connectionError(err))
    }

    this.downloadStream.on('data', this.cancelable((chunk: Buffer) => {
      downloadedSize += chunk.length
      this.callbacks.downloadProgress(downloadedSize)
    }))

    this.downloadStream.on('error', this.cancelable((err: Error) => {
      this.failDownload(downloadErrors.connectionError(err))
    }))

    this.downloadStream.on('end', this.cancelable(() => {
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
    if (this.downloadStream) {
      this.downloadStream.destroy()
    }
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

/**
 * Downloads a file from `url` to `fullPath`.
 * Will handle google drive virus scan warnings. Provides event listeners for download progress.
 * On error, provides the ability to retry.
 * Will only send download requests once every `getSettings().rateLimitDelay` seconds.
 */
class SlowFileDownloader {

  private callbacks = {} as Callbacks
  private retryCount: number
  private wasCanceled = false
  private req: NodeJS.ReadableStream

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
    googleTimer.on('waitProgress', this.cancelable((remainingSeconds, totalSeconds) => {
      this.callbacks.waitProgress(remainingSeconds, totalSeconds)
    }))

    googleTimer.on('complete', this.cancelable(() => {
      this.requestDownload()
    }))
  }

  /**
   * Sends a request to download the file at `this.url`.
   * @param cookieHeader the "cookie=" header to include this request.
   */
  private requestDownload(cookieHeader?: string) {
    this.callbacks.requestSent()
    this.req = needle.get(this.url, {
      'follow_max': 10,
      'open_timeout': 5000,
      'headers': Object.assign({
        'Referer': this.url,
        'Accept': '*/*'
      },
      (cookieHeader ? { 'Cookie': cookieHeader } : undefined)
      )
    })

    this.req.on('timeout', this.cancelable((type: string) => {
      this.retryCount++
      if (this.retryCount <= RETRY_MAX) {
        console.log(`TIMEOUT: Retry attempt ${this.retryCount}...`)
        this.requestDownload(cookieHeader)
      } else {
        this.failDownload(downloadErrors.timeout(type))
      }
    }))

    this.req.on('err', this.cancelable((err: Error) => {
      this.failDownload(downloadErrors.connectionError(err))
    }))

    this.req.on('header', this.cancelable((statusCode, headers: Headers) => {
      if (statusCode != 200) {
        this.failDownload(downloadErrors.responseError(statusCode))
        return
      }

      if (headers['content-type'].startsWith('text/html')) {
        this.handleHTMLResponse(headers['set-cookie'])
      } else {
        this.handleDownloadResponse()
      }
    }))
  }

  /**
   * A Google Drive HTML response to a download request usually means this is the "file too large to scan for viruses" warning.
   * This function sends the request that results from clicking "download anyway", or generates an error if it can't be found.
   * @param cookieHeader The "cookie=" header of this request.
   */
  private handleHTMLResponse(cookieHeader: string) {
    let virusScanHTML = ''
    this.req.on('data', this.cancelable(data => virusScanHTML += data))
    this.req.on('done', this.cancelable((err: Error) => {
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
  private handleDownloadResponse() {
    this.callbacks.downloadProgress(0)
    let downloadedSize = 0
    this.req.pipe(createWriteStream(this.fullPath))
    this.req.on('data', this.cancelable((data) => {
      downloadedSize += data.length
      this.callbacks.downloadProgress(downloadedSize)
    }))

    this.req.on('err', this.cancelable((err: Error) => {
      this.failDownload(downloadErrors.connectionError(err))
    }))

    this.req.on('end', this.cancelable(() => {
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
    if (this.req) {
      // TODO: destroy request
    }
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