import { Component, ElementRef, EventEmitter, HostBinding, HostListener, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'
import { Router } from '@angular/router'

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
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | null = null

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
			setTimeout(() => this.tableScrolled(), 0)
		})
		this.searchService.updateSearch.subscribe(() => {
			setTimeout(() => this.tableScrolled(), 0)
		})
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

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length') {
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
