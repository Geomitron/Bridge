import EventEmitter from 'events'
import pkg from 'fs-extra'
import _ from 'lodash'
import { join } from 'path'
import { Difficulty, Instrument } from 'scan-chart'
import { inspect } from 'util'

import { getBasename, getExtension, hasChartExtension } from '../../../src-shared/UtilFunctions.js'
import { generateDifficulty } from './chartDifficultyGenerator.js'
import { mid2Chart } from './mid2chart.js'

const { exists, move, readdir, readFile, remove, writeFile } = pkg

const CHART_BACKUP_EXTENSION = '.original'

export interface GenerateDifficultyMessage {
	header: string
	body: string
	isPath?: boolean
}

interface GenerateDifficultyEvents {
	'progress': (message: GenerateDifficultyMessage, percent: number | null) => void
	'error': (err: GenerateDifficultyMessage) => void
	'end': (destinationPath: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface GenerateDifficulty {
	/**
	 * Registers `listener` to be called when download progress has occured.
	 * `percent` is a number between 0 and 100, or `null` if the progress is indeterminate.
	 * Progress events are throttled to avoid performance issues with rapid updates.
	 */
	on(event: 'progress', listener: (message: GenerateDifficultyMessage, percent: number | null) => void): void

	/**
	 * Registers `listener` to be called if the download process threw an exception. If this is called, the "end" event won't happen.
	 */
	on(event: 'error', listener: (err: GenerateDifficultyMessage) => void): void

	/**
	 * Registers `listener` to be called when the chart has been fully downloaded. If this is called, the "error" event won't happen.
	 */
	on(event: 'end', listener: (destinationPath: string) => void): void
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class GenerateDifficulty {

	private _canceled = false

	private eventEmitter = new EventEmitter()

	private stepCompletedCount = 0
	private tempPath: string

	private chartFileType: 'chart' | 'mid'
	private chartFilePath: string
	private chartData: Uint8Array
	private chartContent: string
	private showProgress = _.throttle((description: string, percent: number | null = null) => {
		this.eventEmitter.emit('progress', { header: description, body: '' }, percent)
	}, 10, { leading: true, trailing: true })

	constructor(
		public readonly chartFolderPath: string,
		public readonly instrument: Instrument,
		public readonly difficulty: Difficulty,
	) { }

	on<T extends keyof GenerateDifficultyEvents>(event: T, listener: GenerateDifficultyEvents[T]) {
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
				case 0: await this.findChartFile(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
				case 1: await this.generateDifficulty(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
				case 2: await this.createChartBackup(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
				case 3: await this.saveChart(); this.stepCompletedCount++; if (this._canceled) { return } // break omitted
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

	private async getChartFilesFromFolder(): Promise<{ fileName: string; data: Uint8Array }[]> {
		const chartFiles: { fileName: string; data: Uint8Array }[] = []

		const entries = await readdir(this.chartFolderPath, { withFileTypes: true })
		const chartFolderFiles = entries.filter(entry => !entry.isDirectory()).map(entry => entry.name)

		for (const fileName of chartFolderFiles) {
			if (hasChartExtension(fileName)) {
				chartFiles.push({ fileName, data: await readFile(this.chartFolderPath + '/' + fileName) })
			}
		}

		return chartFiles
	}

	private async findChartFile() {
		this.showProgress('Finding chart file...')
		const chartFiles = await this.getChartFilesFromFolder()

		if (this._canceled) { return }

		if (chartFiles.length === 0) {
			throw { header: 'No chart files found', body: 'Please check the chart folder.' }
		}

		if (chartFiles.length > 1) {
			throw { header: 'Multiple chart files found', body: 'Please check the chart folder.' }
		}

		const chartFile = chartFiles[0]

		this.chartFilePath = join(this.chartFolderPath, chartFile.fileName)
		this.chartData = chartFile.data
		this.chartFileType = getExtension(chartFile.fileName) as 'chart' | 'mid'

		if (this._canceled) { return }
	}

	private async generateDifficulty() {
		this.showProgress('Generating difficulty...')

		const content = this.chartFileType === 'chart'
			? new TextDecoder('utf-8').decode(this.chartData)
			: mid2Chart(this.chartData, {
				placeholderName: 'Chart',
				omitEmptySections: true,
			})

		if (this._canceled) { return }

		this.chartContent = generateDifficulty({
			content,
			instrument: this.instrument,
			difficulty: this.difficulty,
		})
	}

	private async hasChartBackup() {
		const chartFileBasename = getBasename(this.chartFilePath)
		return exists(chartFileBasename + '.mid' + CHART_BACKUP_EXTENSION)
			|| exists(chartFileBasename + '.chart' + CHART_BACKUP_EXTENSION)
	}

	private async createChartBackup() {
		// Backup the original chart data
		if (!hasChartExtension(this.chartFilePath)) {
			throw { header: 'Unsupported chart type', body: this.chartFileType }
		}

		if (this._canceled) { return }

		const backupExists = await this.hasChartBackup()

		if (this._canceled) { return }

		if (!backupExists) {
			await move(this.chartFilePath, this.chartFilePath + CHART_BACKUP_EXTENSION)
		}
	}

	private async saveChart() {
		if (this._canceled) { return }

		const outputPath = join(this.chartFolderPath, 'notes.chart')
		await writeFile(outputPath, this.chartContent)

		this.showProgress.cancel()
		this.eventEmitter.emit('end', outputPath)
	}
}
