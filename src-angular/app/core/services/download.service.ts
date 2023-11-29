import { EventEmitter, Injectable } from '@angular/core'

import { DownloadProgress, NewDownload } from '../../../../src-shared/interfaces/download.interface'

@Injectable({
	providedIn: 'root',
})
export class DownloadService {

	private downloadUpdatedEmitter = new EventEmitter<DownloadProgress>()
	private downloads: DownloadProgress[] = []

	constructor() {
		window.electron.on.downloadUpdated(result => {
			// Update <this.downloads> with result
			const thisDownloadIndex = this.downloads.findIndex(download => download.versionID === result.versionID)
			if (result.type === 'cancel') {
				this.downloads = this.downloads.filter(download => download.versionID !== result.versionID)
			} else if (thisDownloadIndex === -1) {
				this.downloads.push(result)
			} else {
				this.downloads[thisDownloadIndex] = result
			}

			this.downloadUpdatedEmitter.emit(result)
		})
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
				total += download.percent
				count++
			}
		}
		return total / count
	}

	get anyErrorsExist() {
		return this.downloads.find(download => download.type === 'error') ? true : false
	}

	addDownload(versionID: number, newDownload: NewDownload) {
		if (!this.downloads.find(download => download.versionID === versionID)) { // Don't download something twice
			if (this.downloads.every(download => download.type === 'done')) { // Reset overall progress bar if it finished
				this.downloads.forEach(download => download.stale = true)
			}
			window.electron.emit.download({ action: 'add', versionID, data: newDownload })
		}
	}

	onDownloadUpdated(callback: (download: DownloadProgress) => void) {
		this.downloadUpdatedEmitter.subscribe(callback)
	}

	cancelDownload(versionID: number) {
		const removedDownload = this.downloads.find(download => download.versionID === versionID)!
		if (['error', 'done'].includes(removedDownload.type)) {
			this.downloads = this.downloads.filter(download => download.versionID !== versionID)
			removedDownload.type = 'cancel'
			this.downloadUpdatedEmitter.emit(removedDownload)
		} else {
			window.electron.emit.download({ action: 'cancel', versionID })
		}
	}

	cancelCompleted() {
		for (const download of this.downloads) {
			if (download.type === 'done') {
				this.cancelDownload(download.versionID)
			}
		}
	}

	retryDownload(versionID: number) {
		window.electron.emit.download({ action: 'retry', versionID })
	}
}
