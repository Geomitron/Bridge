import { Component, HostBinding } from '@angular/core'

@Component({
	selector: 'app-browse',
	templateUrl: './browse.component.html',
})
export class BrowseComponent {
	@HostBinding('class.contents') contents = true
}
