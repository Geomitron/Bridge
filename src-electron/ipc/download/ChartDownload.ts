import { randomUUID } from 'crypto'
import EventEmitter from 'events'
import { createWriteStream } from 'fs'
import { ensureDir, move, remove } from 'fs-extra'
import { access, constants } from 'fs/promises'
import { IncomingMessage } from 'http'
import https from 'https'
import _ from 'lodash'
import { SngStream } from 'parse-sng'
import { join } from 'path'
import { Readable } from 'stream'
import { ReadableStream } from 'stream/web'
import { inspect } from 'util'

import { tempPath } from '../../../src-shared/Paths.js'
import { resolveChartFolderName } from '../../../src-shared/UtilFunctions.js'
import { getSettings } from '../SettingsHandler.ipc.js'

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

	private chartFolderPath: string
	private isSng: boolean

	private showProgress = _.throttle((description: string, percent: number | null = null) => {
		this.eventEmitter.emit('progress', { header: description, body: '' }, percent)
	}, 10, { leading: true, trailing: true })

	constructor(
		public readonly md5: string,
		private chart: { name: string; artist: string; album: string; genre: string; year: string; charter: string },
	) { }

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
			remove(this.tempPath).catch(() => { /** Do nothing */ }) // Delete temp folder
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
		this.chartFolderPath = resolveChartFolderName(settings.chartFolderName, this.chart) + (this.isSng ? '.sng' : '')
		this.showProgress('Checking for any duplicate charts...')
		const destinationPath = join(settings.libraryPath, this.chartFolderPath)
		const isDuplicate = await access(destinationPath, constants.F_OK).then(() => true).catch(() => false)
		if (this._canceled) { return }
		if (isDuplicate) {
			throw { header: 'This chart already exists in your library folder', body: destinationPath, isPath: true }
		}

		this.tempPath = join(tempPath, randomUUID()) + (this.isSng ? '.sng' : '')
	}

	private async downloadChart() {
		const { response, abortController } = await getDownloadStream(this.md5)
		const fileSize = BigInt(response.headers['content-length']!)

		if (this.isSng) {
			response.pipe(createWriteStream(this.tempPath, { highWaterMark: 2e+9 }))

			await new Promise<void>((resolve, reject) => {
				let downloadedByteCount = BigInt(0)
				response.on('end', resolve)
				response.on('error', err => reject(err))
				response.on('data', data => {
					downloadedByteCount += BigInt(data.length)
					const downloadPercent = _.round(100 * Number(downloadedByteCount / BigInt(1000)) / Number(fileSize / BigInt(1000)), 1)
					this.showProgress(`Downloading... (${downloadPercent}%)`, downloadPercent)
					if (this._canceled) {
						abortController.abort()
					}
				})
			})
		} else {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sngStream = new SngStream(Readable.toWeb(response) as any, { generateSongIni: true })
			let downloadedByteCount = BigInt(0)

			await ensureDir(this.tempPath)

			await new Promise<void>((resolve, reject) => {
				sngStream.on('file', async (fileName, fileStream, nextFile) => {
					const nodeFileStream = Readable.fromWeb(fileStream as ReadableStream<Uint8Array>, { highWaterMark: 2e+9 })
					nodeFileStream.pipe(createWriteStream(join(this.tempPath, fileName), { highWaterMark: 2e+9 }))

					await new Promise<void>((resolve, reject) => {
						nodeFileStream.on('end', resolve)
						nodeFileStream.on('error', err => reject(err))
						nodeFileStream.on('data', data => {
							if (this._canceled) {
								abortController.abort()
							} else {
								downloadedByteCount += BigInt(data.length)
								const downloadPercent =
									_.round(100 * Number(downloadedByteCount / BigInt(1000)) / Number(fileSize / BigInt(1000)), 1)
								this.showProgress(`Downloading "${fileName}"... (${downloadPercent}%)`, downloadPercent)
							}
						})
					})

					if (nextFile) {
						nextFile()
					} else {
						resolve()
					}
				})

				sngStream.on('error', err => {
					if (err instanceof Error && err.message === 'aborted') {
						// Errors from cancelling downloads are intentional
						resolve()
					} else {
						reject(err)
					}
				})

				sngStream.start()
			})
		}
	}

	private async transferChart() {
		const settings = await getSettings()
		if (this._canceled) { return }

		this.showProgress('Moving chart to library folder...', 100)
		await new Promise<void>(resolve => setTimeout(resolve, 200)) // Delay for OS file processing
		await new Promise<void>((resolve, reject) => {
			if (settings.libraryPath) {
				const destinationPath = join(settings.libraryPath, this.chartFolderPath)
				move(this.tempPath, destinationPath, { overwrite: true }, err => {
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
			await remove(this.tempPath)
		} catch (err) {
			throw { header: 'Failed to delete temporary folder', body: inspect(err) }
		}

		this.showProgress.cancel()
		this.eventEmitter.emit('end', join(settings.libraryPath!, this.chartFolderPath))
	}
}

function getDownloadStream(md5: string): Promise<{ response: IncomingMessage; abortController: AbortController }> {
	const abortController = new AbortController()
	return new Promise((resolve, reject) => {
		const request = https.get(`https://files.enchor.us/${md5}.sng`, {
			agent: new https.Agent({ timeout: 30000 }),
			headers: {
				'mode': 'cors',
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'referrer-policy': 'no-referrer',
			},
			timeout: 30000,
			signal: abortController.signal,
		})

		request.on('response', response => {
			if (response.statusCode !== 200 || !response.headers['content-length']) {
				reject({
					header: 'Failed to download the chart file',
					body: `Response code ${response.statusCode}: ${response.statusMessage}`,
				})
				return
			}

			resolve({ response, abortController })
		})
	})
}
