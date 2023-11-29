import { autoUpdater, UpdateInfo } from 'electron-updater'
import { inspect } from 'util'

import { UpdateProgress } from '../../src-shared/interfaces/update.interface'
import { emitIpcEvent } from '../main'

let updateAvailable: boolean | null = false

autoUpdater.autoDownload = false
autoUpdater.logger = null

autoUpdater.on('error', (err: Error) => {
	updateAvailable = null
	emitIpcEvent('updateError', inspect(err))
})

autoUpdater.on('update-available', (info: UpdateInfo) => {
	updateAvailable = true
	emitIpcEvent('updateAvailable', info)
})

autoUpdater.on('update-not-available', () => {
	updateAvailable = false
	emitIpcEvent('updateAvailable', null)
})


export async function retryUpdate() {
	try {
		await autoUpdater.checkForUpdates()
	} catch (err) {
		updateAvailable = null
		emitIpcEvent('updateError', inspect(err))
	}
}

export async function getUpdateAvailable() {
	return updateAvailable
}

/**
 * @returns the current version of Bridge.
 */
export async function getCurrentVersion() {
	return autoUpdater.currentVersion.raw
}

/**
 * Begins the process of downloading the latest update.
 */
export function downloadUpdate() {
	if (this.downloading) { return }
	this.downloading = true

	autoUpdater.on('download-progress', (updateProgress: UpdateProgress) => {
		emitIpcEvent('updateProgress', updateProgress)
	})

	autoUpdater.on('update-downloaded', () => {
		emitIpcEvent('updateDownloaded', undefined)
	})

	autoUpdater.downloadUpdate()
}

/**
 * Immediately closes the application and installs the update.
 */
export function quitAndInstall() {
	autoUpdater.quitAndInstall() // autoUpdater installs a downloaded update on the next program restart by default
}
