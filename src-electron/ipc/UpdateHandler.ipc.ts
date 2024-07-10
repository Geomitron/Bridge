import electronUpdater from 'electron-updater'
import { inspect } from 'util'

import { UpdateProgress } from '../../src-shared/interfaces/update.interface.js'
import { emitIpcEvent } from '../main.js'

let updateAvailable: boolean | null = false
let downloading = false

electronUpdater.autoUpdater.autoDownload = false
electronUpdater.autoUpdater.logger = null

electronUpdater.autoUpdater.on('error', (err: Error) => {
	updateAvailable = null
	emitIpcEvent('updateError', inspect(err))
})

electronUpdater.autoUpdater.on('update-available', (info: electronUpdater.UpdateInfo) => {
	updateAvailable = true
	emitIpcEvent('updateAvailable', info)
})

electronUpdater.autoUpdater.on('update-not-available', () => {
	updateAvailable = false
	emitIpcEvent('updateAvailable', null)
})


export async function retryUpdate() {
	try {
		await electronUpdater.autoUpdater.checkForUpdates()
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
	return electronUpdater.autoUpdater.currentVersion.raw
}

/**
 * Begins the process of downloading the latest update.
 */
export function downloadUpdate() {
	if (downloading) { return }
	downloading = true

	electronUpdater.autoUpdater.on('download-progress', (updateProgress: UpdateProgress) => {
		emitIpcEvent('updateProgress', updateProgress)
	})

	electronUpdater.autoUpdater.on('update-downloaded', () => {
		emitIpcEvent('updateDownloaded', undefined)
	})

	electronUpdater.autoUpdater.downloadUpdate()
}

/**
 * Immediately closes the application and installs the update.
 */
export function quitAndInstall() {
	electronUpdater.autoUpdater.quitAndInstall() // autoUpdater installs a downloaded update on the next program restart by default
}
