import { Component, input, output, OnInit, inject, computed, effect, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DatePipe } from '@angular/common'

import { SearchService } from 'src-angular/app/core/services/search.service.js'
import { SettingsService } from 'src-angular/app/core/services/settings.service.js'

import { ChartData } from '../../../../../../src-shared/interfaces/search.interface.js'
import { msToRoughTime } from '../../../../../../src-shared/UtilFunctions.js'
import { SelectionService } from '../../../../core/services/selection.service.js'

@Component({
	selector: 'tr[app-result-table-row]',
	standalone: true,
	imports: [FormsModule, DatePipe],
	templateUrl: './result-table-row.component.html',
})
export class ResultTableRowComponent implements OnInit {
	private selectionService = inject(SelectionService)
	private searchService = inject(SearchService)
	private settingsService = inject(SettingsService)

	song = input.required<ChartData[]>()
	isInLibrary = input(false)

	rowFocused = output<void>()

	groupId = computed(() => this.song()[0].groupId)

	songLength = computed(() => msToRoughTime(this.song()[0].notesData.effectiveLength))

	songDifficulty = computed(() => {
		const instrument = this.searchService.instrument()
		const chart = this.song()[0]
		switch (instrument) {
			case 'guitar': return chart.diff_guitar ?? '?'
			case 'guitarcoop': return chart.diff_guitar_coop ?? '?'
			case 'rhythm': return chart.diff_rhythm ?? '?'
			case 'bass': return chart.diff_bass ?? '?'
			case 'drums': return chart.diff_drums ?? '?'
			case 'keys': return chart.diff_keys ?? '?'
			case 'guitarghl': return chart.diff_guitarghl ?? '?'
			case 'guitarcoopghl': return chart.diff_guitar_coop_ghl ?? '?'
			case 'rhythmghl': return chart.diff_rhythm_ghl ?? '?'
			case 'bassghl': return chart.diff_bassghl ?? '?'
			default: return ''
		}
	})

	uploaded = computed(() => this.song()[0].modifiedTime)

	selected = computed(() => this.selectionService.getSelection(this.groupId()))

	ngOnInit() {
		this.selectionService.setSelection(this.groupId(), this.selectionService.isAllSelected())
	}

	hasColumn(column: string) {
		return this.settingsService.visibleColumns.includes(column)
	}

	setSelected(value: boolean) {
		this.selectionService.setSelection(this.groupId(), value)
	}
}
