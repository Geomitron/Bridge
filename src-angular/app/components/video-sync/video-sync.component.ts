/**
 * Bridge Video Sync Module - Component
 */

import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core'
import { VideoSyncService } from '../../core/services/video-sync.service'
import { CatalogService } from '../../core/services/catalog.service'
import { NavigationEnd, Router } from '@angular/router'
import { Subscription, filter } from 'rxjs'
import {
	YouTubeSearchResult,
	VideoDownloadProgress,
	ChartVideoMatch,
} from '../../../../src-shared/interfaces/video-sync.interface.js'

@Component({
	selector: 'app-video-sync',
	templateUrl: './video-sync.component.html',
	standalone: false,
})
export class VideoSyncComponent implements OnInit, OnDestroy {
	private routerSub: Subscription | null = null
	// Tool status
	toolsAvailable: { ytDlp: boolean; ffmpeg: boolean } | null = null
	checkingTools = true

	// Charts without videos
	chartsMissingVideo: ChartVideoMatch[] = []
	filteredCharts: ChartVideoMatch[] = []
	loadingCharts = false

	// Filter/sort state
	filterQuery = ''
	filterArtist = ''
	sortField: 'artist' | 'name' = 'artist'
	sortDirection: 'asc' | 'desc' = 'asc'
	artistOptions: string[] = []

	// Currently selected chart
	selectedChart: ChartVideoMatch | null = null

	// Search
	searchQuery = ''
	searchResults: YouTubeSearchResult[] = []
	isSearching = false
	searchError: string | null = null
	searchSource: 'youtube' | 'url' | 'local' = 'youtube'

	// URL paste
	pasteUrl = ''

	// Local file import
	selectedLocalFile: string | null = null

	// Download
	selectedVideo: YouTubeSearchResult | null = null
	downloadProgress: VideoDownloadProgress | null = null
	isDownloading = false
	downloadError: string | null = null

	// View mode
	viewMode: 'list' | 'search' = 'list'

	constructor(
		private videoSyncService: VideoSyncService,
		private catalogService: CatalogService,
		private ref: ChangeDetectorRef,
		private router: Router,
	) { }

	ngOnInit(): void {
		// Subscribe to observables
		this.videoSyncService.toolsAvailable$.subscribe(tools => {
			this.toolsAvailable = tools
			this.checkingTools = false
			this.ref.detectChanges()
		})

		this.videoSyncService.downloadProgress$.subscribe(progress => {
			this.downloadProgress = progress
			this.ref.detectChanges()

			// Refresh chart list when download completes
			if (progress?.phase === 'complete') {
				this.loadChartsMissingVideo()
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()
			}

			// Handle download errors
			if (progress?.phase === 'error') {
				this.downloadError = progress.message
				this.ref.detectChanges()
			}
		})

		this.videoSyncService.isDownloading$.subscribe(downloading => {
			this.isDownloading = downloading
			this.ref.detectChanges()
		})

		// Listen for navigation to this route (handles route reuse)
		this.routerSub = this.router.events.pipe(
			filter(event => event instanceof NavigationEnd)
		).subscribe((event: any) => {
			if (event.urlAfterRedirects === '/video-sync') {
				this.checkForPreselectedChart()
			}
		})

		// Initial load
		this.loadChartsMissingVideo().then(() => {
			// Check if we were navigated here with a pre-selected chart
			this.checkForPreselectedChart()
		})
	}

	ngOnDestroy(): void {
		if (this.routerSub) {
			this.routerSub.unsubscribe()
		}
	}

	private checkForPreselectedChart(): void {
		const stored = sessionStorage.getItem('selectedChartForVideo')
		if (stored) {
			sessionStorage.removeItem('selectedChartForVideo')
			try {
				const chartData = JSON.parse(stored)
				// Create a ChartVideoMatch from the stored data
				const chart: ChartVideoMatch = {
					chartId: chartData.id,
					chartName: chartData.name,
					chartArtist: chartData.artist,
					chartPath: chartData.path,
					songLength: chartData.songLength,
					suggestedQuery: `${chartData.artist} - ${chartData.name} official video`,
				}
				// Select this chart and go to search view
				this.selectChart(chart)
			} catch (err) {
				console.error('Failed to parse pre-selected chart:', err)
			}
		}
	}

	async loadChartsMissingVideo(): Promise<void> {
		this.loadingCharts = true
		this.ref.detectChanges()

		try {
			this.chartsMissingVideo = await this.videoSyncService.getChartsMissingVideo(10000)
			this.buildArtistOptions()
			this.applyFilter()
		} catch (err) {
			console.error('Failed to load charts:', err)
		} finally {
			this.loadingCharts = false
			this.ref.detectChanges()
		}
	}

	buildArtistOptions(): void {
		const artists = new Set<string>()
		this.chartsMissingVideo.forEach(c => {
			if (c.chartArtist) artists.add(c.chartArtist)
		})
		this.artistOptions = Array.from(artists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		)
	}

	applyFilter(): void {
		let result = [...this.chartsMissingVideo]

		// Text filter
		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		// Artist filter
		if (this.filterArtist) {
			result = result.filter(c => c.chartArtist === this.filterArtist)
		}

		// Sort
		result.sort((a, b) => {
			const aVal = this.sortField === 'artist' ? a.chartArtist : a.chartName
			const bVal = this.sortField === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return this.sortDirection === 'asc' ? cmp : -cmp
		})

		this.filteredCharts = result
		this.ref.detectChanges()
	}

	toggleSortDirection(): void {
		this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
		this.applyFilter()
	}

	clearFilters(): void {
		this.filterQuery = ''
		this.filterArtist = ''
		this.applyFilter()
	}

	selectChart(chart: ChartVideoMatch): void {
		this.selectedChart = chart
		this.searchQuery = chart.suggestedQuery
		this.searchResults = []
		this.selectedVideo = null
		this.searchError = null
		this.searchSource = 'youtube'
		this.pasteUrl = ''
		this.selectedLocalFile = null
		this.viewMode = 'search'
		this.ref.detectChanges()
	}

	getSourceName(source: string): string {
		const names: Record<string, string> = {
			'youtube': 'YouTube',
			'vimeo': 'Vimeo',
			'dailymotion': 'Dailymotion',
			'archive': 'Archive.org',
		}
		return names[source] || source
	}

	async search(): Promise<void> {
		if (!this.searchQuery.trim()) return

		this.isSearching = true
		this.searchError = null
		this.searchResults = []
		this.ref.detectChanges()

		try {
			this.searchResults = await this.videoSyncService.searchVideos(this.searchQuery, 'youtube')
		} catch (err) {
			this.searchError = `Search failed: ${err}`
		} finally {
			this.isSearching = false
			this.ref.detectChanges()
		}
	}

	async downloadFromUrl(): Promise<void> {
		if (!this.selectedChart || !this.pasteUrl.trim()) return

		this.downloadError = null
		this.ref.detectChanges()

		try {
			await this.videoSyncService.downloadFromUrl({
				chartId: this.selectedChart.chartId,
				url: this.pasteUrl.trim(),
				outputPath: this.selectedChart.chartPath,
			})
			this.goBackToList()
		} catch (err) {
			console.error('Download failed:', err)
		}
	}

	async selectLocalFile(): Promise<void> {
		try {
			const filePath = await this.videoSyncService.selectVideoFile()
			if (filePath) {
				this.selectedLocalFile = filePath
				this.ref.detectChanges()
			}
		} catch (err) {
			this.searchError = `Failed to select file: ${err}`
			this.ref.detectChanges()
		}
	}

	async importLocalFile(): Promise<void> {
		if (!this.selectedChart || !this.selectedLocalFile) return

		this.downloadError = null
		this.ref.detectChanges()

		try {
			await this.videoSyncService.importLocalVideo({
				chartId: this.selectedChart.chartId,
				sourcePath: this.selectedLocalFile,
				outputPath: this.selectedChart.chartPath,
			})
			this.goBackToList()
		} catch (err) {
			console.error('Import failed:', err)
			this.downloadError = `Import failed: ${err}`
			this.ref.detectChanges()
		}
	}

	selectVideo(video: YouTubeSearchResult): void {
		this.selectedVideo = video
		this.ref.detectChanges()
	}

	async downloadVideo(): Promise<void> {
		if (!this.selectedChart || !this.selectedVideo) return

		// Clear any previous error
		this.downloadError = null
		this.ref.detectChanges()

		try {
			await this.videoSyncService.downloadVideo({
				chartId: this.selectedChart.chartId,
				videoId: this.selectedVideo.videoId,
				outputPath: this.selectedChart.chartPath,
			})

			// Go back to list after successful download
			this.goBackToList()
		} catch (err) {
			console.error('Download failed:', err)
			// Error is already handled via downloadProgress subscription
		}
	}

	cancelDownload(): void {
		if (this.selectedVideo) {
			this.videoSyncService.cancelDownload(this.selectedVideo.videoId)
		}
	}

	goBackToList(): void {
		this.viewMode = 'list'
		this.selectedChart = null
		this.selectedVideo = null
		this.searchResults = []
		this.searchQuery = ''
		this.searchError = null
		this.downloadError = null
		this.pasteUrl = ''
		this.selectedLocalFile = null
		this.searchSource = 'youtube'
		this.ref.detectChanges()
	}

	formatDuration(seconds: number | null): string {
		if (!seconds) return '--:--'
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	openYtDlpInstall(): void {
		window.electron.emit.openUrl('https://github.com/yt-dlp/yt-dlp#installation')
	}

	openFfmpegInstall(): void {
		window.electron.emit.openUrl('https://ffmpeg.org/download.html')
	}

	previewVideo(video: YouTubeSearchResult): void {
		window.electron.emit.openUrl(`https://www.youtube.com/watch?v=${video.videoId}`)
	}

	refreshTools(): void {
		this.checkingTools = true
		this.ref.detectChanges()
		this.videoSyncService.checkTools()
	}
}
