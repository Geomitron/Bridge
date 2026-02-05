import { Component, ElementRef, EventEmitter, HostBinding, HostListener, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'
import { Router } from '@angular/router'

import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { CatalogService } from '../../../core/services/catalog.service'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'

@Component({
	selector: 'app-result-table',
	templateUrl: './result-table.component.html',
	standalone: false,
})
export class ResultTableComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@Output() rowClicked = new EventEmitter<ChartData[]>()

	@ViewChild('resultTableDiv', { static: true }) resultTableDiv: ElementRef
	@ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

	activeSong: ChartData[] | null = null
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null = null

	// Track which charts are already in the library
	chartExistenceMap: Record<string, boolean> = {}

	constructor(
		public searchService: SearchService,
		private selectionService: SelectionService,
		public settingsService: SettingsService,
		private catalogService: CatalogService,
		private router: Router,
	) { }

	ngOnInit() {
		this.searchService.newSearch.subscribe(() => {
			this.resultTableDiv.nativeElement.scrollTop = 0
			this.activeSong = null
			setTimeout(() => this.tableScrolled(), 0)
			// Check library for new search results
			this.checkChartsInLibrary()
		})
		this.searchService.updateSearch.subscribe(() => {
			setTimeout(() => this.tableScrolled(), 0)
			// Check library for updated search results (next page)
			this.checkChartsInLibrary()
		})
	}

	/**
	 * Check which search results are already in the library
	 */
	async checkChartsInLibrary(): Promise<void> {
		const songs = this.searchService.groupedSongs
		if (!songs || songs.length === 0) return

		// Build list of charts to check - include all versions from each group
		const chartsToCheck: Array<{ artist: string; name: string; charter: string }> = []

		for (const songGroup of songs) {
			for (const chart of songGroup) {
				chartsToCheck.push({
					artist: chart.artist || '',
					name: chart.name || '',
					charter: chart.charter || '',
				})
			}
		}

		// Check existence in library
		try {
			const result = await this.catalogService.checkChartsExist(chartsToCheck)
			// Merge with existing map (for pagination)
			this.chartExistenceMap = { ...this.chartExistenceMap, ...result }
		} catch (err) {
			console.error('Failed to check charts in library:', err)
		}
	}

	/**
	 * Check if a specific chart is in the library
	 */
	isChartInLibrary(chart: ChartData): boolean {
		const key = this.catalogService.getChartExistenceKey(
			chart.artist || '',
			chart.name || '',
			chart.charter || ''
		)
		return this.chartExistenceMap[key] === true
	}

	/**
	 * Check if any version in the song group is in the library
	 */
	isAnyVersionInLibrary(songGroup: ChartData[]): boolean {
		return songGroup.some(chart => this.isChartInLibrary(chart))
	}

	get songs() {
		return this.searchService.groupedSongs
	}

	hasColumn(column: string) {
		return this.settingsService.visibleColumns.includes(column)
	}

	onRowClicked(song: ChartData[]) {
		if (this.activeSong !== song) {
			this.activeSong = song
			this.rowClicked.emit(song)
		}
	}

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime') {
		if (this.songs.length === 0) { return }
		if (this.sortColumn !== column) {
			this.sortColumn = column
			this.sortDirection = 'asc'
		} else if (this.sortDirection === 'asc') {
			this.sortDirection = 'desc'
		} else {
			this.sortDirection = 'asc'
			this.sortColumn = null
		}

		this.searchService.sortColumn = this.sortColumn
		this.searchService.sortDirection = this.sortDirection
		this.searchService.reloadSearch()
	}

	get allSelected() {
		return this.selectionService.isAllSelected()
	}
	set allSelected(value: boolean) {
		if (value) {
			this.selectionService.selectAll()
		} else {
			this.selectionService.deselectAll()
		}
	}

	@HostListener('window:resize', ['$event'])
	onResize() {
		this.tableScrolled()
	}
	tableScrolled(): void {
		const table = this.resultTableDiv.nativeElement
		if (this.router.url === '/browse' && table.scrollHeight - (table.scrollTop + table.clientHeight) < 100) {
			// Scrolled near the bottom of the table
			this.searchService.getNextSearchPage()
		}
	}
}
