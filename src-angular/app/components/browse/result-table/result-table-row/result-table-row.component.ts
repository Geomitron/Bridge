import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'

import { ChartData } from '../../../../../../src-shared/interfaces/search.interface'
import { SelectionService } from '../../../../core/services/selection.service'

@Component({
	selector: 'tr[app-result-table-row]',
	templateUrl: './result-table-row.component.html',
})
export class ResultTableRowComponent implements OnInit {
	@Input() song: ChartData[]

	@Output() rowFocused: EventEmitter<string> = new EventEmitter()

	constructor(private selectionService: SelectionService) { }

	ngOnInit() {
		this.selectionService.selections[this.groupId] = this.selectionService.isAllSelected()
	}

	get groupId() {
		return this.song[0].groupId
	}

	get selected() {
		return this.selectionService.selections[this.groupId] ?? false
	}
	set selected(value: boolean) {
		this.selectionService.selections[this.groupId] = value
	}
}
