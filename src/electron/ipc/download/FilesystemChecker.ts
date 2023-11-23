import { randomBytes as _randomBytes } from 'crypto'
import { access, constants, mkdir } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

import { devLog } from '../../shared/ElectronUtilFunctions'
import { tempPath } from '../../shared/Paths'
import { AnyFunction } from '../../shared/UtilFunctions'
import { getSettings } from '../SettingsHandler.ipc'
import { DownloadError } from './ChartDownload'

const randomBytes = promisify(_randomBytes)

interface EventCallback {
	'start': () => void
	'error': (err: DownloadError, retry: () => void | Promise<void>) => void
	'complete': (tempPath: string) => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

const filesystemErrors = {
	libraryFolder: () => { return { header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' } },
	libraryAccess: (err: NodeJS.ErrnoException) => fsError(err, 'Failed to access library folder.'),
	destinationFolderExists: (destinationPath: string) => {
		return { header: 'This chart already exists in your library folder.', body: destinationPath, isLink: true }
	},
	mkdirError: (err: NodeJS.ErrnoException) => fsError(err, 'Failed to create temporary folder.'),
}

function fsError(err: NodeJS.ErrnoException, description: string) {
	return { header: description, body: `${err.name}: ${err.message}` }
}

export class FilesystemChecker {

	private callbacks = {} as Callbacks
	private wasCanceled = false
	constructor(private destinationFolderName: string) { }

	/**
	 * Calls `callback` when `event` fires. (no events will be fired after `this.cancelDownload()` is called)
	 */
	on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
		this.callbacks[event] = callback
	}

	/**
	 * Check that the filesystem is set up for the download.
	 */
	beginCheck() {
		this.callbacks.start()
		this.checkLibraryFolder()
	}

	/**
	 * Verifies that the user has specified a library folder.
	 */
	private checkLibraryFolder() {
		if (getSettings().libraryPath == undefined) {
			this.callbacks.error(filesystemErrors.libraryFolder(), () => this.beginCheck())
		} else {
			access(getSettings().libraryPath, constants.W_OK, this.cancelable(err => {
				if (err) {
					this.callbacks.error(filesystemErrors.libraryAccess(err), () => this.beginCheck())
				} else {
					this.checkDestinationFolder()
				}
			}))
		}
	}

	/**
	 * Checks that the destination folder doesn't already exist.
	 */
	private checkDestinationFolder() {
		const destinationPath = join(getSettings().libraryPath, this.destinationFolderName)
		access(destinationPath, constants.F_OK, this.cancelable(err => {
			if (err) { // File does not exist
				this.createDownloadFolder()
			} else {
				this.callbacks.error(filesystemErrors.destinationFolderExists(destinationPath), () => this.beginCheck())
			}
		}))
	}

	/**
	 * Attempts to create a unique folder in Bridge's data paths.
	 */
	private async createDownloadFolder(retryCount = 0) {
		const tempChartPath = join(tempPath, `chart_${(await randomBytes(5)).toString('hex')}`)

		mkdir(tempChartPath, this.cancelable(err => {
			if (err) {
				if (retryCount < 5) {
					devLog(`Error creating folder [${tempChartPath}], retrying with a different folder...`)
					this.createDownloadFolder(retryCount + 1)
				} else {
					this.callbacks.error(filesystemErrors.mkdirError(err), () => this.createDownloadFolder())
				}
			} else {
				this.callbacks.complete(tempChartPath)
			}
		}))
	}

	/**
	 * Stop the process of checking the filesystem permissions. (no more events will be fired after this is called)
	 */
	cancelCheck() {
		this.wasCanceled = true
	}

	/**
	 * Wraps a function that is able to be prevented if `this.cancelCheck()` was called.
	 */
	private cancelable<F extends AnyFunction>(fn: F) {
		return (...args: Parameters<F>): ReturnType<F> => {
			if (this.wasCanceled) { return }
			return fn(...Array.from(args))
		}
	}
}
