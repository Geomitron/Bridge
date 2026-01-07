import { Component, ElementRef, ViewChild } from '@angular/core'

import _ from 'lodash'

import { removeStyleTags } from '../../../../../src-shared/UtilFunctions.js'
import { DownloadService } from '../../../core/services/download.service'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { AddToListModalComponent } from '../../songlists/add-to-list-modal/add-to-list-modal.component'

@Component({
	selector: 'app-status-bar',
	templateUrl: './status-bar.component.html',
	standalone: false,
})
export class StatusBarComponent {

	@ViewChild('downloadsModal', { static: false }) downloadsModalComponent: ElementRef
	@ViewChild('addToListModal') addToListModal: AddToListModalComponent

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
		const selectedCharts = this.searchService.groupedSongs.filter(gs => selectedGroupIds.includes(gs[0].groupId))

		for (const chart of _.uniqBy(selectedCharts, gs => `${removeStyleTags(gs[0].artist ?? 'Unknown Artist')
			} - ${removeStyleTags(gs[0].name ?? 'Unknown Name')
			} (${removeStyleTags(gs[0].charter ?? 'Unknown Charter')})`)) {
			this.downloadService.addDownload(chart[0])
		}
	}

	clearCompleted() {
		this.downloadService.cancelAllCompleted()
	}

	addSelectedToList() {
		const selectedGroupIds = this.selectedGroupIds
		const selectedCharts = this.searchService.groupedSongs.filter(gs => selectedGroupIds.includes(gs[0].groupId))

		const uniqueCharts = _.uniqBy(selectedCharts, gs => `${removeStyleTags(gs[0].artist ?? 'Unknown Artist')
			} - ${removeStyleTags(gs[0].name ?? 'Unknown Name')
			} (${removeStyleTags(gs[0].charter ?? 'Unknown Charter')})`).map(gs => gs[0])

		this.addToListModal.open(uniqueCharts)
	}
}
