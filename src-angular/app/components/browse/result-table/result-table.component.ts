import { AfterViewChecked, Component, ElementRef, HostBinding, HostListener, output, ViewChild, inject, signal, computed, effect } from '@angular/core'
import { Router } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { NgClass } from '@angular/common'

import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { CatalogService } from '../../../core/services/catalog.service'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'

@Component({
	selector: 'app-result-table',
	standalone: true,
	imports: [FormsModule, NgClass, ResultTableRowComponent],
	templateUrl: './result-table.component.html',
})
export class ResultTableComponent implements AfterViewChecked {
	searchService = inject(SearchService)
	private selectionService = inject(SelectionService)
	settingsService = inject(SettingsService)
	private catalogService = inject(CatalogService)
	private router = inject(Router)

	@HostBinding('class.contents') contents = true

	rowClicked = output<ChartData[]>()

	@ViewChild('resultTableDiv', { static: true }) resultTableDiv: ElementRef

	activeSong = signal<ChartData[] | null>(null)
	sortDirection = signal<'asc' | 'desc'>('asc')
	sortColumn = signal<'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null>(null)

	// Track which charts are already in the library
	chartExistenceMap = signal<Record<string, boolean>>({})

	// Flag to check scroll after view updates
	private shouldCheckScrollAfterRender = false
	// Track the last data length to detect actual data changes
	private lastDataLength = 0

	songs = computed(() => this.searchService.groupedSongs())

	allSelected = computed(() => this.selectionService.isAllSelected())

	constructor() {
		// Handle new search
		effect(() => {
			const event = this.searchService.searchEvent()
			if (event?.type === 'new') {
				this.resultTableDiv.nativeElement.scrollTop = 0
				this.activeSong.set(null)
				this.lastDataLength = 0
				this.shouldCheckScrollAfterRender = true
				this.checkChartsInLibrary()
			} else if (event?.type === 'update') {
				this.shouldCheckScrollAfterRender = true
				this.checkChartsInLibrary()
			}
		})
	}

	/**
	 * Called after Angular checks the component's view.
	 * This is the reliable place to check scroll position after data changes.
	 */
	ngAfterViewChecked(): void {
		const currentSongs = this.songs()
		if (this.shouldCheckScrollAfterRender && currentSongs && currentSongs.length > 0) {
			// Only proceed if data has actually changed
			if (currentSongs.length !== this.lastDataLength) {
				const expectedLength = currentSongs.length
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
		const songs = this.searchService.groupedSongs()
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
			this.chartExistenceMap.update(map => ({ ...map, ...result }))
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
		return this.chartExistenceMap()[key] === true
	}

	/**
	 * Check if any version in the song group is in the library
	 */
	isAnyVersionInLibrary(songGroup: ChartData[]): boolean {
		return songGroup.some(chart => this.isChartInLibrary(chart))
	}

	hasColumn(column: string) {
		return this.settingsService.visibleColumns.includes(column)
	}

	onRowClicked(song: ChartData[]) {
		if (this.activeSong() !== song) {
			this.activeSong.set(song)
			this.rowClicked.emit(song)
		}
	}

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime') {
		if (this.songs().length === 0) { return }
		const currentColumn = this.sortColumn()
		const currentDirection = this.sortDirection()

		if (currentColumn !== column) {
			this.sortColumn.set(column)
			this.sortDirection.set('asc')
		} else if (currentDirection === 'asc') {
			this.sortDirection.set('desc')
		} else {
			this.sortDirection.set('asc')
			this.sortColumn.set(null)
		}

		this.searchService.sortColumn.set(this.sortColumn())
		this.searchService.sortDirection.set(this.sortDirection())
		this.searchService.reloadSearch()
	}

	setAllSelected(value: boolean) {
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
		const currentSongs = this.songs()

		// Don't trigger pagination if:
		// - Not on the browse page
		// - No songs loaded yet (table not rendered)
		// - Content hasn't been rendered yet (scrollHeight <= clientHeight with no songs indicates empty/not-rendered state)
		if (this.router.url !== '/browse' || !currentSongs || currentSongs.length === 0) {
			return
		}

		if (table.scrollHeight - (table.scrollTop + table.clientHeight) < 100) {
			// Scrolled near the bottom of the table
			this.searchService.getNextSearchPage()
		}
	}
}
