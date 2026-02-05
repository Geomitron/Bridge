import { AfterViewChecked, ApplicationRef, Component, ElementRef, EventEmitter, HostBinding, HostListener, NgZone, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'
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
export class ResultTableComponent implements OnInit, AfterViewChecked {
	@HostBinding('class.contents') contents = true

	@Output() rowClicked = new EventEmitter<ChartData[]>()

	@ViewChild('resultTableDiv', { static: true }) resultTableDiv: ElementRef
	@ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

	activeSong: ChartData[] | null = null
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null = null

	// Track which charts are already in the library
	chartExistenceMap: Record<string, boolean> = {}

	// Flag to check scroll after view updates
	private shouldCheckScrollAfterRender = false
	// Track the last data length to detect actual data changes
	private lastDataLength = 0

	constructor(
		public searchService: SearchService,
		private selectionService: SelectionService,
		public settingsService: SettingsService,
		private catalogService: CatalogService,
		private router: Router,
		private ngZone: NgZone,
		private appRef: ApplicationRef,
	) { }

	ngOnInit() {
		this.searchService.newSearch.subscribe(() => {
			// Ensure we're running inside Angular's zone for proper change detection
			this.ngZone.run(() => {
				this.resultTableDiv.nativeElement.scrollTop = 0
				this.activeSong = null
				// Reset data length tracking for new search
				this.lastDataLength = 0
				// Mark that we should check scroll after the view renders
				this.shouldCheckScrollAfterRender = true
				// Check library for new search results
				this.checkChartsInLibrary()
				// Trigger change detection
				this.appRef.tick()
			})
		})
		this.searchService.updateSearch.subscribe(() => {
			// Ensure we're running inside Angular's zone for proper change detection
			this.ngZone.run(() => {
				// Mark that we should check scroll after the view renders
				this.shouldCheckScrollAfterRender = true
				// Check library for updated search results (next page)
				this.checkChartsInLibrary()
				// Trigger change detection
				this.appRef.tick()
			})
		})
	}

	/**
	 * Called after Angular checks the component's view.
	 * This is the reliable place to check scroll position after data changes.
	 */
	ngAfterViewChecked(): void {
		if (this.shouldCheckScrollAfterRender && this.songs && this.songs.length > 0) {
			// Only proceed if data has actually changed
			if (this.songs.length !== this.lastDataLength) {
				const expectedLength = this.songs.length
				this.lastDataLength = expectedLength
				this.shouldCheckScrollAfterRender = false
				// Wait for DOM to actually have the rows rendered before checking scroll
				this.waitForRowsRendered(expectedLength)
			}
		}
	}

	/**
	 * Polls until the expected number of rows are rendered in the DOM, then checks scroll.
	 * This ensures we don't check scroll position before the browser has painted the content.
	 */
	private waitForRowsRendered(expectedRowCount: number): void {
		const maxAttempts = 50 // Max ~500ms of waiting
		let attempts = 0

		const checkRows = () => {
			const tbody = this.resultTableDiv.nativeElement.querySelector('tbody')
			const renderedRows = tbody?.querySelectorAll('tr')?.length ?? 0

			if (renderedRows >= expectedRowCount) {
				// Rows are rendered, now check scroll position
				// Use requestAnimationFrame to ensure browser has painted
				requestAnimationFrame(() => {
					this.tableScrolled()
				})
			} else if (attempts < maxAttempts) {
				attempts++
				// Use requestAnimationFrame for smoother polling aligned with browser paint cycles
				requestAnimationFrame(checkRows)
			}
		}

		// Start checking on next animation frame
		requestAnimationFrame(checkRows)
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

	@HostListener('window:resize')
	onResize() {
		this.tableScrolled()
	}
	tableScrolled(): void {
		const table = this.resultTableDiv.nativeElement

		// Don't trigger pagination if:
		// - Not on the browse page
		// - No songs loaded yet (table not rendered)
		// - Content hasn't been rendered yet (scrollHeight <= clientHeight with no songs indicates empty/not-rendered state)
		if (this.router.url !== '/browse' || !this.songs || this.songs.length === 0) {
			return
		}

		if (table.scrollHeight - (table.scrollTop + table.clientHeight) < 100) {
			// Scrolled near the bottom of the table
			this.searchService.getNextSearchPage()
		}
	}
}
