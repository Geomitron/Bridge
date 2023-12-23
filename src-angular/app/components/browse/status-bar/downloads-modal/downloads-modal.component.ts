import { ChangeDetectorRef, Component } from '@angular/core'

import { DownloadProgress } from '../../../../../../src-shared/interfaces/download.interface'
import { DownloadService } from '../../../../core/services/download.service'

@Component({
	selector: 'app-downloads-modal',
	templateUrl: './downloads-modal.component.html',
})
export class DownloadsModalComponent {

	downloads: DownloadProgress[] = []

	constructor(private downloadService: DownloadService, ref: ChangeDetectorRef) {
		window.electron.on.queueUpdated(order => {
			this.downloads.sort((a, b) => order.indexOf(a.versionID) - order.indexOf(b.versionID))
		})

		downloadService.onDownloadUpdated(download => {
			const index = this.downloads.findIndex(thisDownload => thisDownload.versionID === download.versionID)
			if (download.type === 'cancel') {
				this.downloads = this.downloads.filter(thisDownload => thisDownload.versionID !== download.versionID)
			} else if (index === -1) {
				this.downloads.push(download)
			} else {
				this.downloads[index] = download
			}
			ref.detectChanges()
		})
	}

	trackByVersionID(_index: number, item: DownloadProgress) {
		return item.versionID
	}

	cancelDownload(versionID: number) {
		this.downloadService.cancelDownload(versionID)
	}

	retryDownload(versionID: number) {
		this.downloadService.retryDownload(versionID)
	}

	getBackgroundColor(download: DownloadProgress) {
		switch (download.type) {
			case 'error': return '#a63a3a'
			default: return undefined
		}
	}

	showFile(filepath: string) {
		window.electron.emit.showFile(filepath)
	}
}
