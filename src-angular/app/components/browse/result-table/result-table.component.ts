import { Component, ElementRef, EventEmitter, HostBinding, HostListener, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'
import { Router } from '@angular/router'

import { sortBy } from 'lodash'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'

@Component({
	selector: 'app-result-table',
	templateUrl: './result-table.component.html',
})
export class ResultTableComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@Output() rowClicked = new EventEmitter<ChartData[]>()

	@ViewChild('resultTableDiv', { static: true }) resultTableDiv: ElementRef
	@ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

	activeSong: ChartData[] | null = null
	sortDirection: 'ascending' | 'descending' = 'ascending'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | null = null

	constructor(
		public searchService: SearchService,
		private selectionService: SelectionService,
		public settingsService: SettingsService,
		private router: Router,
	) { }

	ngOnInit() {
		this.searchService.newSearch.subscribe(() => {
			this.resultTableDiv.nativeElement.scrollTop = 0
			this.activeSong = null
			this.sortDirection = 'ascending'
			this.sortColumn = null
			this.updateSort()
			setTimeout(() => this.tableScrolled(), 0)
		})
		this.searchService.updateSearch.subscribe(() => {
			this.updateSort()
			setTimeout(() => this.tableScrolled(), 0)
		})
	}

	get songs() {
		return this.searchService.groupedSongs
	}

	onRowClicked(song: ChartData[]) {
		if (this.activeSong !== song) {
			this.activeSong = song
			this.rowClicked.emit(song)
		}
	}

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre' | 'year') {
		if (this.songs.length === 0) { return }
		if (this.sortColumn !== column) {
			this.sortColumn = column
			this.sortDirection = 'ascending'
		} else if (this.sortDirection === 'descending') {
			this.sortDirection = 'ascending'
		} else {
			this.sortDirection = 'descending'
		}
		this.updateSort()
	}

	private updateSort() {
		const col = this.sortColumn
		if (col !== null) {
			const groupedSongs = sortBy(this.searchService.groupedSongs, song => song[0][col]?.toLowerCase())
			if (this.sortDirection === 'descending') { groupedSongs.reverse() }
			this.searchService.groupedSongs = groupedSongs
		}
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
			if (this.searchService.areMorePages && !this.searchService.searchLoading) {
				this.searchService.search(this.searchService.searchControl.value || '*', true).subscribe()
			}
		}
	}
}
