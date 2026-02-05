import { Component, input, computed } from '@angular/core'

import _ from 'lodash'
import { Instrument } from 'scan-chart'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { instrumentToDiff } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar-instrument',
	standalone: true,
	imports: [],
	templateUrl: './chart-sidebar-instrument.component.html',
})
export class ChartSidebarInstrumentComponent {

	chart = input.required<ChartData>()
	instrument = input.required<Instrument | 'vocals'>()

	diff = computed(() => {
		const diff = this.chart()[instrumentToDiff(this.instrument())]
		return diff === null || diff < 0 ? '?' : diff
	})

	emhxString = computed(() => {
		const instrument = this.instrument()
		if (instrument === 'vocals') { return 'Vocals' }

		const difficulties = this.chart().notesData.noteCounts
			.filter(nc => nc.instrument === instrument && nc.count > 0)
			.map(nc => nc.difficulty)

		if (difficulties.length === 1) {
			return _.capitalize(difficulties[0])
		}

		let str = ''
		if (difficulties.includes('easy')) { str += 'E' }
		if (difficulties.includes('medium')) { str += 'M' }
		if (difficulties.includes('hard')) { str += 'H' }
		if (difficulties.includes('expert')) { str += 'X' }

		return str
	})
}
