import { autoUpdater, UpdateInfo } from 'electron-updater'

import { emitIPCEvent } from '../main'
import { IPCEmitHandler, IPCInvokeHandler } from '../shared/IPCHandler'

export interface UpdateProgress {
	bytesPerSecond: number
	percent: number
	transferred: number
	total: number
}

let updateAvailable = false

/**
 * Checks for updates when the program is launched.
 */
class UpdateChecker implements IPCEmitHandler<'retry-update'> {
	event = 'retry-update' as const

	constructor() {
		autoUpdater.autoDownload = false
		autoUpdater.logger = null
		this.registerUpdaterListeners()
	}

	/**
	 * Check for an update.
	 */
	handler() {
		this.checkForUpdates()
	}

	checkForUpdates() {
		autoUpdater.checkForUpdates().catch(reason => {
			updateAvailable = null
			emitIPCEvent('update-error', reason)
		})
	}

	private registerUpdaterListeners() {
		autoUpdater.on('error', (err: Error) => {
			updateAvailable = null
			emitIPCEvent('update-error', err)
		})

		autoUpdater.on('update-available', (info: UpdateInfo) => {
			updateAvailable = true
			emitIPCEvent('update-available', info)
		})

		autoUpdater.on('update-not-available', (info: UpdateInfo) => {
			updateAvailable = false
			emitIPCEvent('update-available', null)
		})
	}
}

export const updateChecker = new UpdateChecker()

/**
 * Handles the 'get-update-available' event.
 */
class GetUpdateAvailableHandler implements IPCInvokeHandler<'get-update-available'> {
	event = 'get-update-available' as const

	/**
	 * @returns `true` if an update is available.
	 */
	handler() {
		return updateAvailable
	}
}

export const getUpdateAvailableHandler = new GetUpdateAvailableHandler()

/**
 * Handles the 'get-current-version' event.
 */
class GetCurrentVersionHandler implements IPCInvokeHandler<'get-current-version'> {
	event = 'get-current-version' as const

	/**
	 * @returns the current version of Bridge.
	 */
	handler() {
		return autoUpdater.currentVersion.raw
	}
}

export const getCurrentVersionHandler = new GetCurrentVersionHandler()

/**
 * Handles the 'download-update' event.
 */
class DownloadUpdateHandler implements IPCEmitHandler<'download-update'> {
	event = 'download-update' as const
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
	event = 'quit-and-install' as const

	/**
	 * Immediately closes the application and installs the update.
	 */
	handler() {
		autoUpdater.quitAndInstall() // autoUpdater installs a downloaded update on the next program restart by default
	}
}

export const quitAndInstallHandler = new QuitAndInstallHandler()
