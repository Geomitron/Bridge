import { AfterViewInit, Component, ElementRef, HostBinding, ViewChild } from '@angular/core'

import { SearchService } from 'src-angular/app/core/services/search.service'

@Component({
	selector: 'app-browse',
	templateUrl: './browse.component.html',
})
export class BrowseComponent implements AfterViewInit {
	@HostBinding('class.contents') contents = true

	@ViewChild('resultTableDiv', { static: true }) resultTableDiv: ElementRef

	constructor(private searchService: SearchService) { }

	ngAfterViewInit() {
		this.searchService.newSearch.subscribe(() => {
			this.resultTableDiv.nativeElement.scrollTop = 0
		})
	}
}
