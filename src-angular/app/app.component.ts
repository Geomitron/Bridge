import { Component } from '@angular/core'

import { SettingsService } from './core/services/settings.service'
import { SongListService } from './core/services/songlist.service'

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styles: [],
	standalone: false,
})
export class AppComponent {

	settingsLoaded = false

	constructor(settingsService: SettingsService, songListService: SongListService) {
		// Ensure settings are loaded before rendering the application
		settingsService.loadSettings().then(() => this.settingsLoaded = true)
		// Load song lists in the background (not critical for initial render)
		songListService.loadLists()

		document.addEventListener('keydown', event => {
			if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0')) {
				event.preventDefault()
				if (event.key === '+' || event.key === '=') {
					settingsService.zoomIn()
				} else if (event.key === '-') {
					settingsService.zoomOut()
				} else {
					settingsService.zoomFactor = 1
				}
			}
		})

		document.addEventListener('wheel', event => {
			if (event.ctrlKey && event.deltaY !== 0) {
				if (event.deltaY > 0) {
					settingsService.zoomOut()
				} else {
					settingsService.zoomIn()
				}
			}
		})
	}
}
