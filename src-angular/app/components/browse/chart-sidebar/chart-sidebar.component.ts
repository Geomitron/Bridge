import { Component, OnInit } from '@angular/core'

import { chain, flatMap, sortBy } from 'lodash'
import { Instrument } from 'scan-chart'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { driveLink, instruments } from 'src-shared/UtilFunctions'

interface Difficulty {
	instrument: string
	diffNumber: string
	chartedDifficulties: string
}

@Component({
	selector: 'app-chart-sidebar',
	templateUrl: './chart-sidebar.component.html',
	styleUrls: ['./chart-sidebar.component.scss'],
})
export class ChartSidebarComponent implements OnInit {

	selectedChart: ChartData | null = null
	charts: ChartData[][] | null = null

	songLength: string
	difficultiesList: Difficulty[]

	constructor(
		private searchService: SearchService,
		public settingsService: SettingsService
	) { }

	ngOnInit() {
		this.searchService.searchUpdated.subscribe(() => {
			this.charts = null
			this.selectedChart = null
		})
	}

	public get albumArtMd5() {
		return flatMap(this.charts ?? []).find(c => !!c.albumArtMd5)?.albumArtMd5 || null
	}

	/**
	 * Displays the information for the selected song.
	 */
	async onRowClicked(song: ChartData[]) {
		this.charts = chain(song)
			.groupBy(c => c.versionGroupId)
			.values()
			.map(versionGroup => sortBy(versionGroup, vg => vg.modifiedTime).reverse())
			.value()
		this.selectedChart = this.charts[0][0]
	}

	/**
	 * Opens the proxy link or source folder in the default browser.
	 */
	onSourceLinkClicked() {
		window.electron.emit.openUrl(driveLink(this.selectedChart!.applicationDriveId))
	}

	/**
	 * @returns `true` if the source folder button should be shown.
	 */
	shownFolderButton() {
		return this.selectedChart!.applicationDriveId !== this.selectedChart!.parentFolderId
	}

	/**
	 * Opens the chart folder in the default browser.
	 */
	onFolderButtonClicked() {
		window.electron.emit.openUrl(driveLink(this.selectedChart!.parentFolderId))
	}

	/**
	 * Adds the selected version to the download queue.
	 */
	onDownloadClicked() {
		// TODO
		// this.downloadService.addDownload(
		// 	this.selectedChart.versionID, {
		// 	chartName: this.selectedChart.chartName,
		// 	artist: this.songResult!.artist,
		// 	charter: this.selectedChart.charters,
		// 	driveData: this.selectedChart.driveData,
		// })
	}

	public get instruments(): Instrument[] {
		if (!this.selectedChart) { return [] }
		return chain(this.selectedChart.notesData.noteCounts)
			.map(nc => nc.instrument)
			.uniq()
			.sortBy(i => instruments.indexOf(i))
			.value()
	}
}
