import { IPCEmitHandler, IPCInvokeHandler } from '../shared/IPCHandler'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { emitIPCEvent } from '../main'

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

/**
 * Checks for updates when the program is launched.
 */
class UpdateChecker {

  constructor() {
    autoUpdater.autoDownload = false
    autoUpdater.logger = null
    this.registerUpdaterListeners()
    autoUpdater.checkForUpdates()
  }

  private registerUpdaterListeners() {
    autoUpdater.on('error', (err: Error) => {
      console.log('error callback', err)
      emitIPCEvent('update-error', err)
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('update available callback', info)
      emitIPCEvent('update-available', info)
    })
  }
}

new UpdateChecker()

/**
 * Handles the 'get-current-version' event.
 */
class GetCurrentVersionHandler implements IPCInvokeHandler<'get-current-version'> {
  event: 'get-current-version' = 'get-current-version'

  /**
   * @returns the current version of Bridge.
   */
  handler() {
    console.log('Printing version:', autoUpdater.currentVersion.raw)
    return autoUpdater.currentVersion.raw // TODO: display this on the about page
  }
}

export const getCurrentVersionHandler = new GetCurrentVersionHandler()

/**
 * Handles the 'download-update' event.
 */
class DownloadUpdateHandler implements IPCEmitHandler<'download-update'> {
  event: 'download-update' = 'download-update'
  downloading = false

  /**
   * Begins the process of downloading the latest update.
   */
  handler() {
    if (this.downloading) { return }
    this.downloading = true

    autoUpdater.on('download-progress', (updateProgress: UpdateProgress) => {
      emitIPCEvent('update-progress', updateProgress)
    })

    autoUpdater.on('update-downloaded', () => {
      emitIPCEvent('update-downloaded', undefined)
    })

    autoUpdater.downloadUpdate()
  }
}

export const downloadUpdateHandler = new DownloadUpdateHandler()

/**
 * Handles the 'quit-and-install' event.
 */
class QuitAndInstallHandler implements IPCEmitHandler<'quit-and-install'> {
  event: 'quit-and-install' = 'quit-and-install'

  /**
   * Immediately closes the application and installs the update.
   */
  handler() {
    autoUpdater.quitAndInstall() // autoUpdater installs a downloaded update on the next program restart by default
  }
}

export const quitAndInstallHandler = new QuitAndInstallHandler()