import { AfterViewInit, Component, ElementRef, HostBinding, ViewChild } from '@angular/core'

@Component({
	selector: 'app-browse',
	templateUrl: './browse.component.html',
	standalone: false,
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
