import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'

import { SearchService } from 'src-angular/app/core/services/search.service.js'
import { SettingsService } from 'src-angular/app/core/services/settings.service.js'

import { ChartData } from '../../../../../../src-shared/interfaces/search.interface.js'
import { msToRoughTime } from '../../../../../../src-shared/UtilFunctions.js'
import { SelectionService } from '../../../../core/services/selection.service.js'

@Component({
	selector: 'tr[app-result-table-row]',
	templateUrl: './result-table-row.component.html',
})
export class ResultTableRowComponent implements OnInit {
	@Input() song: ChartData[]

	@Output() rowFocused: EventEmitter<string> = new EventEmitter()

	constructor(
		private selectionService: SelectionService,
		private searchService: SearchService,
		private settingsService: SettingsService,
	) { }

	ngOnInit() {
		this.selectionService.selections[this.groupId] = this.selectionService.isAllSelected()
	}

	get groupId() {
		return this.song[0].groupId
	}

	hasColumn(column: string) {
		return this.settingsService.visibleColumns.includes(column)
	}

	get songLength() {
		return msToRoughTime(this.song[0].notesData.effectiveLength)
	}

	get songDifficulty() {
		switch (this.searchService.instrument.value) {
			case 'guitar': return this.song[0].diff_guitar ?? '?'
			case 'guitarcoop': return this.song[0].diff_guitar_coop ?? '?'
			case 'rhythm': return this.song[0].diff_rhythm ?? '?'
			case 'bass': return this.song[0].diff_bass ?? '?'
			case 'drums': return this.song[0].diff_drums ?? '?'
			case 'keys': return this.song[0].diff_keys ?? '?'
			case 'guitarghl': return this.song[0].diff_guitarghl ?? '?'
			case 'guitarcoopghl': return this.song[0].diff_guitar_coop_ghl ?? '?'
			case 'rhythmghl': return this.song[0].diff_rhythm_ghl ?? '?'
			case 'bassghl': return this.song[0].diff_bassghl ?? '?'
			default: ''
		}
	}

	get uploaded() {
		return this.song[0].modifiedTime
	}

	get selected() {
		return this.selectionService.selections[this.groupId] ?? false
	}
	set selected(value: boolean) {
		this.selectionService.selections[this.groupId] = value
	}
}
