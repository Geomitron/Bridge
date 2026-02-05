import { Injectable, signal, computed } from '@angular/core'

import _ from 'lodash'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { resolveChartFolderName } from 'src-shared/UtilFunctions'

import { DownloadProgress } from '../../../../src-shared/interfaces/download.interface'
import { SettingsService } from './settings.service'

@Injectable({
	providedIn: 'root',
})
export class DownloadService {

	readonly downloads = signal<DownloadProgress[]>([])

	// Computed signals for derived state
	readonly downloadCount = computed(() => this.downloads().length)

	readonly completedCount = computed(() =>
		this.downloads().filter(download => download.type === 'done').length
	)

	readonly totalDownloadingPercent = computed(() => {
		const currentDownloads = this.downloads()
		let total = 0
		let count = 0
		for (const download of currentDownloads) {
			if (!download.stale) {
				total += download.percent ?? 0
				count++
			}
		}
		if (this.anyErrorsExist() && total === 0) { return null }
		return count ? total / count : 0
	})

	readonly currentDownloadText = computed(() => {
		const download = this.downloads().find(d => !d.stale && d.type === 'good')
		if (download) {
			return 'Downloading: '
				+ _.truncate(resolveChartFolderName(this.settingsService.chartFolderName, download.chart), { length: 80 })
		} else {
			return ''
		}
	})

	readonly anyErrorsExist = computed(() =>
		this.downloads().find(download => download.type === 'error') ? true : false
	)

	constructor(private settingsService: SettingsService) {
		window.electron.on.downloadQueueUpdate(download => {
			this.downloads.update(downloads => {
				const downloadIndex = downloads.findIndex(d => d.md5 === download.md5)
				if (download.type === 'cancel') {
					return downloads.filter(d => d.md5 !== downloads[downloadIndex]?.md5)
				} else if (downloadIndex === -1) {
					return [...downloads, download]
				} else {
					const newDownloads = [...downloads]
					newDownloads[downloadIndex] = { ...newDownloads[downloadIndex], ...download }
					return newDownloads
				}
			})
		})
	}

	addDownload(chart: ChartData) {
		const currentDownloads = this.downloads()
		if (!currentDownloads.find(d => d.md5 === chart.md5)) { // Don't download something twice
			if (currentDownloads.every(d => d.type === 'done')) { // Reset overall progress bar if it finished
				this.downloads.update(downloads => downloads.map(d => ({ ...d, stale: true })))
			}
			const newChart = {
				name: chart.name ?? 'Unknown Name',
				artist: chart.artist ?? 'Unknown Artist',
				album: chart.album ?? 'Unknown Album',
				genre: chart.genre ?? 'Unknown Genre',
				year: chart.year ?? 'Unknown Year',
				charter: chart.charter ?? 'Unknown Charter',
			}
			this.downloads.update(downloads => [...downloads, {
				md5: chart.md5,
				chart: newChart,
				header: 'Waiting for other downloads to finish...',
				body: '',
				percent: 0,
				type: 'good',
				isPath: false,
			}])
			window.electron.emit.download({ action: 'add', md5: chart.md5, hasVideoBackground: chart.hasVideoBackground, chart: newChart })
		}
	}

	cancelDownload(md5: string) {
		window.electron.emit.download({ action: 'remove', md5 })
	}

	cancelAllCompleted() {
		const currentDownloads = this.downloads()
		for (const download of currentDownloads) {
			if (download.type === 'done') {
				window.electron.emit.download({ action: 'remove', md5: download.md5 })
			}
		}
		this.downloads.update(downloads => downloads.filter(d => d.type !== 'done'))
	}

	retryDownload(md5: string) {
		this.downloads.update(downloads => {
			const index = downloads.findIndex(d => d.md5 === md5)
			if (index !== -1) {
				const newDownloads = [...downloads]
				newDownloads[index] = {
					...newDownloads[index],
					type: 'good',
					header: 'Waiting to retry...',
					body: '',
					isPath: false,
					percent: 0,
				}
				window.electron.emit.download({ action: 'retry', md5 })
				return newDownloads
			}
			return downloads
		})
	}
}
