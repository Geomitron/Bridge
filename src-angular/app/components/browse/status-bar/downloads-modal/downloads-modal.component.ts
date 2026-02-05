import { Component, HostBinding, inject } from '@angular/core'

import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { DownloadProgress } from 'src-shared/interfaces/download.interface'
import { resolveChartFolderName } from 'src-shared/UtilFunctions'

import { DownloadService } from '../../../../core/services/download.service'

@Component({
	selector: 'app-downloads-modal',
	standalone: true,
	imports: [],
	templateUrl: './downloads-modal.component.html',
})
export class DownloadsModalComponent {
	@HostBinding('class.contents') contents = true

	downloadService = inject(DownloadService)
	settingsService = inject(SettingsService)

	showFile(filepath: string) {
		window.electron.emit.showFile(filepath)
	}

	getDownloadName(download: DownloadProgress) {
		return resolveChartFolderName(this.settingsService.chartFolderName, download.chart)
	}
}
