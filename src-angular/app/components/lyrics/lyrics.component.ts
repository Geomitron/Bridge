/**
 * Bridge Lyrics Module - Angular Component
 */

import { Component, OnInit, ViewChild, ElementRef, OnDestroy, inject, signal, effect, DestroyRef } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ChartLyricsMatch, LyricsSearchResult, LyricsDownloadProgress } from '../../../../src-shared/interfaces/lyrics.interface.js'
import { LyricsService } from '../../core/services/lyrics.service'
import { CatalogService } from '../../core/services/catalog.service'

interface LyricLine {
	time: number  // ms
	text: string
}

@Component({
	selector: 'app-lyrics',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './lyrics.component.html',
})
export class LyricsComponent implements OnInit, OnDestroy {
	private lyricsService = inject(LyricsService)
	private catalogService = inject(CatalogService)
	private destroyRef = inject(DestroyRef)

	@ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>

	// Data
	chartsMissingLyrics = signal<ChartLyricsMatch[]>([])
	filteredCharts = signal<ChartLyricsMatch[]>([])
	searchResults = signal<LyricsSearchResult[]>([])

	// UI State
	isLoading = signal(false)
	isSearching = signal(false)
	isDownloading = signal(false)
	selectedChart = signal<ChartLyricsMatch | null>(null)
	selectedLyrics = signal<LyricsSearchResult | null>(null)
	progress = signal<LyricsDownloadProgress | null>(null)
	error = signal<string | null>(null)
	successMessage = signal<string | null>(null)

	// Search state
	searchArtist = signal('')
	searchTitle = signal('')

	// Timing offset in milliseconds (positive = delay lyrics)
	offsetMs = signal(0)

	// Sync tool state
	showSyncTool = signal(false)
	audioSrc = signal<string | null>(null)
	isPlaying = signal(false)
	currentTime = signal(0)
	lyricsPreviewLines = signal<LyricLine[]>([])
	audioLoaded = signal(false)
	audioError = signal<string | null>(null)
	hasVocalsTrack = signal(false)
	detectedVocalStartMs = signal<number | null>(null)
	syncTargetTime = signal(0)  // Where in the audio the first lyric should appear (ms)
	maxSyncTime = signal(60000)  // Max slider value (60 seconds)
	offsetConfirmed = signal(false)
	private audioTimeInterval: any = null

	// Expose Math for template
	Math = Math

	// Filter state
	filterQuery = signal('')
	filterArtist = signal('')
	sortField = signal<'artist' | 'name'>('artist')
	sortDirection = signal<'asc' | 'desc'>('asc')
	artistOptions = signal<string[]>([])

	constructor() {
		// Subscribe to progress signal from service
		effect(() => {
			this.progress.set(this.lyricsService.progress())
		})
	}

	ngOnInit(): void {
		this.loadChartsMissingLyrics().then(() => {
			// Check if we were navigated here with a pre-selected chart
			this.checkForPreselectedChart()
		})
	}

	private checkForPreselectedChart(): void {
		const stored = sessionStorage.getItem('selectedChartForLyrics')
		if (stored) {
			sessionStorage.removeItem('selectedChartForLyrics')
			try {
				const chartData = JSON.parse(stored)
				// Create a ChartLyricsMatch from the stored data
				const chart: ChartLyricsMatch = {
					chartId: chartData.id,
					chartName: chartData.name,
					chartArtist: chartData.artist,
					chartAlbum: chartData.album,
					chartPath: chartData.path,
					chartType: chartData.chartType,
					songLength: null,
					suggestedQuery: `${chartData.artist} ${chartData.name}`,
				}
				// Select this chart
				this.selectChart(chart)
			} catch (err) {
				console.error('Failed to parse pre-selected chart:', err)
			}
		}
	}

	async loadChartsMissingLyrics(): Promise<void> {
		this.isLoading.set(true)
		this.error.set(null)

		try {
			const charts = await this.lyricsService.getChartsMissingLyrics()
			this.chartsMissingLyrics.set(charts)
			this.buildArtistOptions()
			this.applyFilter()
		} catch (err) {
			this.error.set(`Failed to load charts: ${err}`)
		} finally {
			this.isLoading.set(false)
		}
	}

	buildArtistOptions(): void {
		const artists = new Set<string>()
		for (const chart of this.chartsMissingLyrics()) {
			if (chart.chartArtist) {
				artists.add(chart.chartArtist)
			}
		}
		this.artistOptions.set(Array.from(artists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		))
	}

	applyFilter(): void {
		let filtered = [...this.chartsMissingLyrics()]

		// Text search
		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			filtered = filtered.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		// Artist filter
		const artistFilter = this.filterArtist()
		if (artistFilter) {
			filtered = filtered.filter(c => c.chartArtist === artistFilter)
		}

		// Sort
		const field = this.sortField()
		const direction = this.sortDirection()
		filtered.sort((a, b) => {
			const aVal = field === 'artist' ? a.chartArtist : a.chartName
			const bVal = field === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return direction === 'asc' ? cmp : -cmp
		})

		this.filteredCharts.set(filtered)
	}

	toggleSortDirection(): void {
		this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc')
		this.applyFilter()
	}

	clearFilters(): void {
		this.filterQuery.set('')
		this.filterArtist.set('')
		this.sortField.set('artist')
		this.sortDirection.set('asc')
		this.applyFilter()
	}

	selectChart(chart: ChartLyricsMatch): void {
		this.selectedChart.set(chart)
		this.searchResults.set([])
		this.selectedLyrics.set(null)
		this.error.set(null)
		this.successMessage.set(null)
		this.offsetMs.set(0)
		this.offsetConfirmed.set(false)
		this.syncTargetTime.set(0)

		// Pre-fill search fields
		this.searchArtist.set(chart.chartArtist)
		this.searchTitle.set(chart.chartName)
	}

	clearSelection(): void {
		this.selectedChart.set(null)
		this.searchResults.set([])
		this.selectedLyrics.set(null)
		this.searchArtist.set('')
		this.searchTitle.set('')
		this.error.set(null)
		this.successMessage.set(null)
	}

	async searchLyrics(): Promise<void> {
		const artist = this.searchArtist()
		const title = this.searchTitle()
		if (!artist.trim() && !title.trim()) {
			this.error.set('Please enter artist or title to search')
			return
		}

		this.isSearching.set(true)
		this.error.set(null)
		this.searchResults.set([])
		this.selectedLyrics.set(null)

		try {
			const results = await this.lyricsService.searchLyrics(artist.trim(), title.trim())
			this.searchResults.set(results)

			if (results.length === 0) {
				this.error.set('No synced lyrics found. Try different search terms.')
			}
		} catch (err) {
			this.error.set(`Search failed: ${err}`)
		} finally {
			this.isSearching.set(false)
		}
	}

	selectLyrics(lyrics: LyricsSearchResult): void {
		this.selectedLyrics.set(lyrics)
	}

	previewLyrics(lyrics: LyricsSearchResult): void {
		// Open LRCLIB page
		window.electron.emit.openUrl(`https://lrclib.net/`)
	}

	async downloadLyrics(): Promise<void> {
		const chart = this.selectedChart()
		const lyrics = this.selectedLyrics()
		if (!chart || !lyrics) return

		this.isDownloading.set(true)
		this.error.set(null)
		this.successMessage.set(null)

		try {
			const result = await this.lyricsService.downloadLyrics(
				chart.chartId,
				lyrics.id,
				chart.chartPath,
				chart.chartType,
				this.offsetMs()
			)

			if (result.success) {
				this.successMessage.set('Lyrics added successfully!')

				// Remove from list
				this.chartsMissingLyrics.update(charts =>
					charts.filter(c => c.chartId !== chart.chartId)
				)
				this.applyFilter()

				// Refresh catalog so Library tab shows updated status
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()

				// Reset offset for next chart
				this.offsetMs.set(0)

				// Clear selection after a moment
				setTimeout(() => {
					this.clearSelection()
				}, 1500)
			} else {
				this.error.set(result.error || 'Failed to add lyrics')
			}
		} catch (err) {
			this.error.set(`Download failed: ${err}`)
		} finally {
			this.isDownloading.set(false)
		}
	}

	formatDuration(ms: number | null): string {
		if (!ms) return '-'
		const seconds = Math.floor(ms / 1000)
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	formatLyricsDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	// Preview synced lyrics
	getLyricsPreview(syncedLyrics: string | null): string {
		if (!syncedLyrics) return 'No synced lyrics'
		const lines = syncedLyrics.split('\n').slice(0, 5)
		return lines.map(l => l.replace(/\[\d{2}:\d{2}[.:]\d{2,3}\]/g, '').trim()).filter(l => l).join(' / ')
	}

	dismissError(): void {
		this.error.set(null)
	}

	dismissSuccess(): void {
		this.successMessage.set(null)
	}

	// ==================== Sync Tool Methods ====================

	ngOnDestroy(): void {
		this.closeSyncTool()
	}

	async openSyncTool(): Promise<void> {
		const chart = this.selectedChart()
		const lyrics = this.selectedLyrics()
		if (!chart || !lyrics) return

		this.showSyncTool.set(true)
		this.currentTime.set(0)
		this.isPlaying.set(false)
		this.audioSrc.set(null)
		this.audioLoaded.set(false)
		this.audioError.set(null)
		this.hasVocalsTrack.set(false)
		this.detectedVocalStartMs.set(null)
		this.syncTargetTime.set(0)

		// Parse LRC to get first few lines for preview
		this.parseLyricsPreview()

		// Initialize syncTargetTime from first LRC line if no offset yet
		const previewLines = this.lyricsPreviewLines()
		if (previewLines.length > 0 && !this.offsetConfirmed()) {
			this.syncTargetTime.set(previewLines[0].time)
		}

		// Find audio file in chart folder and load as data URL
		try {
			const result = await this.lyricsService.getChartAudioPath(chart.chartPath)
			if (result) {
				this.audioSrc.set(result.dataUrl)
				this.hasVocalsTrack.set(result.hasVocalsTrack)
				this.detectedVocalStartMs.set(result.vocalStartMs)

				console.log('Audio loaded:', {
					hasVocalsTrack: result.hasVocalsTrack,
					vocalStartMs: result.vocalStartMs,
					dataLength: result.dataUrl.length,
				})

				// Auto-set syncTargetTime if we detected vocal start
				if (result.vocalStartMs !== null) {
					this.syncTargetTime.set(result.vocalStartMs)
					this.updateOffsetFromSyncTarget()
				}
			} else {
				this.audioSrc.set(null)
				this.audioError.set('No audio file found in chart folder')
				console.log('No audio file found')
			}
		} catch (err) {
			console.error('Failed to get audio:', err)
			this.audioSrc.set(null)
			this.audioError.set(`Failed to load audio: ${err}`)
		}
	}

	closeSyncTool(): void {
		this.showSyncTool.set(false)
		this.stopAudioTracking()

		// Stop and reset audio
		if (this.audioPlayerRef?.nativeElement) {
			this.audioPlayerRef.nativeElement.pause()
			this.audioPlayerRef.nativeElement.currentTime = 0
		}

		this.audioSrc.set(null)
		this.isPlaying.set(false)
		this.currentTime.set(0)
		this.audioLoaded.set(false)
		this.audioError.set(null)
		this.hasVocalsTrack.set(false)
		this.detectedVocalStartMs.set(null)
		// Don't reset syncTargetTime - we need it for the confirmed display
	}

	onAudioLoaded(): void {
		this.audioLoaded.set(true)
		this.audioError.set(null)

		// Set max sync time based on audio duration (cap at 2 minutes)
		if (this.audioPlayerRef?.nativeElement) {
			const duration = this.audioPlayerRef.nativeElement.duration * 1000
			this.maxSyncTime.set(Math.min(duration, 120000))
		}

		console.log('Audio element loaded successfully')
	}

	onAudioError(event: Event): void {
		const audio = event.target as HTMLAudioElement
		this.audioLoaded.set(false)
		this.audioError.set(`Audio playback error: ${audio.error?.message || 'Unknown error'}`)
		console.error('Audio error:', audio.error)
	}

	onSyncTargetChange(value: number): void {
		this.syncTargetTime.set(value)
		this.updateOffsetFromSyncTarget()
	}

	updateOffsetFromSyncTarget(): void {
		const previewLines = this.lyricsPreviewLines()
		if (previewLines.length > 0) {
			const firstLrcTime = previewLines[0].time
			this.offsetMs.set(Math.round(this.syncTargetTime() - firstLrcTime))
		}
	}

	previewFromTarget(): void {
		if (!this.audioPlayerRef?.nativeElement || !this.audioLoaded()) return

		const audio = this.audioPlayerRef.nativeElement

		// Seek to slightly before the target time (0.5s before) so user can hear the lead-in
		const seekTime = Math.max(0, (this.syncTargetTime() / 1000) - 0.5)
		audio.currentTime = seekTime
		audio.play()
		this.isPlaying.set(true)
		this.startAudioTracking()
	}

	stopPreview(): void {
		if (!this.audioPlayerRef?.nativeElement) return

		this.audioPlayerRef.nativeElement.pause()
		this.isPlaying.set(false)
		this.stopAudioTracking()
	}

	acceptSyncTiming(): void {
		this.offsetConfirmed.set(true)
		this.closeSyncTool()
		this.successMessage.set(`Timing set: First lyric will appear at ${this.formatTime(this.syncTargetTime() / 1000)}`)
	}

	parseLyricsPreview(): void {
		const lyrics = this.selectedLyrics()
		if (!lyrics?.syncedLyrics) {
			this.lyricsPreviewLines.set([])
			return
		}

		const lines: LyricLine[] = []
		const lrcLines = lyrics.syncedLyrics.split('\n')

		for (const line of lrcLines) {
			// Parse [mm:ss.xx] or [mm:ss:xx] format
			const match = line.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/)
			if (match) {
				const mins = parseInt(match[1], 10)
				const secs = parseInt(match[2], 10)
				const ms = match[3].length === 2
					? parseInt(match[3], 10) * 10
					: parseInt(match[3], 10)
				const text = match[4].trim()

				if (text) {
					const time = (mins * 60 + secs) * 1000 + ms
					lines.push({ time, text })
				}
			}

			// Only show first 8 lines
			if (lines.length >= 8) break
		}

		this.lyricsPreviewLines.set(lines)
	}

	private startAudioTracking(): void {
		this.stopAudioTracking()
		this.audioTimeInterval = setInterval(() => {
			if (this.audioPlayerRef?.nativeElement) {
				this.currentTime.set(this.audioPlayerRef.nativeElement.currentTime)

				// Check if audio ended
				if (this.audioPlayerRef.nativeElement.ended) {
					this.isPlaying.set(false)
					this.stopAudioTracking()
				}
			}
		}, 100)
	}

	private stopAudioTracking(): void {
		if (this.audioTimeInterval) {
			clearInterval(this.audioTimeInterval)
			this.audioTimeInterval = null
		}
	}

	formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		const ms = Math.floor((seconds % 1) * 10)
		return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
	}

	// Event handlers for template two-way binding
	onFilterQueryChange(value: string): void {
		this.filterQuery.set(value)
		this.applyFilter()
	}

	onFilterArtistChange(value: string): void {
		this.filterArtist.set(value)
		this.applyFilter()
	}

	onSearchArtistChange(value: string): void {
		this.searchArtist.set(value)
	}

	onSearchTitleChange(value: string): void {
		this.searchTitle.set(value)
	}

	onOffsetMsChange(value: number): void {
		this.offsetMs.set(value)
	}
}
