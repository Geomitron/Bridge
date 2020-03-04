import { generateUUID, sanitizeFilename } from '../../shared/UtilFunctions'
import * as fs from 'fs'
import * as path from 'path'
import * as needle from 'needle'
import { GetSettingsHandler } from '../SettingsHandler.ipc'

type EventCallback = {
  'wait': (waitTime: number) => void
  'waitProgress': (secondsRemaining: number, initialWaitTime: number) => void
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
  private readonly RETRY_MAX = 2
  private static fileQueue: { // Stores the overall order that files should be downloaded
    destinationFolder: string
    fileCount: number
    clock?: () => void
  }[]
  private static waitTime: number

  private callbacks = {} as Callbacks
  private retryCount: number
  private wasCanceled = false

  constructor(private url: string, private destinationFolder: string, private numFiles: number, private expectedHash?: string) {
    if (FileDownloader.fileQueue == undefined) {
      // First initialization
      FileDownloader.fileQueue = []
      let lastRateLimitDelay = GetSettingsHandler.getSettings().rateLimitDelay
      FileDownloader.waitTime = 0
      setInterval(() => {
        if (FileDownloader.waitTime > 0) { // Update current countdown if this setting changes
          let newRateLimitDelay = GetSettingsHandler.getSettings().rateLimitDelay
          if (newRateLimitDelay != lastRateLimitDelay) {
            FileDownloader.waitTime -= Math.min(lastRateLimitDelay - newRateLimitDelay, FileDownloader.waitTime - 1)
            lastRateLimitDelay = newRateLimitDelay
          }
          FileDownloader.waitTime--
        }
        FileDownloader.fileQueue.forEach(download => { if (download.clock != undefined) download.clock() })
        if (FileDownloader.waitTime <= 0 && FileDownloader.fileQueue.length != 0) {
          FileDownloader.waitTime = GetSettingsHandler.getSettings().rateLimitDelay
        }
      }, 1000)
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
  beginDownload() {
    // Check that the library folder has been specified
    if (GetSettingsHandler.getSettings().libraryPath == undefined) {
      this.callbacks.error({ header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' }, () => this.beginDownload())
      return
    }

    // Skip the fileQueue if the file is not from Google
    if (!this.url.toLocaleLowerCase().includes('google')) {
      this.requestDownload()
      return
    }
    // The starting point of a progress bar should be recalculated each clock cycle
    // It will be what it would have been if rateLimitDelay was that value the entire time
    this.initWaitTime()
    // This is the number of seconds that had elapsed since the last file download (at the time of starting this download)
    const initialTimeSinceLastDownload = GetSettingsHandler.getSettings().rateLimitDelay - FileDownloader.waitTime
    const initialQueueCount = this.getQueueCount()
    let waitTime = this.getWaitTime(initialTimeSinceLastDownload, initialQueueCount)
    this.callbacks.wait(waitTime)
    if (waitTime == 0) {
      FileDownloader.waitTime = GetSettingsHandler.getSettings().rateLimitDelay
      this.requestDownload()
      return
    }

    const fileQueue = FileDownloader.fileQueue.find(queue => queue.destinationFolder == this.destinationFolder)
    fileQueue.clock = () => {
      if (this.wasCanceled) { this.removeFromQueue(); return } // CANCEL POINT
      waitTime = this.getWaitTime(GetSettingsHandler.getSettings().rateLimitDelay - FileDownloader.waitTime, this.getQueueCount())
      if (waitTime == 0) {
        this.requestDownload()
        fileQueue.clock = undefined
      }
      this.callbacks.waitProgress(waitTime, this.getWaitTime(initialTimeSinceLastDownload, this.getQueueCount()))
    }
  }

  private getWaitTime(timeSinceLastDownload: number, queueCount: number) {
    const rateLimitDelay = GetSettingsHandler.getSettings().rateLimitDelay
    return (queueCount * rateLimitDelay) + Math.max(0, rateLimitDelay - timeSinceLastDownload)
  }

  private initWaitTime() {
    this.retryCount = 0
    const entry = FileDownloader.fileQueue.find(entry => entry.destinationFolder == this.destinationFolder)
    if (entry == undefined) {
      // Note: assumes that either all the chart files are from Google, or none of the chart files are from Google
      FileDownloader.fileQueue.push({ destinationFolder: this.destinationFolder, fileCount: this.numFiles })
    }
  }

  /**
   * Returns the number of files in front of this file in the fileQueue
   */
  private getQueueCount() {
    let fileCount = 0
    for (let entry of FileDownloader.fileQueue) {
      if (entry.destinationFolder != this.destinationFolder) {
        fileCount += entry.fileCount
      } else {
        break
      }
    }

    return fileCount
  }

  private removeFromQueue() {
    const index = FileDownloader.fileQueue.findIndex(entry => entry.destinationFolder == this.destinationFolder)
    FileDownloader.fileQueue.splice(index, 1)
  }

  /**
   * Sends a request to download the file at <this.url>.
   * @param cookieHeader the "cookie=" header to include this request.
   */
  private requestDownload(cookieHeader?: string) {
    if (this.wasCanceled) { this.removeFromQueue(); return } // CANCEL POINT
    this.callbacks.request()
    let uuid = generateUUID()
    const req = needle.get(this.url, {
      follow_max: 10,
      open_timeout: 5000,
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

    req.on('err', (err: Error) => {
      this.callbacks.error({ header: 'Connection Error', body: `${err.name}: ${err.message}` }, () => this.beginDownload())
    })

    req.on('header', (statusCode, headers: Headers) => {
      if (this.wasCanceled) { this.removeFromQueue(); return } // CANCEL POINT
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
          req.pause()
          this.callbacks.warning(() => {
            this.handleDownloadResponse(req, fileName, headers['content-length'])
            req.resume()
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
      const index = FileDownloader.fileQueue.findIndex(entry => entry.destinationFolder == this.destinationFolder)
      FileDownloader.fileQueue[index].fileCount--
      if (FileDownloader.fileQueue[index].fileCount == 0) {
        FileDownloader.fileQueue.splice(index, 1)
      }
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

  cancelDownload() {
    this.wasCanceled = true
  }
}