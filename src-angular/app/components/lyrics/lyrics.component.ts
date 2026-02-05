/**
 * Bridge Lyrics Module - Angular Component
 */

import { ChangeDetectorRef, Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core'
import { ChartLyricsMatch, LyricsSearchResult, LyricsDownloadProgress } from '../../../../src-shared/interfaces/lyrics.interface.js'
import { LyricsService } from '../../core/services/lyrics.service'
import { CatalogService } from '../../core/services/catalog.service'

interface LyricLine {
	time: number  // ms
	text: string
}

@Component({
	selector: 'app-lyrics',
	templateUrl: './lyrics.component.html',
	standalone: false,
})
export class LyricsComponent implements OnInit, OnDestroy {
	@ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>

	// Data
	chartsMissingLyrics: ChartLyricsMatch[] = []
	filteredCharts: ChartLyricsMatch[] = []
	searchResults: LyricsSearchResult[] = []

	// UI State
	isLoading = false
	isSearching = false
	isDownloading = false
	selectedChart: ChartLyricsMatch | null = null
	selectedLyrics: LyricsSearchResult | null = null
	progress: LyricsDownloadProgress | null = null
	error: string | null = null
	successMessage: string | null = null

	// Search state
	searchArtist = ''
	searchTitle = ''

	// Timing offset in milliseconds (positive = delay lyrics)
	offsetMs = 0

	// Sync tool state
	showSyncTool = false
	audioSrc: string | null = null
	isPlaying = false
	currentTime = 0
	lyricsPreviewLines: LyricLine[] = []
	audioLoaded = false
	audioError: string | null = null
	hasVocalsTrack = false
	detectedVocalStartMs: number | null = null
	syncTargetTime = 0  // Where in the audio the first lyric should appear (ms)
	maxSyncTime = 60000  // Max slider value (60 seconds)
	offsetConfirmed = false
	private audioTimeInterval: any = null

	// Expose Math for template
	Math = Math

	// Filter state
	filterQuery = ''
	filterArtist = ''
	sortField: 'artist' | 'name' = 'artist'
	sortDirection: 'asc' | 'desc' = 'asc'
	artistOptions: string[] = []

	constructor(
		private lyricsService: LyricsService,
		private catalogService: CatalogService,
		private ref: ChangeDetectorRef,
	) { }

	ngOnInit(): void {
		this.lyricsService.progress$.subscribe(progress => {
			this.progress = progress
			this.ref.detectChanges()
		})

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
		this.isLoading = true
		this.error = null
		this.ref.detectChanges()

		try {
			this.chartsMissingLyrics = await this.lyricsService.getChartsMissingLyrics()
			this.buildArtistOptions()
			this.applyFilter()
		} catch (err) {
			this.error = `Failed to load charts: ${err}`
		} finally {
			this.isLoading = false
			this.ref.detectChanges()
		}
	}

	buildArtistOptions(): void {
		const artists = new Set<string>()
		for (const chart of this.chartsMissingLyrics) {
			if (chart.chartArtist) {
				artists.add(chart.chartArtist)
			}
		}
		this.artistOptions = Array.from(artists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		)
	}

	applyFilter(): void {
		let filtered = [...this.chartsMissingLyrics]

		// Text search
		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			filtered = filtered.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		// Artist filter
		if (this.filterArtist) {
			filtered = filtered.filter(c => c.chartArtist === this.filterArtist)
		}

		// Sort
		filtered.sort((a, b) => {
			const aVal = this.sortField === 'artist' ? a.chartArtist : a.chartName
			const bVal = this.sortField === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return this.sortDirection === 'asc' ? cmp : -cmp
		})

		this.filteredCharts = filtered
		this.ref.detectChanges()
	}

	toggleSortDirection(): void {
		this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
		this.applyFilter()
	}

	clearFilters(): void {
		this.filterQuery = ''
		this.filterArtist = ''
		this.sortField = 'artist'
		this.sortDirection = 'asc'
		this.applyFilter()
	}

	selectChart(chart: ChartLyricsMatch): void {
		this.selectedChart = chart
		this.searchResults = []
		this.selectedLyrics = null
		this.error = null
		this.successMessage = null
		this.offsetMs = 0
		this.offsetConfirmed = false
		this.syncTargetTime = 0

		// Pre-fill search fields
		this.searchArtist = chart.chartArtist
		this.searchTitle = chart.chartName

		this.ref.detectChanges()
	}

	clearSelection(): void {
		this.selectedChart = null
		this.searchResults = []
		this.selectedLyrics = null
		this.searchArtist = ''
		this.searchTitle = ''
		this.error = null
		this.successMessage = null
		this.ref.detectChanges()
	}

	async searchLyrics(): Promise<void> {
		if (!this.searchArtist.trim() && !this.searchTitle.trim()) {
			this.error = 'Please enter artist or title to search'
			return
		}

		this.isSearching = true
		this.error = null
		this.searchResults = []
		this.selectedLyrics = null
		this.ref.detectChanges()

		try {
			this.searchResults = await this.lyricsService.searchLyrics(
				this.searchArtist.trim(),
				this.searchTitle.trim()
			)

			if (this.searchResults.length === 0) {
				this.error = 'No synced lyrics found. Try different search terms.'
			}
		} catch (err) {
			this.error = `Search failed: ${err}`
		} finally {
			this.isSearching = false
			this.ref.detectChanges()
		}
	}

	selectLyrics(lyrics: LyricsSearchResult): void {
		this.selectedLyrics = lyrics
		this.ref.detectChanges()
	}

	previewLyrics(lyrics: LyricsSearchResult): void {
		// Open LRCLIB page
		window.electron.emit.openUrl(`https://lrclib.net/`)
	}

	async downloadLyrics(): Promise<void> {
		if (!this.selectedChart || !this.selectedLyrics) return

		this.isDownloading = true
		this.error = null
		this.successMessage = null
		this.ref.detectChanges()

		try {
			const result = await this.lyricsService.downloadLyrics(
				this.selectedChart.chartId,
				this.selectedLyrics.id,
				this.selectedChart.chartPath,
				this.selectedChart.chartType,
				this.offsetMs
			)

			if (result.success) {
				this.successMessage = 'Lyrics added successfully!'

				// Remove from list
				this.chartsMissingLyrics = this.chartsMissingLyrics.filter(
					c => c.chartId !== this.selectedChart!.chartId
				)
				this.applyFilter()

				// Refresh catalog so Library tab shows updated status
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()

				// Reset offset for next chart
				this.offsetMs = 0

				// Clear selection after a moment
				setTimeout(() => {
					this.clearSelection()
				}, 1500)
			} else {
				this.error = result.error || 'Failed to add lyrics'
			}
		} catch (err) {
			this.error = `Download failed: ${err}`
		} finally {
			this.isDownloading = false
			this.ref.detectChanges()
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
		this.error = null
		this.ref.detectChanges()
	}

	dismissSuccess(): void {
		this.successMessage = null
		this.ref.detectChanges()
	}

	// ==================== Sync Tool Methods ====================

	ngOnDestroy(): void {
		this.closeSyncTool()
	}

	async openSyncTool(): Promise<void> {
		if (!this.selectedChart || !this.selectedLyrics) return

		this.showSyncTool = true
		this.currentTime = 0
		this.isPlaying = false
		this.audioSrc = null
		this.audioLoaded = false
		this.audioError = null
		this.hasVocalsTrack = false
		this.detectedVocalStartMs = null
		this.syncTargetTime = 0

		// Parse LRC to get first few lines for preview
		this.parseLyricsPreview()

		// Initialize syncTargetTime from first LRC line if no offset yet
		if (this.lyricsPreviewLines.length > 0 && !this.offsetConfirmed) {
			this.syncTargetTime = this.lyricsPreviewLines[0].time
		}

		this.ref.detectChanges()

		// Find audio file in chart folder and load as data URL
		try {
			const result = await this.lyricsService.getChartAudioPath(this.selectedChart.chartPath)
			if (result) {
				this.audioSrc = result.dataUrl
				this.hasVocalsTrack = result.hasVocalsTrack
				this.detectedVocalStartMs = result.vocalStartMs

				console.log('Audio loaded:', {
					hasVocalsTrack: result.hasVocalsTrack,
					vocalStartMs: result.vocalStartMs,
					dataLength: result.dataUrl.length,
				})

				// Auto-set syncTargetTime if we detected vocal start
				if (result.vocalStartMs !== null) {
					this.syncTargetTime = result.vocalStartMs
					this.updateOffsetFromSyncTarget()
				}
			} else {
				this.audioSrc = null
				this.audioError = 'No audio file found in chart folder'
				console.log('No audio file found')
			}
		} catch (err) {
			console.error('Failed to get audio:', err)
			this.audioSrc = null
			this.audioError = `Failed to load audio: ${err}`
		}

		this.ref.detectChanges()
	}

	closeSyncTool(): void {
		this.showSyncTool = false
		this.stopAudioTracking()

		// Stop and reset audio
		if (this.audioPlayerRef?.nativeElement) {
			this.audioPlayerRef.nativeElement.pause()
			this.audioPlayerRef.nativeElement.currentTime = 0
		}

		this.audioSrc = null
		this.isPlaying = false
		this.currentTime = 0
		this.audioLoaded = false
		this.audioError = null
		this.hasVocalsTrack = false
		this.detectedVocalStartMs = null
		// Don't reset syncTargetTime - we need it for the confirmed display
		this.ref.detectChanges()
	}

	onAudioLoaded(): void {
		this.audioLoaded = true
		this.audioError = null

		// Set max sync time based on audio duration (cap at 2 minutes)
		if (this.audioPlayerRef?.nativeElement) {
			const duration = this.audioPlayerRef.nativeElement.duration * 1000
			this.maxSyncTime = Math.min(duration, 120000)
		}

		console.log('Audio element loaded successfully')
		this.ref.detectChanges()
	}

	onAudioError(event: Event): void {
		const audio = event.target as HTMLAudioElement
		this.audioLoaded = false
		this.audioError = `Audio playback error: ${audio.error?.message || 'Unknown error'}`
		console.error('Audio error:', audio.error)
		this.ref.detectChanges()
	}

	onSyncTargetChange(): void {
		this.updateOffsetFromSyncTarget()
		this.ref.detectChanges()
	}

	updateOffsetFromSyncTarget(): void {
		if (this.lyricsPreviewLines.length > 0) {
			const firstLrcTime = this.lyricsPreviewLines[0].time
			this.offsetMs = Math.round(this.syncTargetTime - firstLrcTime)
		}
	}

	previewFromTarget(): void {
		if (!this.audioPlayerRef?.nativeElement || !this.audioLoaded) return

		const audio = this.audioPlayerRef.nativeElement

		// Seek to slightly before the target time (0.5s before) so user can hear the lead-in
		const seekTime = Math.max(0, (this.syncTargetTime / 1000) - 0.5)
		audio.currentTime = seekTime
		audio.play()
		this.isPlaying = true
		this.startAudioTracking()
		this.ref.detectChanges()
	}

	stopPreview(): void {
		if (!this.audioPlayerRef?.nativeElement) return

		this.audioPlayerRef.nativeElement.pause()
		this.isPlaying = false
		this.stopAudioTracking()
		this.ref.detectChanges()
	}

	acceptSyncTiming(): void {
		this.offsetConfirmed = true
		this.closeSyncTool()
		this.successMessage = `Timing set: First lyric will appear at ${this.formatTime(this.syncTargetTime / 1000)}`
		this.ref.detectChanges()
	}

	parseLyricsPreview(): void {
		if (!this.selectedLyrics?.syncedLyrics) {
			this.lyricsPreviewLines = []
			return
		}

		const lines: LyricLine[] = []
		const lrcLines = this.selectedLyrics.syncedLyrics.split('\n')

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

		this.lyricsPreviewLines = lines
	}

	private startAudioTracking(): void {
		this.stopAudioTracking()
		this.audioTimeInterval = setInterval(() => {
			if (this.audioPlayerRef?.nativeElement) {
				this.currentTime = this.audioPlayerRef.nativeElement.currentTime

				// Check if audio ended
				if (this.audioPlayerRef.nativeElement.ended) {
					this.isPlaying = false
					this.stopAudioTracking()
				}

				this.ref.detectChanges()
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
}
