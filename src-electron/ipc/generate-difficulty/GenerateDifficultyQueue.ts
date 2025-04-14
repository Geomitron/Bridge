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
			const chartGeneration = new GenerateDifficulty(chartFolderPath, instrument, difficulty)
			this.generateDifficultyQueue.push(chartGeneration)

			chartGeneration.on('progress', (message, percent) => emitIpcEvent('generateDifficultyQueueUpdate', {
				chartFolderPath,
				instrument,
				difficulty,
				header: message.header,
				body: message.body,
				percent,
				type: 'good',
				isPath: false,
			}))
			chartGeneration.on('error', err => {
				console.error('Error generating difficulty for chart', chartFolderPath, instrument, difficulty, err)
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

				this.generateDifficultyQueue = this.generateDifficultyQueue.filter(cd => cd !== chartGeneration)
				this.erroredQueue.push(chartGeneration)
				this.generateRunning = false
				this.moveQueue()
			})
			chartGeneration.on('end', destinationPath => {
				emitIpcEvent('generateDifficultyQueueUpdate', {
					chartFolderPath,
					instrument,
					difficulty,
					header: 'Generation complete',
					body: destinationPath,
					percent: 100,
					type: 'done',
					isPath: true,
				})

				this.generateDifficultyQueue = this.generateDifficultyQueue.filter(cd => cd !== chartGeneration)
				this.generateRunning = false
				this.moveQueue()
			})

			this.moveQueue()
		}
	}

	remove(chartFolderPath: string, instrument: Instrument, difficulty: Difficulty) {
		const currentGeneration = this.generateDifficultyQueue[0]
		if (currentGeneration?.chartFolderPath === chartFolderPath) {
			currentGeneration.cancel()
			this.generateRunning = false
		}
		const chartHash = this.getChartHash(chartFolderPath, instrument, difficulty)
		this.generateDifficultyQueue = this.generateDifficultyQueue.filter(
			cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash
		)
		this.retryQueue = this.retryQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
		this.erroredQueue = this.erroredQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
		if (currentGeneration) {
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
		const erroredChartGeneration = this.erroredQueue.find(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) === chartHash)

		if (erroredChartGeneration) {
			this.erroredQueue = this.erroredQueue.filter(cd => this.getChartHash(cd.chartFolderPath, cd.instrument, cd.difficulty) !== chartHash)
			this.retryQueue.push(erroredChartGeneration)
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
