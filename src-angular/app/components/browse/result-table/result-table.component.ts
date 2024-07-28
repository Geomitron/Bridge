import { Component, ElementRef, EventEmitter, HostBinding, HostListener, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'
import { Router } from '@angular/router'

import _ from 'lodash'
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
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'difficulty' | null = null

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
			this.sortDirection = 'asc'
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

	hasColumn(column: string) {
		return this.settingsService.visibleColumns.includes(column)
	}

	onRowClicked(song: ChartData[]) {
		if (this.activeSong !== song) {
			this.activeSong = song
			this.rowClicked.emit(song)
		}
	}

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'difficulty') {
		if (this.songs.length === 0) { return }
		if (this.sortColumn !== column) {
			this.sortColumn = column
			this.sortDirection = 'asc'
		} else if (this.sortDirection === 'desc') {
			this.sortDirection = 'asc'
		} else {
			this.sortDirection = 'desc'
		}
		this.updateSort()
	}

	private updateSort() {
		const col = this.sortColumn
		if (col !== null) {
			console.log(this.getSortColumn())
			const groupedSongs = _.orderBy(this.searchService.groupedSongs, s => _.get(s[0], this.getSortColumn()), this.sortDirection)
			this.searchService.groupedSongs = groupedSongs
		}
	}
	private getSortColumn(): keyof ChartData {
		if (this.sortColumn === 'length') {
			return 'notesData.effectiveLength' as keyof ChartData
		} else if (this.sortColumn === 'difficulty') {
			switch (this.searchService.instrument.value) {
				case 'guitar': return 'diff_guitar'
				case 'guitarcoop': return 'diff_guitar_coop'
				case 'rhythm': return 'diff_rhythm'
				case 'bass': return 'diff_bass'
				case 'drums': return 'diff_drums'
				case 'keys': return 'diff_keys'
				case 'guitarghl': return 'diff_guitarghl'
				case 'guitarcoopghl': return 'diff_guitar_coop_ghl'
				case 'rhythmghl': return 'diff_rhythm_ghl'
				case 'bassghl': return 'diff_bassghl'
				default: throw 'Invalid instrument'
			}
		} else {
			return this.sortColumn!
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
			this.searchService.getNextSearchPage()
		}
	}
}
