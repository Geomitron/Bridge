import { readdir, unlink, mkdir as _mkdir } from 'fs'
import { promisify } from 'util'
import { join, extname } from 'path'
import { AnyFunction } from 'src/electron/shared/UtilFunctions'
import * as node7z from 'node-7z'
import * as zipBin from '7zip-bin'
import * as unrarjs from 'node-unrar-js' // TODO find better rar library that has async extraction
import { FailReason } from 'node-unrar-js/dist/js/extractor'
import { DownloadError } from './ChartDownload'

const mkdir = promisify(_mkdir)

type EventCallback = {
  'start': (filename: string) => void
  'extractProgress': (percent: number, fileCount: number) => void
  'error': (err: DownloadError, retry: () => void | Promise<void>) => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

const extractErrors = {
  readError: (err: NodeJS.ErrnoException) => { return { header: `Failed to read file (${err.code})`, body: `${err.name}: ${err.message}` } },
  emptyError: () => { return { header: 'Failed to extract archive', body: 'File archive was downloaded but could not be found' } },
  rarmkdirError: (err: NodeJS.ErrnoException, sourceFile: string) => {
    return { header: `Extracting archive failed. (${err.code})`, body: `${err.name}: ${err.message} (${sourceFile})`}
  },
  rarextractError: (result: { reason: FailReason; msg: string }, sourceFile: string) => {
    return { header: `Extracting archive failed: ${result.reason}`, body: `${result.msg} (${sourceFile})`}
  }
}

export class FileExtractor {

  private callbacks = {} as Callbacks
  private wasCanceled = false
  constructor(private sourceFolder: string) { }

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancelDownload()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Extract the chart from `this.sourceFolder`. (assumes there is exactly one archive file in that folder)
   */
  beginExtract() {
    setTimeout(this.cancelable(() => {
      readdir(this.sourceFolder, (err, files) => {
        if (err) {
          this.callbacks.error(extractErrors.readError(err), () => this.beginExtract())
        } else if (files.length == 0) {
          this.callbacks.error(extractErrors.emptyError(), () => this.beginExtract())
        } else {
          this.callbacks.start(files[0])
          this.extract(join(this.sourceFolder, files[0]), extname(files[0]) == '.rar')
        }
      })
    }), 100) // Wait for filesystem to process downloaded file
  }

  /**
   * Extracts the file at `fullPath` to `this.sourceFolder`.
   */
  private async extract(fullPath: string, useRarExtractor: boolean) {
    if (useRarExtractor) {
      await this.extractRar(fullPath) // Use node-unrar-js to extract the archive
    } else {
      this.extract7z(fullPath) // Use node-7z to extract the archive
    }
  }

  /**
   * Extracts a .rar archive found at `fullPath` and puts the extracted results in `this.sourceFolder`.
   * @throws an `ExtractError` if this fails.
   */
  private async extractRar(fullPath: string) {
    const extractor = unrarjs.createExtractorFromFile(fullPath, this.sourceFolder)

    const fileList = extractor.getFileList()

    if (fileList[0].state != 'FAIL') {

      // Create directories for nested archives (because unrarjs didn't feel like handling that automatically)
      const headers = fileList[1].fileHeaders
      for (const header of headers) {
        if (header.flags.directory) {
          try {
            await mkdir(join(this.sourceFolder, header.name), { recursive: true })
          } catch (err) {
            this.callbacks.error(extractErrors.rarmkdirError(err, fullPath), () => this.extract(fullPath, extname(fullPath) == '.rar'))
            return
          }
        }
      }
    }

    const extractResult = extractor.extractAll()

    if (extractResult[0].state == 'FAIL') {
      this.callbacks.error(extractErrors.rarextractError(extractResult[0], fullPath), () => this.extract(fullPath, extname(fullPath) == '.rar'))
    } else {
      this.deleteArchive(fullPath)
    }
  }

  /**
   * Extracts a .zip or .7z archive found at `fullPath` and puts the extracted results in `this.sourceFolder`.
   */
  private extract7z(fullPath: string) {
    const zipBinPath = zipBin.path7za.replace('app.asar', 'app.asar.unpacked') // I love electron-builder packaging :)
    const stream = node7z.extractFull(fullPath, this.sourceFolder, { $progress: true, $bin: zipBinPath })

    stream.on('progress', this.cancelable((progress: { percent: number; fileCount: number }) => {
      this.callbacks.extractProgress(progress.percent, isNaN(progress.fileCount) ? 0 : progress.fileCount)
    }))

    let extractErrorOccured = false
    stream.on('error', this.cancelable((err) => {
      extractErrorOccured = true
      this.callbacks.error({ header: '7zip Error', body: err }, () => this.extract(fullPath, extname(fullPath) == '.rar'))
      // console.log(`Failed to extract [${fullPath}]; retrying with .rar extractor...`)
      // this.extract(fullPath, true)
    }))

    stream.on('end', this.cancelable(() => {
      if (!extractErrorOccured) {
        this.deleteArchive(fullPath)
      }
    }))
  }

  /**
   * Tries to delete the archive at `fullPath`.
   */
  private deleteArchive(fullPath: string) {
    unlink(fullPath, this.cancelable((err) => {
      if (err && err.code != 'ENOENT') {
        console.log(`Warning: failed to delete archive at [${fullPath}]`)
      }

      this.callbacks.complete()
    }))
  }

  /**
   * Stop the process of extracting the file. (no more events will be fired after this is called)
   */
  cancelExtract() {
    this.wasCanceled = true
  }

  /**
   * Wraps a function that is able to be prevented if `this.cancelExtract()` was called.
   */
  private cancelable<F extends AnyFunction>(fn: F) {
    return (...args: Parameters<F>): ReturnType<F> => {
      if (this.wasCanceled) { return }
      return fn(...Array.from(args))
    }
  }
}