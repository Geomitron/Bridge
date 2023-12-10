import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'

import { ChartData } from '../../../../../../src-shared/interfaces/search.interface'
import { SelectionService } from '../../../../core/services/selection.service'

@Component({
	selector: 'tr[app-result-table-row]',
	templateUrl: './result-table-row.component.html',
	styleUrls: ['./result-table-row.component.scss'],
})
export class ResultTableRowComponent implements AfterViewInit {
	@Input() song: ChartData[]

	@ViewChild('checkbox', { static: true }) checkbox: ElementRef

	constructor(private selectionService: SelectionService) { }

	get songID() {
		return this.song[0].songId ?? this.song[0].chartId
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
