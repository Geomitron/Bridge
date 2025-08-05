import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { Component, EventEmitter, HostBinding, HostListener, OnInit, Output, ViewChild } from '@angular/core'
import { Router } from '@angular/router'

import { Subscription } from 'rxjs'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'

@Component({
	selector: 'app-result-table',
	templateUrl: './result-table.component.html',
	standalone: false,
})
export class ResultTableComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@Output() rowClicked = new EventEmitter<ChartData[]>()

	@ViewChild('viewport', { static: true }) viewport: CdkVirtualScrollViewport

	activeSong: ChartData[] | null = null
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null = null
	isLoadingMore = false
	songs: ChartData[][] = []
	subscription: Subscription[] = []

	constructor(
		public searchService: SearchService,
		private selectionService: SelectionService,
		public settingsService: SettingsService,
		private router: Router,
	) { }

	ngOnInit() {
		this.subscription.push(
			this.searchService.newSearch.subscribe(() => {
				if (this.viewport) {
					this.viewport.scrollToIndex(0)
				}
				this.activeSong = null
				this.isLoadingMore = false
				this.songs = [...this.searchService.groupedSongs]
			})
		)

		this.subscription.push(
			this.searchService.updateSearch.subscribe(() => {
				this.isLoadingMore = false
				this.songs = [...this.searchService.groupedSongs]
			})
		)
	}

	onViewportScroll(): void {
		if (!this.viewport || this.router.url !== '/browse' || this.isLoadingMore) {
			return
		}

		const viewportElement = this.viewport.elementRef.nativeElement
		const scrollTop = viewportElement.scrollTop
		const scrollHeight = viewportElement.scrollHeight
		const clientHeight = viewportElement.clientHeight
		const threshold = 100

		if (scrollHeight - (scrollTop + clientHeight) < threshold) {
			this.isLoadingMore = true
			this.searchService.getNextSearchPage()
		}
	}

	trackByFn(_: number, song: ChartData[]): number {
		return song[0].groupId
	}

	get tableRowHeight(): number {
		return this.settingsService.isCompactTable ? 32 : 48
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
		if (this.viewport) {
			this.viewport.checkViewportSize()
		}
	}
}
