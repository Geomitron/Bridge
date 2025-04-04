import { Difficulty, Instrument } from 'scan-chart'

import { emitIpcEvent } from '../../main.js'
import { GenerateDifficulty } from './GenerateDifficulty.js'

export class GenerateDifficultyQueue {

	private generateDifficultyQueue: GenerateDifficulty[] = []
	private retryQueue: GenerateDifficulty[] = []
	private erroredQueue: GenerateDifficulty[] = []

	private generateRunning = false

	private isChartInQueue(chartFolderPath: string, instrument: Instrument, difficulty: Difficulty) {
		const chartHash = this.getChartHash(chartFolderPath, instrument, difficulty)
		if (this.generateDifficultyQueue.find(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) === chartHash)) { return true }
		if (this.retryQueue.find(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) === chartHash)) { return true }
		if (this.erroredQueue.find(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) === chartHash)) { return true }
		return false
	}

	private getChartHash(chartFolderPath: string, instrument: Instrument, difficulty: Difficulty) {
		return `${chartFolderPath}-${instrument}-${difficulty}`
	}

	add(
		chartFolderPath: string,
		instrument: Instrument,
		difficulty: Difficulty,
	) {
		if (!this.isChartInQueue(chartFolderPath, instrument, difficulty)) {
			const chartDownload = new GenerateDifficulty(chartFolderPath, instrument, difficulty)
			this.generateDifficultyQueue.push(chartDownload)

			chartDownload.on('progress', (message, percent) => emitIpcEvent('generateDifficultyQueueUpdate', {
				chartFolderPath,
				instrument,
				difficulty,
				header: message.header,
				body: message.body,
				percent,
				type: 'good',
				isPath: false,
			}))
			chartDownload.on('error', err => {
				emitIpcEvent('generateDifficultyQueueUpdate', {
					chartFolderPath,
					instrument,
					difficulty,
					header: err.header,
					body: err.body,
					percent: null,
					type: 'error',
					isPath: err.isPath ?? false,
				})

				this.generateDifficultyQueue = this.generateDifficultyQueue.filter(cd => cd !== chartDownload)
				this.erroredQueue.push(chartDownload)
				this.generateRunning = false
				this.moveQueue()
			})
			chartDownload.on('end', destinationPath => {
				emitIpcEvent('generateDifficultyQueueUpdate', {
					chartFolderPath,
					instrument,
					difficulty,
					header: 'Download complete',
					body: destinationPath,
					percent: 100,
					type: 'done',
					isPath: true,
				})

				this.generateDifficultyQueue = this.generateDifficultyQueue.filter(cd => cd !== chartDownload)
				this.generateRunning = false
				this.moveQueue()
			})

			this.moveQueue()
		}
	}

	remove(chartFolderPath: string, instrument: Instrument, difficulty: Difficulty) {
		const currentDownload = this.generateDifficultyQueue[0]
		if (currentDownload?.chartFolderPath === chartFolderPath) {
			currentDownload.cancel()
			this.generateRunning = false
		}
		const chartHash = this.getChartHash(chartFolderPath, instrument, difficulty)
		this.generateDifficultyQueue = this.generateDifficultyQueue.filter(
			cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash
		)
		this.retryQueue = this.retryQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
		this.erroredQueue = this.erroredQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
		if (currentDownload) {
			this.moveQueue()
		}

		emitIpcEvent('generateDifficultyQueueUpdate', {
			chartFolderPath,
			instrument,
			difficulty,
			header: '',
			body: '',
			percent: null,
			type: 'cancel',
			isPath: false,
		})
	}

	retry(chartFolderPath: string, instrument: Instrument, difficulty: Difficulty) {
		const chartHash = this.getChartHash(chartFolderPath, instrument, difficulty)
		const erroredChartDownload = this.erroredQueue.find(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) === chartHash)

		if (erroredChartDownload) {
			this.erroredQueue = this.erroredQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
			this.retryQueue.push(erroredChartDownload)
		}

		this.moveQueue()
	}

	private moveQueue() {
		if (!this.generateRunning) {
			if (this.retryQueue.length) {
				this.generateDifficultyQueue.unshift(this.retryQueue.shift()!)
			}
			if (this.generateDifficultyQueue.length) {
				this.generateRunning = true
				this.generateDifficultyQueue[0].startOrRetry()
			}
		}
	}
}
