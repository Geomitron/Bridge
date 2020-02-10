import { FileDownloader } from './FileDownloader'
import { IPCEmitHandler } from '../../shared/IPCHandler'
import { createHash, randomBytes as _randomBytes } from 'crypto'
import { tempPath } from '../../shared/Paths'
import { promisify } from 'util'
import { join } from 'path'
import { Download, NewDownload } from '../../shared/interfaces/download.interface'
import { emitIPCEvent } from '../../main'
import { mkdir as _mkdir } from 'fs'
import { FileExtractor } from './FileExtractor'
import { sanitizeFilename, interpolate } from '../../shared/UtilFunctions'

const randomBytes = promisify(_randomBytes)
const mkdir = promisify(_mkdir)

export class AddDownloadHandler implements IPCEmitHandler<'add-download'> {
  event: 'add-download' = 'add-download'

  //TODO: update percent in a way that makes its progress seem as smooth as possible

  async handler(data: NewDownload) {
    const download: Download = {
      versionID: data.versionID,
      title: `${data.avTagName} - ${data.artist}`,
      header: '',
      description: '',
      percent: 0
    }
    const randomString = (await randomBytes(5)).toString('hex')
    const chartPath = join(tempPath, `chart_${randomString}`)
    await mkdir(chartPath)

    let allFilesProgress = 0
    // Only iterate over the keys in data.links that have link values (not hashes)
    const fileKeys = Object.keys(data.links).filter(link => data.links[link].includes('.'))
    const individualFileProgressPortion = 80 / fileKeys.length
    for (let i = 0; i < fileKeys.length; i++) {
      const typeHash = createHash('md5').update(data.links[fileKeys[i]]).digest('hex')
      const downloader = new FileDownloader(data.links[fileKeys[i]], chartPath, data.links[typeHash])
      let fileProgress = 0

      let waitTime: number
      downloader.on('wait', (_waitTime) => {
        download.header = `[${fileKeys[i]}] (file ${i + 1}/${fileKeys.length})`
        download.description = `Waiting for Google rate limit... (${_waitTime}s)`
        waitTime = _waitTime
      })

      downloader.on('waitProgress', (secondsRemaining) => {
        download.description = `Waiting for Google rate limit... (${secondsRemaining}s)`
        fileProgress = interpolate(secondsRemaining, waitTime, 0, 0, individualFileProgressPortion / 2)
        download.percent = allFilesProgress + fileProgress
        emitIPCEvent('download-updated', download)
      })

      downloader.on('request', () => {
        download.description = `Sending request...`
        fileProgress = individualFileProgressPortion / 2
        download.percent = allFilesProgress + fileProgress
        emitIPCEvent('download-updated', download)
      })

      downloader.on('warning', (continueAnyway) => {
        download.description = 'WARNING'
        emitIPCEvent('download-updated', download)
        //TODO: continue anyway
      })

      let filesize = -1
      downloader.on('download', (filename, _filesize) => {
        download.header = `[${filename}] (file ${i + 1}/${fileKeys.length})`
        if (_filesize != undefined) {
          filesize = _filesize
          download.description = `Downloading... (0%)`
        } else {
          download.description = `Downloading... (0 MB)`
        }
        emitIPCEvent('download-updated', download)
      })

      downloader.on('downloadProgress', (bytesDownloaded) => {
        if (filesize != -1) {
          download.description = `Downloading... (${Math.round(1000 * bytesDownloaded / filesize) / 10}%)`
          fileProgress = interpolate(bytesDownloaded, 0, filesize, individualFileProgressPortion / 2, individualFileProgressPortion)
          download.percent = allFilesProgress + fileProgress
        } else {
          download.description = `Downloading... (${Math.round(bytesDownloaded / 1e+5) / 10} MB)`
          download.percent = allFilesProgress + fileProgress
        }
        emitIPCEvent('download-updated', download)
      })

      downloader.on('error', (error, retry) => {
        download.header = error.header
        download.description = error.body
        emitIPCEvent('download-updated', download)
        // TODO: retry
      })

      // Wait for the 'complete' event before moving on to another file download
      await new Promise<void>(resolve => {
        downloader.on('complete', () => {
          emitIPCEvent('download-updated', download)
          allFilesProgress += individualFileProgressPortion
          resolve()
        })

        downloader.beginDownload()
      })
    }

    const destinationFolderName = sanitizeFilename(`${data.artist} - ${data.avTagName} (${data.charter})`)
    const extractor = new FileExtractor(chartPath, fileKeys.includes('archive'), destinationFolderName)

    let archive = ''
    extractor.on('extract', (filename) => {
      archive = filename
      download.header = `[${archive}]`
      download.description = `Extracting...`
      emitIPCEvent('download-updated', download)
    })

    extractor.on('extractProgress', (percent, filecount) => {
      download.header = `[${archive}] (${filecount} file${filecount == 1 ? '' : 's'} extracted)`
      download.description = `Extracting... (${percent}%)`
      download.percent = interpolate(percent, 0, 100, 80, 95)
      emitIPCEvent('download-updated', download)
    })

    extractor.on('transfer', (filepath) => {
      download.header = `Moving files to library folder...`
      download.description = filepath
      download.percent = 95
      emitIPCEvent('download-updated', download)
    })

    extractor.on('complete', (filepath) => {
      download.header = `Download complete.`
      download.description = filepath
      download.percent = 100
      emitIPCEvent('download-updated', download)
    })

    extractor.on('error', (error, retry) => {
      download.header = error.header
      download.description = error.body
      emitIPCEvent('download-updated', download)
      // TODO: retry
    })

    extractor.beginExtract()
  }
}