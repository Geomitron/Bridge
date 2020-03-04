import { DownloadError } from './FileDownloader'
import { readdir as _readdir, unlink as _unlink, lstat as _lstat, copyFile as _copyFile,
  rmdir as _rmdir, access as _access, mkdir as _mkdir, constants } from 'fs'
import { promisify } from 'util'
import { join, extname } from 'path'
import * as node7z from 'node-7z'
import * as zipBin from '7zip-bin'
import * as unrarjs from 'node-unrar-js'
import { GetSettingsHandler } from '../SettingsHandler.ipc'

const readdir = promisify(_readdir)
const unlink = promisify(_unlink)
const lstat = promisify(_lstat)
const copyFile = promisify(_copyFile)
const rmdir = promisify(_rmdir)
const access = promisify(_access)
const mkdir = promisify(_mkdir)

type EventCallback = {
  'extract': (filename: string) => void
  'extractProgress': (percent: number, fileCount: number) => void
  'transfer': (filepath: string) => void
  'complete': (filepath: string) => void
  'error': (error: DownloadError, retry: () => void) => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export class FileExtractor {

  private callbacks = {} as Callbacks
  private libraryFolder: string
  private wasCanceled = false
  constructor(private sourceFolder: string, private isArchive: boolean, private destinationFolderName: string) { }

  /**
   * Calls <callback> when <event> fires.
   * @param event The event to listen for.
   * @param callback The function to be called when the event fires.
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  /**
   * Starts the chart extraction process.
   */
  async beginExtract() {
    this.libraryFolder = (await GetSettingsHandler.getSettings()).libraryPath
    const files = await readdir(this.sourceFolder)
    if (this.isArchive) {
      this.extract(files[0])
    } else {
      this.transfer()
    }
  }

  /**
   * Extracts the file at <filename> to <this.sourceFolder>.
   * @param filename The name of the archive file.
   */
  private extract(filename: string) {
    if (this.wasCanceled) { return } // CANCEL POINT
    this.callbacks.extract(filename)
    const source = join(this.sourceFolder, filename)

    if (extname(filename) == '.rar') {
      // Use node-unrar-js to extract the archive
      try {
        let extractor = unrarjs.createExtractorFromFile(source, this.sourceFolder)
        extractor.extractAll()
      } catch (err) {
        this.callbacks.error({ header: 'Extract Failed.', body: `Unable to extract [${filename}]: ${err.name}` }, () => this.extract(filename))
        return
      }
      this.transfer(source)
    } else {
      // Use node-7z to extract the archive
      const stream = node7z.extractFull(source, this.sourceFolder, { $progress: true, $bin: zipBin.path7za })

      stream.on('progress', (progress: { percent: number, fileCount: number }) => {
        this.callbacks.extractProgress(progress.percent, progress.fileCount)
      })

      stream.on('error', (err: Error) => {
        this.callbacks.error({ header: 'Extract Failed.', body: `Unable to extract [${filename}]: ${err.name}` }, () => this.extract(filename))
      })

      stream.on('end', () => {
        this.transfer(source)
      })
    }
  }

  /**
   * Deletes the archive at <archiveFilepath>, then transfers the extracted chart to <this.libraryFolder>.
   */
  private async transfer(archiveFilepath?: string) {
    if (this.wasCanceled) { return } // CANCEL POINT
    try {
      
      // Create destiniation folder if it doesn't exist
      const destinationFolder = join(this.libraryFolder, this.destinationFolderName)
      this.callbacks.transfer(destinationFolder)
      try {
        await access(destinationFolder, constants.F_OK)
      } catch (e) {
        await mkdir(destinationFolder)
      }

      // Delete archive
      if (archiveFilepath != undefined) {
        await unlink(archiveFilepath)
      }

      // Check if it extracted to a folder instead of a list of files
      let files = await readdir(this.sourceFolder)
      const isFolderArchive = (files.length < 2 && !(await lstat(join(this.sourceFolder, files[0]))).isFile())
      if (isFolderArchive) {
        this.sourceFolder = join(this.sourceFolder, files[0])
        files = await readdir(this.sourceFolder)
      }

      if (this.wasCanceled) { return } // CANCEL POINT

      // Copy the files from the temporary directory to the destination
      for (const file of files) {
        await copyFile(join(this.sourceFolder, file), join(destinationFolder, file))
        await unlink(join(this.sourceFolder, file))
      }

      // Delete the temporary folders
      await rmdir(this.sourceFolder)
      if (isFolderArchive) {
        await rmdir(join(this.sourceFolder, '..'))
      }
      this.callbacks.complete(destinationFolder)
    } catch (e) {
      this.callbacks.error({ header: 'Transfer Failed', body: `Unable to transfer downloaded files to the library folder: ${e.name}` }, undefined)
    }
  }

  cancelExtract() {
    this.wasCanceled = true
  }
}