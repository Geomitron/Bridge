import { Component, HostBinding } from '@angular/core'

import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { DownloadProgress } from 'src-shared/interfaces/download.interface'
import { resolveChartFolderName } from 'src-shared/UtilFunctions'

import { DownloadService } from '../../../../core/services/download.service'

@Component({
	selector: 'app-downloads-modal',
	templateUrl: './downloads-modal.component.html',
	standalone: false,
})
export class DownloadsModalComponent {
	@HostBinding('class.contents') contents = true

	constructor(
		public downloadService: DownloadService,
		public settingsService: SettingsService,
	) { }

	showFile(filepath: string) {
		window.electron.emit.showFile(filepath)
	}

	getDownloadName(download: DownloadProgress) {
		return resolveChartFolderName(this.settingsService.chartFolderName, download.chart)
	}
}
