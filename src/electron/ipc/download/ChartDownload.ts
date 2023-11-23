import { join, parse } from 'path'
import { rimraf } from 'rimraf'

import { NewDownload, ProgressType } from 'src/electron/shared/interfaces/download.interface'
import { DriveFile } from 'src/electron/shared/interfaces/songDetails.interface'
import { emitIPCEvent } from '../../main'
import { hasVideoExtension } from '../../shared/ElectronUtilFunctions'
import { interpolate, sanitizeFilename } from '../../shared/UtilFunctions'
import { getSettings } from '../SettingsHandler.ipc'
import { FileDownloader, getDownloader } from './FileDownloader'
import { FileExtractor } from './FileExtractor'
import { FilesystemChecker } from './FilesystemChecker'
import { FileTransfer } from './FileTransfer'

interface EventCallback {
	/** Note: this will not be the last event if `retry()` is called. */
	'error': () => void
	'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]: EventCallback[E] }

export interface DownloadError { header: string; body: string; isLink?: boolean }

export class ChartDownload {

	private retryFn: () => void | Promise<void>
	private cancelFn: () => void

	private callbacks = {} as Callbacks
	private files: DriveFile[]
	private percent = 0 // Needs to be stored here because errors won't know the exact percent
	private tempPath: string
	private wasCanceled = false

	private readonly individualFileProgressPortion: number
	private readonly destinationFolderName: string

	private _allFilesProgress = 0
	get allFilesProgress() { return this._allFilesProgress }
	private _hasFailed = false
	/** If this chart download needs to be retried */
	get hasFailed() { return this._hasFailed }
	get isArchive() { return this.data.driveData.isArchive }
	get hash() { return this.data.driveData.filesHash }

	constructor(public versionID: number, private data: NewDownload) {
		this.updateGUI('', 'Waiting for other downloads to finish...', 'good')
		this.files = this.filterDownloadFiles(data.driveData.files)
		this.individualFileProgressPortion = 80 / this.files.length
		if (data.driveData.inChartPack) {
			this.destinationFolderName = sanitizeFilename(parse(data.driveData.files[0].name).name)
		} else {
			this.destinationFolderName = sanitizeFilename(`${this.data.artist} - ${this.data.chartName} (${this.data.charter})`)
		}
	}

	/**
	 * Calls `callback` when `event` fires. (no events will be fired after `this.cancel()` is called)
	 */
	on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
		this.callbacks[event] = callback
	}

	filterDownloadFiles(files: DriveFile[]) {
		return files.filter(file => {
			return (file.name != 'ch.dat') && (getSettings().downloadVideos || !hasVideoExtension(file.name))
		})
	}

	/**
	 * Retries the last failed step if it is running.
	 */
	retry() { // Only allow it to be called once
		if (this.retryFn != undefined) {
			this._hasFailed = false
			const retryFn = this.retryFn
			this.retryFn = undefined
			retryFn()
		}
	}

	/**
	 * Updates the GUI to indicate that a retry will be attempted.
	 */
	displayRetrying() {
		this.updateGUI('', 'Waiting for other downloads to finish to retry...', 'good')
	}

	/**
	 * Cancels the download if it is running.
	 */
	cancel() { // Only allow it to be called once
		if (this.cancelFn != undefined) {
			const cancelFn = this.cancelFn
			this.cancelFn = undefined
			cancelFn()
			rimraf(this.tempPath).catch(() => { /** Do nothing */ }) // Delete temp folder
		}
		this.updateGUI('', '', 'cancel')
		this.wasCanceled = true
	}

	/**
	 * Updates the GUI with new information about this chart download.
	 */
	private updateGUI(header: string, description: string, type: ProgressType, isLink = false) {
		if (this.wasCanceled) { return }

		emitIPCEvent('download-updated', {
			versionID: this.versionID,
			title: `${this.data.chartName} - ${this.data.artist}`,
			header: header,
			description: description,
			percent: this.percent,
			type: type,
			isLink,
		})
	}

	/**
	 * Save the retry function, update the GUI, and call the `error` callback.
	 */
	private handleError(err: DownloadError, retry: () => void) {
		this._hasFailed = true
		this.retryFn = retry
		this.updateGUI(err.header, err.body, 'error', err.isLink == true)
		this.callbacks.error()
	}

	/**
	 * Starts the download process.
	 */
	async beginDownload() {
		// CHECK FILESYSTEM ACCESS
		const checker = new FilesystemChecker(this.destinationFolderName)
		this.cancelFn = () => checker.cancelCheck()

		const checkerComplete = this.addFilesystemCheckerEventListeners(checker)
		checker.beginCheck()
		await checkerComplete

		// DOWNLOAD FILES
		for (let i = 0; i < this.files.length; i++) {
			let wasCanceled = false
			this.cancelFn = () => { wasCanceled = true }
			const downloader = getDownloader(this.files[i].webContentLink, join(this.tempPath, this.files[i].name))
			if (wasCanceled) { return }
			this.cancelFn = () => downloader.cancelDownload()

			const downloadComplete = this.addDownloadEventListeners(downloader, i)
			downloader.beginDownload()
			await downloadComplete
		}

		// EXTRACT FILES
		if (this.isArchive) {
			const extractor = new FileExtractor(this.tempPath)
			this.cancelFn = () => extractor.cancelExtract()

			const extractComplete = this.addExtractorEventListeners(extractor)
			extractor.beginExtract()
			await extractComplete
		}

		// TRANSFER FILES
		const transfer = new FileTransfer(this.tempPath, this.destinationFolderName)
		this.cancelFn = () => transfer.cancelTransfer()

		const transferComplete = this.addTransferEventListeners(transfer)
		transfer.beginTransfer()
		await transferComplete

		this.callbacks.complete()
	}

	/**
	 * Defines what happens in reponse to `FilesystemChecker` events.
	 * @returns a `Promise` that resolves when the filesystem has been checked.
	 */
	private addFilesystemCheckerEventListeners(checker: FilesystemChecker) {
		checker.on('start', () => {
			this.updateGUI('Checking filesystem...', '', 'good')
		})

		checker.on('error', this.handleError.bind(this))

		return new Promise<void>(resolve => {
			checker.on('complete', tempPath => {
				this.tempPath = tempPath
				resolve()
			})
		})
	}

	/**
	 * Defines what happens in response to `FileDownloader` events.
	 * @returns a `Promise` that resolves when the download finishes.
	 */
	private addDownloadEventListeners(downloader: FileDownloader, fileIndex: number) {
		let downloadHeader = `[${this.files[fileIndex].name}] (file ${fileIndex + 1}/${this.files.length})`
		let downloadStartPoint = 0 // How far into the individual file progress portion the download progress starts
		let fileProgress = 0

		downloader.on('waitProgress', (remainingSeconds: number, totalSeconds: number) => {
			downloadStartPoint = this.individualFileProgressPortion / 2
			this.percent =
				this._allFilesProgress + interpolate(remainingSeconds, totalSeconds, 0, 0, this.individualFileProgressPortion / 2)
			this.updateGUI(downloadHeader, `Waiting for Google rate limit... (${remainingSeconds}s)`, 'good')
		})

		downloader.on('requestSent', () => {
			fileProgress = downloadStartPoint
			this.percent = this._allFilesProgress + fileProgress
			this.updateGUI(downloadHeader, 'Sending request...', 'good')
		})

		downloader.on('downloadProgress', (bytesDownloaded: number) => {
			downloadHeader = `[${this.files[fileIndex].name}] (file ${fileIndex + 1}/${this.files.length})`
			const size = Number(this.files[fileIndex].size)
			fileProgress = interpolate(bytesDownloaded, 0, size, downloadStartPoint, this.individualFileProgressPortion)
			this.percent = this._allFilesProgress + fileProgress
			this.updateGUI(downloadHeader, `Downloading... (${Math.round(1000 * bytesDownloaded / size) / 10}%)`, 'good')
		})

		downloader.on('error', this.handleError.bind(this))

		return new Promise<void>(resolve => {
			downloader.on('complete', () => {
				this._allFilesProgress += this.individualFileProgressPortion
				resolve()
			})
		})
	}

	/**
	 * Defines what happens in response to `FileExtractor` events.
	 * @returns a `Promise` that resolves when the extraction finishes.
	 */
	private addExtractorEventListeners(extractor: FileExtractor) {
		let archive = ''

		extractor.on('start', filename => {
			archive = filename
			this.updateGUI(`[${archive}]`, 'Extracting...', 'good')
		})

		extractor.on('extractProgress', (percent, filecount) => {
			this.percent = interpolate(percent, 0, 100, 80, 95)
			this.updateGUI(`[${archive}] (${filecount} file${filecount == 1 ? '' : 's'} extracted)`, `Extracting... (${percent}%)`, 'good')
		})

		extractor.on('error', this.handleError.bind(this))

		return new Promise<void>(resolve => {
			extractor.on('complete', () => {
				this.percent = 95
				resolve()
			})
		})
	}

	/**
	 * Defines what happens in response to `FileTransfer` events.
	 * @returns a `Promise` that resolves when the transfer finishes.
	 */
	private addTransferEventListeners(transfer: FileTransfer) {
		let destinationFolder: string

		transfer.on('start', _destinationFolder => {
			destinationFolder = _destinationFolder
			this.updateGUI('Moving files to library folder...', destinationFolder, 'good', true)
		})

		transfer.on('error', this.handleError.bind(this))

		return new Promise<void>(resolve => {
			transfer.on('complete', () => {
				this.percent = 100
				this.updateGUI('Download complete.', destinationFolder, 'done', true)
				resolve()
			})
		})
	}
}
