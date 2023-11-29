import { access, constants, mkdir } from 'fs'
import { join } from 'path'

import { tempPath } from '../../../src-shared/Paths'
import { AnyFunction } from '../../../src-shared/UtilFunctions'
import { devLog } from '../../ElectronUtilFunctions'
import { settings } from '../SettingsHandler.ipc'
import { DownloadError } from './ChartDownload'

interface EventCallback {
	'start': () => void
	'error': (err: DownloadError, retry: () => void | Promise<void>) => void
	'complete': (tempPath: string) => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

const filesystemErrors = {
	libraryError: () => ({ header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' }),
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
		if (settings.libraryPath === undefined) {
			this.callbacks.error(filesystemErrors.libraryError(), () => this.beginCheck())
		} else {
			access(settings.libraryPath, constants.W_OK, this.cancelable(err => {
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
		if (!settings.libraryPath) {
			this.callbacks.error(filesystemErrors.libraryError(), () => this.beginCheck())
		} else {
			const destinationPath = join(settings.libraryPath, this.destinationFolderName)
			access(destinationPath, constants.F_OK, this.cancelable(err => {
				if (err) { // File does not exist
					this.createDownloadFolder()
				} else {
					this.callbacks.error(filesystemErrors.destinationFolderExists(destinationPath), () => this.beginCheck())
				}
			}))
		}
	}

	/**
	 * Attempts to create a unique folder in Bridge's data paths.
	 */
	private async createDownloadFolder(retryCount = 0) {
		const tempChartPath = join(tempPath, `chart_TODO_MAKE_UNIQUE`)

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
		return (...args: Parameters<F>): ReturnType<F> | void => {
			if (this.wasCanceled) { return }
			return fn(...Array.from(args))
		}
	}
}
