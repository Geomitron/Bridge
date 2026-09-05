import { Component, inject, signal } from '@angular/core'
import { Router, RouterOutlet } from '@angular/router'

import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { SearchService } from './core/services/search.service'
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
	private searchService = inject(SearchService)
	private router = inject(Router)

	settingsLoaded = signal(false)
	private pendingChartDeepLink: string | null = null

	constructor() {
		window.electron.on.chartDeepLink(chartHash => {
			this.pendingChartDeepLink = chartHash
			if (this.settingsLoaded()) {
				void this.openChartDeepLink()
			}
		})

		// Ensure settings are loaded before rendering the application
		this.settingsService.loadSettings()
			.then(async () => {
				// Pull startup links after the renderer listener is ready.
				const initialChartDeepLink = await window.electron.invoke.getPendingChartDeepLink()
				if (!this.pendingChartDeepLink) {
					this.pendingChartDeepLink = initialChartDeepLink
				}
				console.log('[DEBUG] Setting settingsLoaded = true')
				this.settingsLoaded.set(true)
				console.log('[DEBUG] settingsLoaded:', this.settingsLoaded())
				if (this.pendingChartDeepLink) {
					void this.openChartDeepLink()
				} else {
					this.searchService.search().subscribe()
				}
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

	private async openChartDeepLink(): Promise<void> {
		const chartHash = this.pendingChartDeepLink
		this.pendingChartDeepLink = null
		if (!chartHash) return

		await this.router.navigate(['/browse'])
		this.searchService.searchByHash(chartHash).subscribe()
	}
}
