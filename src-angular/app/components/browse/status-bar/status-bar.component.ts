import { Component, ElementRef, ViewChild } from '@angular/core'

import { keys, pickBy } from 'lodash'

import { DownloadService } from '../../../core/services/download.service'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'

@Component({
	selector: 'app-status-bar',
	templateUrl: './status-bar.component.html',
})
export class StatusBarComponent {

	@ViewChild('downloadsModal', { static: false }) downloadsModalComponent: ElementRef

	multipleCompleted = false
	downloading = false
	error = false
	percent = 0
	// TODO
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	batchResults: any[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	chartGroups: any[][]

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
		return keys(pickBy(this.selectionService.selections)).map(k => Number(k))
	}

	async downloadSelected() {
		// this.chartGroups = []
		// // TODO
		// // this.batchResults = await window.electron.invoke.getBatchSongDetails(this.selectedResults.map(result => result.id))
		// const versionGroups = groupBy(this.batchResults, 'songID')
		// for (const versionGroup of versionGroups) {
		// 	if (versionGroup.findIndex(version => version.chartID !== versionGroup[0].chartID) !== -1) {
		// 		// Must have multiple charts of this song
		// 		this.chartGroups.push(versionGroup.filter(version => version.versionID === version.latestVersionID))
		// 	}
		// }

		// if (this.chartGroups.length === 0) {
		// 	for (const versions of versionGroups) {
		// 		// this.searchService.sortChart(versions)
		// 		const downloadVersion = versions[0]
		// 		const downloadSong = this.selectedResults.find(song => song.id === downloadVersion.songID)!
		// 		this.downloadService.addDownload(
		// 			downloadVersion.versionID, {
		// 			chartName: downloadVersion.chartName,
		// 			artist: downloadSong.artist,
		// 			charter: downloadVersion.charters,
		// 			driveData: downloadVersion.driveData,
		// 		})
		// 	}
		// } else {
		// 	// TODO
		// 	// $('#selectedModal').modal('show')
		// 	// [download all charts for each song] [deselect these songs] [X]
		// }
	}

	downloadAllCharts() {
		// const songChartGroups = groupBy(this.batchResults, 'songID', 'chartID')
		// for (const chart of songChartGroups) {
		// 	// this.searchService.sortChart(chart)
		// 	const downloadVersion = chart[0]
		// 	const downloadSong = this.selectedResults.find(song => song.id === downloadVersion.songID)!
		// 	this.downloadService.addDownload(
		// 		downloadVersion.versionID, {
		// 		chartName: downloadVersion.chartName,
		// 		artist: downloadSong.artist,
		// 		charter: downloadVersion.charters,
		// 		driveData: downloadVersion.driveData,
		// 	}
		// 	)
		// }
	}

	deselectSongsWithMultipleCharts() {
		// TODO
		// for (const chartGroup of this.chartGroups) {
		// this.selectionService.deselectSong(chartGroup[0].songID)
		// }
	}

	clearCompleted() {
		this.downloadService.cancelAllCompleted()
	}
}
