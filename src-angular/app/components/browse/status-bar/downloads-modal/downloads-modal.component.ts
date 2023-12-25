import { Component, HostBinding } from '@angular/core'

import { DownloadService } from '../../../../core/services/download.service'

@Component({
	selector: 'app-downloads-modal',
	templateUrl: './downloads-modal.component.html',
})
export class DownloadsModalComponent {
	@HostBinding('class.contents') contents = true

	constructor(public downloadService: DownloadService) { }

	showFile(filepath: string) {
		window.electron.emit.showFile(filepath)
	}
}
