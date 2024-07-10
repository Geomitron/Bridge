import { Component, ElementRef, ViewChild } from '@angular/core'

import _ from 'lodash'

import { DownloadService } from '../../../core/services/download.service'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'

@Component({
	selector: 'app-status-bar',
	templateUrl: './status-bar.component.html',
})
export class StatusBarComponent {

	@ViewChild('downloadsModal', { static: false }) downloadsModalComponent: ElementRef

	constructor(
		public downloadService: DownloadService,
		public searchService: SearchService,
		private selectionService: SelectionService,
	) {
		this.downloadService.downloadCountChanges.subscribe(downloadCount => {
			if (downloadCount === 0) {
				this.downloadsModalComponent.nativeElement.close()
			}
		})
	}

	get selectedGroupIds() {
		return _.keys(_.pickBy(this.selectionService.selections)).map(k => Number(k))
	}

	async downloadSelected() {
		const selectedGroupIds = this.selectedGroupIds
		for (const chart of this.searchService.groupedSongs.filter(gs => selectedGroupIds.includes(gs[0].groupId))) {
			this.downloadService.addDownload(chart[0])
		}
	}

	clearCompleted() {
		this.downloadService.cancelAllCompleted()
	}
}
