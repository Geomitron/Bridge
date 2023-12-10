import { Component, EventEmitter, OnInit, Output, QueryList, ViewChild, ViewChildren } from '@angular/core'

import Comparators from 'comparators'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { CheckboxDirective } from '../../../core/directives/checkbox.directive'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'

@Component({
	selector: 'app-result-table',
	templateUrl: './result-table.component.html',
	styleUrls: ['./result-table.component.scss'],
})
export class ResultTableComponent implements OnInit {

	@Output() rowClicked = new EventEmitter<ChartData[]>()

	@ViewChild(CheckboxDirective, { static: true }) checkboxColumn: CheckboxDirective
	@ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

	activeSong: ChartData[] | null = null
	sortDirection: 'ascending' | 'descending' = 'descending'
	sortColumn: 'name' | 'artist' | 'album' | 'genre' | null = null

	constructor(
		public searchService: SearchService,
		private selectionService: SelectionService,
		public settingsService: SettingsService
	) { }

	ngOnInit() {
		this.selectionService.onSelectAllChanged(selected => {
			this.checkboxColumn.check(selected)
		})

		this.searchService.searchUpdated.subscribe(() => {
			this.activeSong = null
			this.updateSort()
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

	onColClicked(column: 'name' | 'artist' | 'album' | 'genre') {
		if (this.songs.length === 0) { return }
		if (this.sortColumn !== column) {
			this.sortColumn = column
			this.sortDirection = 'descending'
		} else if (this.sortDirection === 'descending') {
			this.sortDirection = 'ascending'
		} else {
			this.sortDirection = 'descending'
		}
		this.updateSort()
	}

	private updateSort() {
		if (this.sortColumn !== null) {
			this.songs.sort(Comparators.comparing(this.sortColumn, { reversed: this.sortDirection === 'ascending' }))
		}
	}

	/**
	 * Called when the user checks the `checkboxColumn`.
	 */
	checkAll(isChecked: boolean) {
		if (isChecked) {
			this.selectionService.selectAll()
		} else {
			this.selectionService.deselectAll()
		}
	}
}
