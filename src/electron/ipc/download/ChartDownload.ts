import { FileDownloader } from './FileDownloader'
import { tempPath } from '../../shared/Paths'
import { join } from 'path'
import { FileExtractor } from './FileExtractor'
import { sanitizeFilename, interpolate } from '../../shared/UtilFunctions'
import { emitIPCEvent } from '../../main'
import { promisify } from 'util'
import { randomBytes as _randomBytes } from 'crypto'
import { mkdir as _mkdir } from 'fs'
import { ProgressType, NewDownload } from 'src/electron/shared/interfaces/download.interface'
import { DriveFile } from 'src/electron/shared/interfaces/songDetails.interface'
import { FileTransfer } from './FileTransfer'

const randomBytes = promisify(_randomBytes)
const mkdir = promisify(_mkdir)

type EventCallback = {
  /** Note: this will not be the last event if `retry()` is called. */
  'error': () => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export type DownloadError = { header: string; body: string }

export class ChartDownload {

  private retryFn: () => void | Promise<void>
  private cancelFn: () => void

  private callbacks = {} as Callbacks
  private files: DriveFile[]
  private percent = 0 // Needs to be stored here because errors won't know the exact percent

  private readonly individualFileProgressPortion: number
  private readonly destinationFolderName: string

  private _allFilesProgress = 0
  get allFilesProgress() { return this._allFilesProgress }
  private _hasFailed = false
  /** If this chart download needs to be retried */
  get hasFailed() { return this._hasFailed }
  get isArchive() { return this.data.driveData.isArchive }

  constructor(public versionID: number, private data: NewDownload) {
    this.updateGUI('', 'Waiting for other downloads to finish...', 'good')
    this.files = data.driveData.files
    this.individualFileProgressPortion = 80 / this.files.length
    this.destinationFolderName = sanitizeFilename(`${this.data.artist} - ${this.data.avTagName} (${this.data.charter})`)
  }

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancel()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Retries the last failed step if it is running.
   */
  retry() { // Only allow it to be called once
    if (this.retryFn != undefined) {
      this._hasFailed = false
      const retryFn = this.retryFn
      this.retryFn = undefined
      retryFn()
    }
  }

  /**
   * Cancels the download if it is running.
   */
  cancel() { // Only allow it to be called once
    if (this.cancelFn != undefined) {
      const cancelFn = this.cancelFn
      this.cancelFn = undefined
      cancelFn()
    }
  }

  /**
   * Updates the GUI with new information about this chart download.
   */
  private updateGUI(header: string, description: string, type: ProgressType) {
    emitIPCEvent('download-updated', {
      versionID: this.versionID,
      title: `${this.data.avTagName} - ${this.data.artist}`,
      header: header,
      description: description,
      percent: this.percent,
      type: type
    })
  }

  /**
   * Save the retry function, update the GUI, and call the `error` callback.
   */
  private handleError(err: DownloadError, retry: () => void) {
    this._hasFailed = true
    this.retryFn = retry
    this.updateGUI(err.header, err.body, 'error')
    this.callbacks.error()
  }

  /**
   * Starts the download process.
   */
  async beginDownload() {
    // CREATE DOWNLOAD DIRECTORY
    let chartPath: string
    try {
      chartPath = await this.createDownloadFolder()
    } catch (err) {
      this.retryFn = () => this.beginDownload()
      this.updateGUI('Access Error', err.message, 'error')
      return
    }

    // DOWNLOAD FILES
    for (let i = 0; i < this.files.length; i++) {
      const downloader = new FileDownloader(this.files[i].webContentLink, chartPath)
      this.cancelFn = () => downloader.cancelDownload()

      const downloadComplete = this.addDownloadEventListeners(downloader, i)
      downloader.beginDownload()
      await downloadComplete
    }

    // EXTRACT FILES
    if (this.isArchive) {
      const extractor = new FileExtractor(chartPath)
      this.cancelFn = () => extractor.cancelExtract()

      const extractComplete = this.addExtractorEventListeners(extractor)
      extractor.beginExtract()
      await extractComplete
    }

    // TRANSFER FILES
    const transfer = new FileTransfer(chartPath, this.destinationFolderName)
    this.cancelFn = () => transfer.cancelTransfer()

    const transferComplete = this.addTransferEventListeners(transfer)
    transfer.beginTransfer()
    await transferComplete

    this.callbacks.complete()
  }

  /**
   * Attempts to create a unique folder in Bridge's data paths.
   * @returns the new folder's path.
   * @throws an error if this fails.
   */
  private async createDownloadFolder() {
    let retryCount = 0
    let chartPath = ''

    while (retryCount < 5) {
      chartPath = join(tempPath, `chart_${(await randomBytes(5)).toString('hex')}`)
      try {
        await mkdir(chartPath)
        return chartPath
      } catch (e) {
        console.log(`Error creating folder [${chartPath}], retrying with a different folder...`)
        retryCount++
      }
    }

    throw new Error(`Bridge was unable to create a directory at [${chartPath}]`)
  }

  /**
   * Defines what happens in response to `FileDownloader` events.
   * @returns a `Promise` that resolves when the download finishes.
   */
  private addDownloadEventListeners(downloader: FileDownloader, fileIndex: number) {
    let downloadHeader = `[${this.files[fileIndex].name}] (file ${fileIndex + 1}/${this.files.length})`
    let fileProgress = 0

    downloader.on('waitProgress', (remainingSeconds: number, totalSeconds: number) => {
      this.percent = this._allFilesProgress + interpolate(remainingSeconds, totalSeconds, 0, 0, this.individualFileProgressPortion / 2)
      this.updateGUI(downloadHeader, `Waiting for Google rate limit... (${remainingSeconds}s)`, 'good')
    })

    downloader.on('requestSent', () => {
      fileProgress = this.individualFileProgressPortion / 2
      this.percent = this._allFilesProgress + fileProgress
      this.updateGUI(downloadHeader, 'Sending request...', 'good')
    })

    downloader.on('downloadProgress', (bytesDownloaded) => {
      downloadHeader = `[${this.files[fileIndex].name}] (file ${fileIndex + 1}/${this.files.length})`
      const size = Number(this.files[fileIndex].size)
      fileProgress = interpolate(bytesDownloaded, 0, size, this.individualFileProgressPortion / 2, this.individualFileProgressPortion)
      this.percent = this._allFilesProgress + fileProgress
      this.updateGUI(downloadHeader, `Downloading... (${Math.round(1000 * bytesDownloaded / size) / 10}%)`, 'fastUpdate')
    })

    downloader.on('error', this.handleError.bind(this))

    return new Promise<void>(resolve => {
      downloader.on('complete', () => {
        this._allFilesProgress += this.individualFileProgressPortion
        resolve()
      })
    })
  }

  /**
   * Defines what happens in response to `FileExtractor` events.
   * @returns a `Promise` that resolves when the extraction finishes.
   */
  private addExtractorEventListeners(extractor: FileExtractor) {
    let archive = ''

    extractor.on('start', (filename) => {
      archive = filename
      this.updateGUI(`[${archive}]`, 'Extracting...', 'good')
    })

    extractor.on('extractProgress', (percent, filecount) => {
      this.percent = interpolate(percent, 0, 100, 80, 95)
      this.updateGUI(`[${archive}] (${filecount} file${filecount == 1 ? '' : 's'} extracted)`, `Extracting... (${percent}%)`, 'fastUpdate')
    })

    extractor.on('error', this.handleError.bind(this))

    return new Promise<void>(resolve => {
      extractor.on('complete', () => {
        this.percent = 95
        resolve()
      })
    })
  }

  /**
   * Defines what happens in response to `FileTransfer` events.
   * @returns a `Promise` that resolves when the transfer finishes.
   */
  private addTransferEventListeners(transfer: FileTransfer) {
    let destinationFolder: string

    transfer.on('start', (_destinationFolder) => {
      destinationFolder = _destinationFolder
      this.updateGUI('Moving files to library folder...', destinationFolder, 'good')
    })

    transfer.on('error', this.handleError.bind(this))

    return new Promise<void>(resolve => {
      transfer.on('complete', () => {
        this.percent = 100
        this.updateGUI('Download complete.', destinationFolder, 'done')
        resolve()
      })
    })
  }
}