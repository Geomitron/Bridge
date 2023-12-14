import { Component, HostBinding, ViewChild } from '@angular/core'

import { SearchService } from 'src-angular/app/core/services/search.service'

import { ChartSidebarComponent } from './chart-sidebar/chart-sidebar.component'
import { ResultTableComponent } from './result-table/result-table.component'
import { StatusBarComponent } from './status-bar/status-bar.component'

@Component({
	selector: 'app-browse',
	templateUrl: './browse.component.html',
})
export class BrowseComponent {
	@HostBinding('class.contents') contents = true
	@ViewChild('resultTable', { static: true }) resultTable: ResultTableComponent
	@ViewChild('chartSidebar', { static: true }) chartSidebar: ChartSidebarComponent
	@ViewChild('statusBar', { static: true }) statusBar: StatusBarComponent

	constructor(private searchService: SearchService) { }

	// TODO
	// ngAfterViewInit() {
	// 	const $tableColumn = $('#table-column')
	// 	$tableColumn.on('scroll', () => {
	// 		const pos = $tableColumn[0].scrollTop + $tableColumn[0].offsetHeight
	// 		const max = $tableColumn[0].scrollHeight
	// 		if (pos >= max - 5) {
	// 			this.searchService.updateScroll()
	// 		}
	// 	})

	// 	this.searchService.onNewSearch(() => {
	// 		$tableColumn.scrollTop(0)
	// 	})
	// }
}
