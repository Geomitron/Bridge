import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'

import { SongResult } from '../../../../../../src-shared/interfaces/search.interface'
import { SelectionService } from '../../../../core/services/selection.service'

@Component({
	selector: 'tr[app-result-table-row]',
	templateUrl: './result-table-row.component.html',
	styleUrls: ['./result-table-row.component.scss'],
})
export class ResultTableRowComponent implements AfterViewInit {
	@Input() result: SongResult

	@ViewChild('checkbox', { static: true }) checkbox: ElementRef

	constructor(private selectionService: SelectionService) { }

	get songID() {
		return this.result.id
	}

	ngAfterViewInit() {
		this.selectionService.onSelectionChanged(this.songID, isChecked => {
			if (isChecked) {
				// TODO
				// $(this.checkbox.nativeElement).checkbox('check')
			} else {
				// $(this.checkbox.nativeElement).checkbox('uncheck')
			}
		})

		// $(this.checkbox.nativeElement).checkbox({
		// 	onChecked: () => {
		// 		this.selectionService.selectSong(this.songID)
		// 	},
		// 	onUnchecked: () => {
		// 		this.selectionService.deselectSong(this.songID)
		// 	},
		// })
	}
}
