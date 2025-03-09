import { Component, Input } from '@angular/core'

import _ from 'lodash'
import { Instrument } from 'scan-chart'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { instrumentToDiff } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar-instrument',
	templateUrl: './chart-sidebar-instrument.component.html',
	standalone: false,
})
export class ChartSidebarInstrumentComponent {

	@Input() chart: ChartData
	@Input() instrument: Instrument | 'vocals'

	getDiff() {
		const diff = this.chart[instrumentToDiff(this.instrument)]
		return diff === null || diff < 0 ? '?' : diff
	}

	getEMHXString() {
		if (this.instrument === 'vocals') { return 'Vocals' }

		const difficulties = this.chart.notesData.noteCounts
			.filter(nc => nc.instrument === this.instrument && nc.count > 0)
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
	}
}
