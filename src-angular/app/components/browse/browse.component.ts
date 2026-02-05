import { AfterViewInit, Component, ElementRef, HostBinding, ViewChild } from '@angular/core'

import { SearchBarComponent } from './search-bar/search-bar.component'
import { ResultTableComponent } from './result-table/result-table.component'
import { ChartSidebarComponent } from './chart-sidebar/chart-sidebar.component'
import { StatusBarComponent } from './status-bar/status-bar.component'

@Component({
	selector: 'app-browse',
	standalone: true,
	imports: [SearchBarComponent, ResultTableComponent, ChartSidebarComponent, StatusBarComponent],
	templateUrl: './browse.component.html',
})
export class BrowseComponent implements AfterViewInit {
	@HostBinding('class.contents') contents = true

	@ViewChild('chartSidebarDiv') chartSidebarDiv: ElementRef<HTMLDivElement>

	ngAfterViewInit(): void {
		this.adjustSidebarWidth()
		window.addEventListener('resize', this.adjustSidebarWidth.bind(this))
	}

	adjustSidebarWidth() {
		const newWidth = Math.max(310, Math.min(window.innerHeight * 0.4, 512))
		this.chartSidebarDiv.nativeElement.style.width = `${newWidth}px`
	}
}
