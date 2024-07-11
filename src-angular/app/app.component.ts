import { Component } from '@angular/core'

import { SettingsService } from './core/services/settings.service'

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styles: [],
})
export class AppComponent {

	settingsLoaded = false

	constructor(settingsService: SettingsService) {
		// Ensure settings are loaded before rendering the application
		settingsService.loadSettings().then(() => this.settingsLoaded = true)

		document.addEventListener('keydown', event => {
			if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=')) {
				event.preventDefault()
				if (event.key === '+' || event.key === '=') {
					settingsService.zoomIn()
				} else {
					settingsService.zoomOut()
				}
			}
		})
	}
}
