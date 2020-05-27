import { Dirent, readdir as _readdir } from 'fs'
import { promisify } from 'util'
import { getSettings } from '../SettingsHandler.ipc'
import * as mv from 'mv'
import { join } from 'path'
import * as _rimraf from 'rimraf'
import { DownloadError } from './ChartDownload'

const readdir = promisify(_readdir)
const rimraf = promisify(_rimraf)

type EventCallback = {
  'start': (destinationFolder: string) => void
  'error': (err: DownloadError, retry: () => void | Promise<void>) => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

const transferErrors = {
  readError: (err: NodeJS.ErrnoException) => fsError(err, 'Failed to read file.'),
  deleteError: (err: NodeJS.ErrnoException) => fsError(err, 'Failed to delete file.'),
  rimrafError: (err: NodeJS.ErrnoException) => fsError(err, 'Failed to delete folder.'),
  mvError: (err: NodeJS.ErrnoException) => fsError(err, `Failed to move folder to library.${err.code == 'EPERM' ? ' (does the chart already exist?)' : ''}`)
}

function fsError(err: NodeJS.ErrnoException, description: string) {
  return { header: description, body: `${err.name}: ${err.message}` }
}

export class FileTransfer {

  private callbacks = {} as Callbacks
  private wasCanceled = false
  private destinationFolder: string
  private nestedSourceFolder: string // The top-level folder that is copied to the library folder
  constructor(private sourceFolder: string, destinationFolderName: string) {
    this.destinationFolder = join(getSettings().libraryPath, destinationFolderName)
    this.nestedSourceFolder = sourceFolder
  }

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancelTransfer()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
  }

  async beginTransfer() {
    this.callbacks.start(this.destinationFolder)
    await this.cleanFolder()
    if (this.wasCanceled) { return }
    this.moveFolder()
  }

  /**
   * Fixes common problems with the download chart folder.
   */
  private async cleanFolder() {
    let files: Dirent[]
    try {
      files = await readdir(this.nestedSourceFolder, { withFileTypes: true })
    } catch (err) {
      this.callbacks.error(transferErrors.readError(err), () => this.cleanFolder())
      return
    }

    // Remove nested folders
    if (files.length == 1 && !files[0].isFile()) {
      this.nestedSourceFolder = join(this.nestedSourceFolder, files[0].name)
      await this.cleanFolder()
      return
    }

    // Delete '__MACOSX' folder
    for (const file of files) {
      if (!file.isFile() && file.name == '__MACOSX') {
        try {
          await rimraf(join(this.nestedSourceFolder, file.name))
        } catch (err) {
          this.callbacks.error(transferErrors.rimrafError(err), () => this.cleanFolder())
          return
        }
      } else {
        // TODO: handle other common problems, like chart/audio files not named correctly
      }
    }
  }

  /**
   * Moves the downloaded chart to the library path.
   */
  private moveFolder() {
    mv(this.nestedSourceFolder, this.destinationFolder, { mkdirp: true }, (err) => {
      if (err) {
        this.callbacks.error(transferErrors.mvError(err), () => this.moveFolder())
      } else {
        rimraf(this.sourceFolder) // Delete temp folder
        this.callbacks.complete()
      }
    })
  }

  /**
   * Stop the process of transfering the file. (no more events will be fired after this is called)
   */
  cancelTransfer() {
    this.wasCanceled = true
  }
}