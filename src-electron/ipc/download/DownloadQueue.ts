import Comparators, { Comparator } from 'comparators'

import { emitIpcEvent } from '../../main'
import { ChartDownload } from './ChartDownload'

export class DownloadQueue {

	private downloadQueue: ChartDownload[] = []

	isDownloadingLink(filesHash: string) {
		return this.downloadQueue.some(download => download.hash === filesHash)
	}

	isEmpty() {
		return this.downloadQueue.length === 0
	}

	push(chartDownload: ChartDownload) {
		this.downloadQueue.push(chartDownload)
		this.sort()
	}

	shift() {
		return this.downloadQueue.shift()
	}

	get(versionID: number) {
		return this.downloadQueue.find(download => download.versionID === versionID)
	}

	remove(versionID: number) {
		const index = this.downloadQueue.findIndex(download => download.versionID === versionID)
		if (index !== -1) {
			this.downloadQueue[index].cancel()
			this.downloadQueue.splice(index, 1)
			emitIpcEvent('queueUpdated', this.downloadQueue.map(download => download.versionID))
		}
	}

	private sort() {
		let comparator: Comparator<unknown> | undefined = Comparators.comparing('allFilesProgress', { reversed: true })

		const prioritizeArchives = true
		if (prioritizeArchives) {
			comparator = comparator.thenComparing?.('isArchive', { reversed: true }) || undefined
		}

		this.downloadQueue.sort(comparator)
		emitIpcEvent('queueUpdated', this.downloadQueue.map(download => download.versionID))
	}
}
