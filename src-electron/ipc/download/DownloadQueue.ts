import { emitIpcEvent } from '../../main.js'
import { ChartDownload } from './ChartDownload.js'

export class DownloadQueue {

	private downloadQueue: ChartDownload[] = []
	private retryQueue: ChartDownload[] = []
	private erroredQueue: ChartDownload[] = []

	private downloadRunning = false

	private isChartInQueue(md5: string) {
		if (this.downloadQueue.find(cd => cd.md5 === md5)) { return true }
		if (this.retryQueue.find(cd => cd.md5 === md5)) { return true }
		if (this.erroredQueue.find(cd => cd.md5 === md5)) { return true }
		return false
	}

	add(
		md5: string,
		hasVideoBackground: boolean,
		chart: { name: string; artist: string; album: string; genre: string; year: string; charter: string },
	) {
		if (!this.isChartInQueue(md5)) {
			const chartDownload = new ChartDownload(md5, hasVideoBackground, chart)
			this.downloadQueue.push(chartDownload)

			chartDownload.on('progress', (message, percent) => emitIpcEvent('downloadQueueUpdate', {
				md5,
				chart,
				header: message.header,
				body: message.body,
				percent,
				type: 'good',
				isPath: false,
			}))
			chartDownload.on('error', err => {
				emitIpcEvent('downloadQueueUpdate', {
					md5,
					chart,
					header: err.header,
					body: err.body,
					percent: null,
					type: 'error',
					isPath: err.isPath ?? false,
				})

				this.downloadQueue = this.downloadQueue.filter(cd => cd !== chartDownload)
				this.erroredQueue.push(chartDownload)
				this.downloadRunning = false
				this.moveQueue()
			})
			chartDownload.on('end', destinationPath => {
				emitIpcEvent('downloadQueueUpdate', {
					md5,
					chart,
					header: 'Download complete',
					body: destinationPath,
					percent: 100,
					type: 'done',
					isPath: true,
				})

				this.downloadQueue = this.downloadQueue.filter(cd => cd !== chartDownload)
				this.downloadRunning = false
				this.moveQueue()
			})

			this.moveQueue()
		}
	}

	remove(md5: string) {
		const currentDownload = this.downloadQueue[0]
		if (currentDownload?.md5 === md5) {
			currentDownload.cancel()
			this.downloadRunning = false
		}
		this.downloadQueue = this.downloadQueue.filter(cd => cd.md5 !== md5)
		this.retryQueue = this.retryQueue.filter(cd => cd.md5 !== md5)
		this.erroredQueue = this.erroredQueue.filter(cd => cd.md5 !== md5)
		if (currentDownload) {
			this.moveQueue()
		}

		emitIpcEvent('downloadQueueUpdate', {
			md5,
			chart: { name: '', artist: '', album: '', genre: '', year: '', charter: '' },
			header: '',
			body: '',
			percent: null,
			type: 'cancel',
			isPath: false,
		})
	}

	retry(md5: string) {
		const erroredChartDownload = this.erroredQueue.find(cd => cd.md5 === md5)
		if (erroredChartDownload) {
			this.erroredQueue = this.erroredQueue.filter(cd => cd.md5 !== md5)
			this.retryQueue.push(erroredChartDownload)
		}

		this.moveQueue()
	}

	private moveQueue() {
		if (!this.downloadRunning) {
			if (this.retryQueue.length) {
				this.downloadQueue.unshift(this.retryQueue.shift()!)
			}
			if (this.downloadQueue.length) {
				this.downloadRunning = true
				this.downloadQueue[0].startOrRetry()
			}
		}
	}
}
