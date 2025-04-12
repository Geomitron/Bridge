import { EventEmitter, Injectable, NgZone } from '@angular/core'

import _ from 'lodash'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { resolveChartFolderName } from 'src-shared/UtilFunctions'

import { DownloadProgress } from '../../../../src-shared/interfaces/download.interface'
import { SettingsService } from './settings.service'
import { LibraryService } from './library.service'

@Injectable({
	providedIn: 'root',
})
export class DownloadService {

	public downloadCountChanges = new EventEmitter<number>()
	public downloads: DownloadProgress[] = []

	constructor(zone: NgZone, private settingsService: SettingsService, private libraryService: LibraryService) {
		window.electron.on.downloadQueueUpdate(download => zone.run(() => {
			const downloadIndex = this.downloads.findIndex(d => d.md5 === download.md5)
			if (download.type === 'cancel') {
				this.downloads = this.downloads.filter(d => d.md5 !== this.downloads[downloadIndex]?.md5)
			} else if (downloadIndex === -1) {
				this.downloads.push(download)
			} else {
				_.assign(this.downloads[downloadIndex], download)
			}
		}))
	}

	get downloadCount() {
		return this.downloads.length
	}

	get completedCount() {
		return this.downloads.filter(download => download.type === 'done').length
	}

	get totalDownloadingPercent() {
		let total = 0
		let count = 0
		for (const download of this.downloads) {
			if (!download.stale) {
				total += download.percent ?? 0
				count++
			}
		}
		if (this.anyErrorsExist && total === 0) { return null }
		return count ? total / count : 0
	}

	get currentDownloadText() {
		const download = this.downloads.find(d => !d.stale && d.type === 'good')
		if (download) {
			return 'Downloading: '
				+ _.truncate(resolveChartFolderName(this.settingsService.chartFolderName, download.chart), { length: 80 })
		} else {
			return ''
		}
	}

	get anyErrorsExist() {
		return this.downloads.find(download => download.type === 'error') ? true : false
	}

	addDownload(chart: ChartData) {
		if (!this.downloads.find(d => d.md5 === chart.md5)) { // Don't download something twice
			if (this.downloads.every(d => d.type === 'done')) { // Reset overall progress bar if it finished
				this.downloads.forEach(d => d.stale = true)
			}

			this.libraryService.libraryAdd(chart)

			const newChart = {
				name: chart.name ?? 'Unknown Name',
				artist: chart.artist ?? 'Unknown Artist',
				album: chart.album ?? 'Unknown Album',
				genre: chart.genre ?? 'Unknown Genre',
				year: chart.year ?? 'Unknown Year',
				charter: chart.charter ?? 'Unknown Charter',
			}
			this.downloads.push({
				md5: chart.md5,
				chart: newChart,
				header: 'Waiting for other downloads to finish...',
				body: '',
				percent: 0,
				type: 'good',
				isPath: false,
			})
			window.electron.emit.download({ action: 'add', md5: chart.md5, hasVideoBackground: chart.hasVideoBackground, chart: newChart })
		}
		this.downloadCountChanges.emit(this.downloadCount)
	}

	cancelDownload(md5: string) {
		window.electron.emit.download({ action: 'remove', md5 })
		this.downloadCountChanges.emit(this.downloadCount - 1)
	}

	cancelAllCompleted() {
		for (const download of this.downloads) {
			if (download.type === 'done') {
				window.electron.emit.download({ action: 'remove', md5: download.md5 })
			}
		}
		this.downloads = this.downloads.filter(d => d.type !== 'done')
		this.downloadCountChanges.emit(this.downloadCount)
	}

	retryDownload(md5: string) {
		const chartDownload = this.downloads.find(d => d.md5 === md5)
		if (chartDownload) {
			chartDownload.type = 'good'
			chartDownload.header = 'Waiting to retry...'
			chartDownload.body = ''
			chartDownload.isPath = false
			chartDownload.percent = 0

			window.electron.emit.download({ action: 'retry', md5 })
		}
	}
}
