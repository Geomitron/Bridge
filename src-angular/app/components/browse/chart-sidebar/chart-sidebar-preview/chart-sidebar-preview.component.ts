import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, HostBinding, input, OnDestroy, ViewChild, inject, effect } from '@angular/core'
import { Difficulty, Instrument } from 'scan-chart'
import { SettingsService } from 'src-angular/app/core/services/settings.service.js'
import { ChartData } from 'src-shared/interfaces/search.interface.js'
import type { ChartPreviewPlayer } from 'chart-preview'
import 'chart-preview'

@Component({
	selector: 'app-chart-sidebar-preview',
	standalone: true,
	imports: [],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './chart-sidebar-preview.component.html',
})
export class ChartSidebarPreviewComponent implements OnDestroy {
	private settingsService = inject(SettingsService)

	@HostBinding('class.h-full') height = true
	@ViewChild('player') playerRef: ElementRef<ChartPreviewPlayer>

	selectedChart = input.required<ChartData>()
	instrument = input.required<Instrument>()
	difficulty = input.required<Difficulty>()

	initialVolume = this.settingsService.volume
	private isLoaded = false

	constructor() {
		// Update volume in settings when player emits volume changes
		effect(() => {
			const player = this.player
			if (player) {
				player.addEventListener('player-statechange', () => {
					// Sync volume back to settings if changed via player controls
					if (player.volume !== undefined && player.volume !== this.settingsService.volume) {
						this.settingsService.volume = player.volume
					}
				})
			}
		})
	}

	ngOnDestroy() {
		this.endChartPreview()
	}

	get player(): ChartPreviewPlayer | undefined {
		return this.playerRef?.nativeElement
	}

	private getChartUrl(): string {
		const chart = this.selectedChart()
		return `https://files.enchor.us/${chart.md5}${chart.hasVideoBackground ? '_novideo' : ''}.sng`
	}

	private getInitialSeekPercent(): number {
		const chart = this.selectedChart()
		return (chart.preview_start_time ?? 0) / (chart.song_length ?? 5 * 60 * 1000)
	}

	private async loadChart() {
		if (!this.player) return

		try {
			await this.player.loadFromUrl({
				url: this.getChartUrl(),
				instrument: this.instrument(),
				difficulty: this.difficulty(),
				initialSeekPercent: this.getInitialSeekPercent(),
			})
			this.isLoaded = true
		} catch (error) {
			console.error('Failed to load chart preview:', error)
		}
	}

	/**
	 * Called by parent when instrument/difficulty changes.
	 * Reloads the chart with new settings if already loaded.
	 */
	async resetChartPreview() {
		if (this.player && this.isLoaded) {
			await this.loadChart()
		}
	}

	/**
	 * Called by parent when closing the preview modal.
	 * Disposes of the player and releases resources.
	 */
	endChartPreview() {
		if (this.player) {
			this.player.dispose()
			this.isLoaded = false
		}
	}

	/**
	 * Handles first interaction with the player to trigger lazy loading.
	 */
	async onPlayerInteraction() {
		if (!this.isLoaded && this.player) {
			await this.loadChart()
			// Auto-play after initial load
			await this.player.play()
		}
	}
}
