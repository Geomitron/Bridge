import { DownloadError } from './FileDownloader'
import * as fs from 'fs'
import { promisify } from 'util'
import { join, extname } from 'path'
import * as node7z from 'node-7z'
import * as zipBin from '7zip-bin'
import { getSettings } from '../SettingsHandler.ipc'
import { extractRar } from './RarExtractor'

const readdir = promisify(fs.readdir)
const unlink = promisify(fs.unlink)
const lstat = promisify(fs.lstat)
const copyFile = promisify(fs.copyFile)
const rmdir = promisify(fs.rmdir)
const access = promisify(fs.access)
const mkdir = promisify(fs.mkdir)

type EventCallback = {
  'extract': (filename: string) => void
  'extractProgress': (percent: number, fileCount: number) => void
  'transfer': (filepath: string) => void
  'complete': (filepath: string) => void
  'error': (error: DownloadError, retry: () => void | Promise<void>) => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export class FileExtractor {

  private callbacks = {} as Callbacks
  private libraryFolder: string
  private wasCanceled = false
  constructor(private sourceFolder: string, private isArchive: boolean, private destinationFolderName: string) { }

  /**
   * Calls `callback` when `event` fires.
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Starts the chart extraction process.
   */
  async beginExtract() {
    this.libraryFolder = getSettings().libraryPath
    const files = await readdir(this.sourceFolder)
    if (this.isArchive) {
      this.extract(files[0], extname(files[0]) == '.rar')
    } else {
      this.transfer()
    }
  }

  /**
   * Extracts the file at `filename` to `this.sourceFolder`.
   */
  private async extract(filename: string, useRarExtractor: boolean) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 100)) // Wait for filesystem to process downloaded file...
    if (this.wasCanceled) { return } // CANCEL POINT
    this.callbacks.extract(filename)
    const source = join(this.sourceFolder, filename)

    if (useRarExtractor) {

      // Use node-unrar-js to extract the archive
      try {
        await extractRar(source, this.sourceFolder)
      } catch (err) {
        this.callbacks.error({
          header: 'Extract Failed.',
          body: `Unable to extract [${filename}]: ${err}`
        }, () => this.extract(filename, extname(filename) == '.rar'))
        return
      }
      this.transfer(source)

    } else {

      // Use node-7z to extract the archive
      const stream = node7z.extractFull(source, this.sourceFolder, { $progress: true, $bin: zipBin.path7za })

      stream.on('progress', (progress: { percent: number; fileCount: number }) => {
        this.callbacks.extractProgress(progress.percent, progress.fileCount)
      })

      let extractErrorOccured = false
      stream.on('error', () => {
        extractErrorOccured = true
        console.log(`Failed to extract [${filename}], retrying with .rar extractor...`)
        this.extract(filename, true)
      })

      stream.on('end', () => {
        if (!extractErrorOccured) {
          this.transfer(source)
        }
      })

    }
  }

  /**
   * Deletes the archive at `archiveFilepath`, then transfers the extracted chart to `this.libraryFolder`.
   */
  private async transfer(archiveFilepath?: string) {
    // TODO: this fails if the extracted chart has nested folders
    // TODO: skip over "__MACOSX" folder
    // TODO: handle other common problems, like chart/audio files not named correctly
    if (this.wasCanceled) { return } // CANCEL POINT
    try {

      // Create destiniation folder if it doesn't exist
      const destinationFolder = join(this.libraryFolder, this.destinationFolderName)
      this.callbacks.transfer(destinationFolder)
      try {
        await access(destinationFolder, fs.constants.F_OK)
      } catch (e) {
        await mkdir(destinationFolder)
      }

      // Delete archive
      if (archiveFilepath != undefined) {
        try {
          await unlink(archiveFilepath)
        } catch (e) {
          if (e.code != 'ENOENT') {
            throw new Error(`Could not delete the archive file at [${archiveFilepath}]`)
          }
        }
      }

      // Check if it extracted to a folder instead of a list of files
      let sourceFolder = this.sourceFolder
      let files = await readdir(sourceFolder)
      const isFolderArchive = (files.length < 2 && !(await lstat(join(sourceFolder, files[0]))).isFile())
      if (isFolderArchive) {
        sourceFolder = join(sourceFolder, files[0])
        files = await readdir(sourceFolder)
      }

      if (this.wasCanceled) { return } // CANCEL POINT

      // Copy the files from the temporary directory to the destination
      for (const file of files) {
        await copyFile(join(sourceFolder, file), join(destinationFolder, file))
        await unlink(join(sourceFolder, file))
      }

      // Delete the temporary folders
      await rmdir(sourceFolder)
      if (isFolderArchive) {
        await rmdir(join(sourceFolder, '..'))
      }
      this.callbacks.complete(destinationFolder)
    } catch (e) {
      this.callbacks.error({ header: 'Transfer Failed', body: `Unable to transfer downloaded files to the library folder: ${e.name}` }, () => this.transfer(archiveFilepath))
    }
  }

  cancelExtract() {
    this.wasCanceled = true
  }
}