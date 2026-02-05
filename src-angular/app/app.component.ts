import { Component, inject, signal } from '@angular/core'
import { RouterOutlet } from '@angular/router'

import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { SettingsService } from './core/services/settings.service'

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, ToolbarComponent],
	templateUrl: './app.component.html',
	styles: [],
})
export class AppComponent {
	private settingsService = inject(SettingsService)

	settingsLoaded = signal(false)

	constructor() {
		// Ensure settings are loaded before rendering the application
		this.settingsService.loadSettings()
			.then(() => {
				console.log('[DEBUG] Setting settingsLoaded = true')
				this.settingsLoaded.set(true)
				console.log('[DEBUG] settingsLoaded:', this.settingsLoaded())
			})
			.catch(err => console.error('Failed to load settings:', err))

		document.addEventListener('keydown', event => {
			if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0')) {
				event.preventDefault()
				if (event.key === '+' || event.key === '=') {
					this.settingsService.zoomIn()
				} else if (event.key === '-') {
					this.settingsService.zoomOut()
				} else {
					this.settingsService.zoomFactor = 1
				}
			}
		})

		document.addEventListener('wheel', event => {
			if (event.ctrlKey && event.deltaY !== 0) {
				if (event.deltaY > 0) {
					this.settingsService.zoomOut()
				} else {
					this.settingsService.zoomIn()
				}
			}
		})
	}
}
