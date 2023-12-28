import { randomUUID } from 'crypto'
import EventEmitter from 'events'
import { createWriteStream } from 'fs'
import { access, constants } from 'fs/promises'
import { round, throttle } from 'lodash'
import { mkdirp } from 'mkdirp'
import mv from 'mv'
import { SngStream } from 'parse-sng'
import { join } from 'path'
import { rimraf } from 'rimraf'
import { Readable } from 'stream'
import { ReadableStream } from 'stream/web'
import { inspect } from 'util'

import { tempPath } from '../../../src-shared/Paths'
import { sanitizeFilename } from '../../ElectronUtilFunctions'
import { getSettings } from '../SettingsHandler.ipc'

export interface DownloadMessage {
	header: string
	body: string
	isPath?: boolean
}

interface ChartDownloadEvents {
	'progress': (message: DownloadMessage, percent: number | null) => void
	'error': (err: DownloadMessage) => void
	'end': (destinationPath: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface ChartDownload {
	/**
	 * Registers `listener` to be called when download progress has occured.
	 * `percent` is a number between 0 and 100, or `null` if the progress is indeterminate.
	 * Progress events are throttled to avoid performance issues with rapid updates.
	 */
	on(event: 'progress', listener: (message: DownloadMessage, percent: number | null) => void): void

	/**
	 * Registers `listener` to be called if the download process threw an exception. If this is called, the "end" event won't happen.
	 */
	on(event: 'error', listener: (err: DownloadMessage) => void): void

	/**
	 * Registers `listener` to be called when the chart has been fully downloaded. If this is called, the "error" event won't happen.
	 */
	on(event: 'end', listener: (destinationPath: string) => void): void
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ChartDownload {

	private _canceled = false

	private eventEmitter = new EventEmitter()

	private stepCompletedCount = 0
	private tempPath: string

	private destinationName: string
	private isSng: boolean

	private showProgress = throttle((description: string, percent: number | null = null) => {
		this.eventEmitter.emit('progress', { header: description, body: '' }, percent)
	}, 10, { leading: true, trailing: true })

	constructor(public readonly md5: string, private chartName: string) { }

	on<T extends keyof ChartDownloadEvents>(event: T, listener: ChartDownloadEvents[T]) {
		this.eventEmitter.on(event, listener)
	}

	/**
	 * Checks the target directory to determine if it is accessible.
	 *
	 * Checks the target directory if the chart already exists.
	 *
	 * Downloads the chart to a temporary directory.
	 *
	 * Moves the chart to the target directory.
	 */
	async startOrRetry() {
		try {
			switch (this.stepCompletedCount) {
				case 0: await this.checkFilesystem(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
				case 1: await this.downloadChart(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
				case 2: await this.transferChart(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
			}
		} catch (err) {
			this.showProgress.cancel()
			if (err.header && (err.body || err.body === '')) {
				this.eventEmitter.emit('error', err)
			} else {
				this.eventEmitter.emit('error', { header: 'Unknown Error', body: inspect(err) })
			}
		}
	}

	/**
	 * Cancels the download if it is running.
	 */
	cancel() {
		this.showProgress.cancel()
		this._canceled = true
		if (this.tempPath) {
			rimraf(this.tempPath).catch(() => { /** Do nothing */ }) // Delete temp folder
		}
	}

	private async checkFilesystem() {
		this.showProgress('Loading settings...')
		const settings = await getSettings()
		if (this._canceled) { return }
		if (!settings.libraryPath) {
			throw { header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' }
		}

		try {
			this.showProgress('Checking library path...')
			await access(settings.libraryPath, constants.W_OK)
			if (this._canceled) { return }
		} catch (err) {
			throw { header: 'Failed to access library folder', body: inspect(err) }
		}

		this.isSng = settings.isSng
		this.destinationName = sanitizeFilename(this.isSng ? `${this.chartName}.sng` : this.chartName)
		this.showProgress('Checking for any duplicate charts...')
		const destinationPath = join(settings.libraryPath, this.destinationName)
		const isDuplicate = await access(destinationPath, constants.F_OK).then(() => true).catch(() => false)
		if (this._canceled) { return }
		if (isDuplicate) {
			throw { header: 'This chart already exists in your library folder', body: destinationPath, isPath: true }
		}

		this.tempPath = join(tempPath, randomUUID())
		try {
			this.showProgress('Creating temporary download folder...')
			await mkdirp(this.tempPath)
			if (this._canceled) { return }
		} catch (err) {
			throw { header: 'Failed to create temporary download folder', body: inspect(err) }
		}
	}

	private async downloadChart() {
		const sngResponse = await fetch(`https://files.enchor.us/${this.md5}.sng`, { mode: 'cors', referrerPolicy: 'no-referrer' })
		if (!sngResponse.ok || !sngResponse.body) {
			throw { header: 'Failed to download the chart file', body: `Response code ${sngResponse.status}: ${sngResponse.statusText}` }
		}
		const fileSize = BigInt(sngResponse.headers.get('Content-Length')!)

		if (this.isSng) {
			const sngStream = Readable.fromWeb(sngResponse.body as ReadableStream<Uint8Array>, { highWaterMark: 2e+9 })

			sngStream.pipe(createWriteStream(join(this.tempPath, this.destinationName), { highWaterMark: 2e+9 }))

			await new Promise<void>((resolve, reject) => {
				let downloadedByteCount = BigInt(0)
				sngStream.on('end', resolve)
				sngStream.on('error', err => reject(err))
				sngStream.on('data', data => {
					downloadedByteCount += BigInt(data.length)
					const downloadPercent = round(100 * Number(downloadedByteCount / BigInt(1000)) / Number(fileSize / BigInt(1000)), 1)
					this.showProgress(`Downloading... (${downloadPercent}%)`, downloadPercent)
				})
			})
		} else {
			const sngStream = new SngStream(() => sngResponse.body!, { generateSongIni: true })
			let downloadedByteCount = BigInt(0)

			await mkdirp(join(this.tempPath, this.destinationName))

			await new Promise<void>((resolve, reject) => {
				sngStream.on('file', async (fileName, fileStream) => {
					const nodeFileStream = Readable.fromWeb(fileStream as ReadableStream<Uint8Array>, { highWaterMark: 2e+9 })
					nodeFileStream.pipe(createWriteStream(join(this.tempPath, this.destinationName, fileName), { highWaterMark: 2e+9 }))

					await new Promise<void>((resolve, reject) => {
						nodeFileStream.on('end', resolve)
						nodeFileStream.on('error', err => reject(err))
						nodeFileStream.on('data', data => {
							downloadedByteCount += BigInt(data.length)
							const downloadPercent =
								round(100 * Number(downloadedByteCount / BigInt(1000)) / Number(fileSize / BigInt(1000)), 1)
							this.showProgress(`Downloading "${fileName}"... (${downloadPercent}%)`, downloadPercent)
						})
					})
				})
				sngStream.on('end', resolve)
				sngStream.on('error', err => reject(err))

				sngStream.start()
			})
		}
	}

	private async transferChart() {
		const settings = await getSettings()
		if (this._canceled) { return }

		this.showProgress('Moving chart to library folder...', 100)
		await new Promise<void>((resolve, reject) => {
			if (settings.libraryPath) {
				const destinationPath = join(settings.libraryPath, this.destinationName)
				mv(join(this.tempPath, this.destinationName), destinationPath, { mkdirp: true }, err => {
					if (err) {
						reject({ header: 'Failed to move chart to library folder', body: inspect(err) })
					} else {
						resolve()
					}
				})
			} else {
				reject({ header: 'Library folder not specified', body: 'Please go to the settings to set your library folder.' })
			}
		})

		this.showProgress('Deleting temporary folder...')
		try {
			await rimraf(this.tempPath)
		} catch (err) {
			throw { header: 'Failed to delete temporary folder', body: inspect(err) }
		}

		const destinationPath = join(settings.libraryPath!, this.destinationName)
		this.showProgress.cancel()
		this.eventEmitter.emit('end', destinationPath)
	}
}
