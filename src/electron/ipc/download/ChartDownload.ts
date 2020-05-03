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
import { downloadHandler } from './DownloadHandler'
import { googleTimer } from './GoogleTimer'
import { DriveFile } from 'src/electron/shared/interfaces/songDetails.interface'

const randomBytes = promisify(_randomBytes)
const mkdir = promisify(_mkdir)

export class ChartDownload {

  // This changes if the user needs to click 'retry' or 'continue'
  run: () => void | Promise<void> = this.beginDownload.bind(this)
  cancel: () => void

  isArchive: boolean
  title: string
  header: string
  description: string
  percent = 0
  type: ProgressType

  private files: DriveFile[]
  allFilesProgress = 0
  individualFileProgressPortion: number

  constructor(public versionID: number, private data: NewDownload) {
    this.files = data.driveData.files
    this.isArchive = data.driveData.isArchive
    this.individualFileProgressPortion = 80 / this.files.length
  }

  /**
   * Changes this download to reflect that it is waiting in the download queue.
   */
  setInQueue() {
    this.title = `${this.data.avTagName} - ${this.data.artist}`
    this.header = ''
    this.description = 'Waiting for other downloads to finish...'
    this.type = 'good'
    this.cancel = () => { /* do nothing */ }
    emitIPCEvent('download-updated', this)
  }

  /**
   * Starts the download process.
   */
  async beginDownload() {
    // Create a temporary folder to store the downloaded files
    let chartPath: string
    try {
      chartPath = await this.createDownloadFolder()
    } catch (e) {
      this.run = this.beginDownload.bind(this) // Retry action
      this.error('Access Error', e.message)
      return
    }

    // For each download link in <this.files>, download the file to <chartPath>
    for (let i = 0; i < this.files.length; i++) {
      // INITIALIZE DOWNLOADER
      const downloader = new FileDownloader(this.files[i].webContentLink, chartPath)
      const downloadComplete = this.addDownloadEventListeners(downloader, i)

      // DOWNLOAD THE NEXT FILE
      // Wait for google rate limit
      this.header = `[${this.files[i].originalFilename}] (file ${i + 1}/${this.files.length})`
      googleTimer.onTimerUpdate((remainingTime, totalTime) => {
        this.description = `Waiting for Google rate limit... (${remainingTime}s)`
        this.percent = this.allFilesProgress + interpolate(remainingTime, totalTime, 0, 0, this.individualFileProgressPortion / 2)
        this.type = 'good'
        emitIPCEvent('download-updated', this)
      })
      this.cancel = () => {
        googleTimer.removeCallbacks()
        this.onDownloadStop()
        downloader.cancelDownload()
      }
      await new Promise<void>(resolve => googleTimer.onTimerReady(resolve))

      this.cancel = () => {
        this.onDownloadStop()
        downloader.cancelDownload()
      }
      downloader.beginDownload()
      await downloadComplete // Wait for this download to finish
    }

    // INITIALIZE FILE EXTRACTOR
    const destinationFolderName = sanitizeFilename(`${this.data.artist} - ${this.data.avTagName} (${this.data.charter})`)
    const extractor = new FileExtractor(chartPath, this.isArchive, destinationFolderName)
    this.cancel = () => extractor.cancelExtract() // Make cancel button cancel the file extraction
    this.addExtractorEventListeners(extractor)

    // EXTRACT THE DOWNLOADED ARCHIVE
    extractor.beginExtract()
  }

  /**
   * Attempts to create a unique folder in Bridge's data paths. Throws an error if this fails.
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
   * Stops the download and displays an error message.
   */
  private error(header: string, description: string) {
    this.header = header
    this.description = description
    this.type = 'error'
    this.onDownloadStop()
    emitIPCEvent('download-updated', this)
  }

  /**
   * If this was a google download, allows a new google download to start.
   */
  private onDownloadStop() {
    downloadHandler.isGoogleDownloading = false
    downloadHandler.updateQueue()
  }

  /**
   * Defines what happens in response to `FileDownloader` events.
   */
  private addDownloadEventListeners(downloader: FileDownloader, fileIndex: number) {
    let fileProgress = 0

    downloader.on('request', () => {
      this.description = 'Sending request...'
      fileProgress = this.individualFileProgressPortion / 2
      this.percent = this.allFilesProgress + fileProgress
      this.type = 'good'
      emitIPCEvent('download-updated', this)
    })

    downloader.on('warning', (continueAnyway) => {
      this.description = 'WARNING'
      this.run = continueAnyway
      this.type = 'warning'
      this.onDownloadStop()
      emitIPCEvent('download-updated', this)
    })

    downloader.on('downloadProgress', (bytesDownloaded) => {
      const size = Number(this.files[fileIndex].size)
      this.header = `[${this.files[fileIndex].originalFilename}] (file ${fileIndex + 1}/${this.files.length})`
      this.description = `Downloading... (${Math.round(1000 * bytesDownloaded / size) / 10}%)`
      fileProgress = interpolate(bytesDownloaded, 0, size, this.individualFileProgressPortion / 2, this.individualFileProgressPortion)
      this.percent = this.allFilesProgress + fileProgress
      this.type = 'fastUpdate'
      emitIPCEvent('download-updated', this)
    })

    downloader.on('error', (error, retry) => {
      this.header = error.header
      this.description = error.body
      this.type = 'error'
      this.run = () => { retry() }
      this.onDownloadStop()
      emitIPCEvent('download-updated', this)
    })

    // Returns a promise that resolves when the download is finished
    return new Promise<void>(resolve => {
      downloader.on('complete', () => {
        this.allFilesProgress += this.individualFileProgressPortion
        emitIPCEvent('download-updated', this)
        resolve()
      })
    })
  }

  /**
   * Defines what happens in response to `FileExtractor` events.
   */
  private addExtractorEventListeners(extractor: FileExtractor) {
    let archive = ''

    extractor.on('extract', (filename) => {
      archive = filename
      this.header = `[${archive}]`
      this.description = 'Extracting...'
      this.type = 'good'
      emitIPCEvent('download-updated', this)
    })

    extractor.on('extractProgress', (percent, filecount) => {
      this.header = `[${archive}] (${filecount} file${filecount == 1 ? '' : 's'} extracted)`
      this.description = `Extracting... (${percent}%)`
      this.percent = interpolate(percent, 0, 100, 80, 95)
      this.type = 'fastUpdate'
      emitIPCEvent('download-updated', this)
    })

    extractor.on('transfer', (filepath) => {
      this.header = 'Moving files to library folder...'
      this.description = filepath
      this.percent = 95
      this.type = 'good'
      emitIPCEvent('download-updated', this)
    })

    extractor.on('error', (error, retry) => {
      this.header = error.header
      this.description = error.body
      this.type = 'error'
      this.run = retry
      emitIPCEvent('download-updated', this)
    })

    extractor.on('complete', (filepath) => {
      this.header = 'Download complete.'
      this.description = filepath
      this.percent = 100
      this.type = 'done'
      this.onDownloadStop()
      emitIPCEvent('download-updated', this)
    })
  }
}