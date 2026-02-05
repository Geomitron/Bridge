import { Component, ElementRef, ViewChild, inject, computed, effect } from '@angular/core'
import { DecimalPipe } from '@angular/common'

import _ from 'lodash'

import { removeStyleTags } from '../../../../../src-shared/UtilFunctions.js'
import { DownloadService } from '../../../core/services/download.service'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { DownloadsModalComponent } from './downloads-modal/downloads-modal.component'

@Component({
	selector: 'app-status-bar',
	standalone: true,
	imports: [DecimalPipe, DownloadsModalComponent],
	templateUrl: './status-bar.component.html',
})
export class StatusBarComponent {
	downloadService = inject(DownloadService)
	searchService = inject(SearchService)
	private selectionService = inject(SelectionService)

	@ViewChild('downloadsModal', { static: false }) downloadsModalComponent: ElementRef

	selectedGroupIds = computed(() => {
		const selections = this.selectionService.selections()
		return _.keys(_.pickBy(selections)).map(k => Number(k))
	})

	constructor() {
		// Watch for download count changes to close modal when empty
		effect(() => {
			const count = this.downloadService.downloadCount()
			if (count === 0 && this.downloadsModalComponent?.nativeElement) {
				this.downloadsModalComponent.nativeElement.close()
			}
		})
	}

	async downloadSelected() {
		const selectedIds = this.selectedGroupIds()
		const selectedCharts = this.searchService.groupedSongs().filter(gs => selectedIds.includes(gs[0].groupId))

		for (const chart of _.uniqBy(selectedCharts, gs => `${removeStyleTags(gs[0].artist ?? 'Unknown Artist')
			} - ${removeStyleTags(gs[0].name ?? 'Unknown Name')
			} (${removeStyleTags(gs[0].charter ?? 'Unknown Charter')})`)) {
			this.downloadService.addDownload(chart[0])
		}
	}

	clearCompleted() {
		this.downloadService.cancelAllCompleted()
	}
}
