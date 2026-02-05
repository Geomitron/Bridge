/**
 * Bridge Video Sync Module - Component
 */

import { Component, OnInit, OnDestroy, inject, signal, effect, DestroyRef } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DecimalPipe, SlicePipe } from '@angular/common'
import { VideoSyncService } from '../../core/services/video-sync.service'
import { CatalogService } from '../../core/services/catalog.service'
import { NavigationEnd, Router } from '@angular/router'
import { filter } from 'rxjs'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import {
	YouTubeSearchResult,
	VideoDownloadProgress,
	ChartVideoMatch,
} from '../../../../src-shared/interfaces/video-sync.interface.js'

@Component({
	selector: 'app-video-sync',
	standalone: true,
	imports: [FormsModule, DecimalPipe, SlicePipe],
	templateUrl: './video-sync.component.html',
})
export class VideoSyncComponent implements OnInit, OnDestroy {
	private videoSyncService = inject(VideoSyncService)
	private catalogService = inject(CatalogService)
	private router = inject(Router)
	private destroyRef = inject(DestroyRef)

	// Tool status
	toolsAvailable = signal<{ ytDlp: boolean; ffmpeg: boolean } | null>(null)
	checkingTools = signal(true)

	// Charts without videos
	chartsMissingVideo = signal<ChartVideoMatch[]>([])
	filteredCharts = signal<ChartVideoMatch[]>([])
	loadingCharts = signal(false)

	// Filter/sort state
	filterQuery = signal('')
	filterArtist = signal('')
	sortField = signal<'artist' | 'name'>('artist')
	sortDirection = signal<'asc' | 'desc'>('asc')
	artistOptions = signal<string[]>([])

	// Currently selected chart
	selectedChart = signal<ChartVideoMatch | null>(null)

	// Search
	searchQuery = signal('')
	searchResults = signal<YouTubeSearchResult[]>([])
	isSearching = signal(false)
	searchError = signal<string | null>(null)
	searchSource = signal<'youtube' | 'url' | 'local'>('youtube')

	// URL paste
	pasteUrl = signal('')

	// Local file import
	selectedLocalFile = signal<string | null>(null)

	// Download
	selectedVideo = signal<YouTubeSearchResult | null>(null)
	downloadProgress = signal<VideoDownloadProgress | null>(null)
	isDownloading = signal(false)
	downloadError = signal<string | null>(null)

	// View mode
	viewMode = signal<'list' | 'search'>('list')

	constructor() {
		// Subscribe to toolsAvailable
		effect(() => {
			const tools = this.videoSyncService.toolsAvailable()
			if (tools !== null) {
				this.toolsAvailable.set(tools)
				this.checkingTools.set(false)
			}
		})

		// Subscribe to downloadProgress
		effect(() => {
			const progress = this.videoSyncService.downloadProgress()
			this.downloadProgress.set(progress)

			// Refresh chart list when download completes
			if (progress?.phase === 'complete') {
				this.loadChartsMissingVideo()
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()
			}

			// Handle download errors
			if (progress?.phase === 'error') {
				this.downloadError.set(progress.message)
			}
		})

		// Subscribe to isDownloading
		effect(() => {
			this.isDownloading.set(this.videoSyncService.isDownloading())
		})
	}

	ngOnInit(): void {
		// Listen for navigation to this route (handles route reuse)
		this.router.events.pipe(
			filter(event => event instanceof NavigationEnd),
			takeUntilDestroyed(this.destroyRef)
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
		// DestroyRef handles cleanup
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
		this.loadingCharts.set(true)

		try {
			const charts = await this.videoSyncService.getChartsMissingVideo(10000)
			this.chartsMissingVideo.set(charts)
			this.buildArtistOptions()
			this.applyFilter()
		} catch (err) {
			console.error('Failed to load charts:', err)
		} finally {
			this.loadingCharts.set(false)
		}
	}

	buildArtistOptions(): void {
		const artists = new Set<string>()
		this.chartsMissingVideo().forEach(c => {
			if (c.chartArtist) artists.add(c.chartArtist)
		})
		this.artistOptions.set(Array.from(artists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		))
	}

	applyFilter(): void {
		let result = [...this.chartsMissingVideo()]

		// Text filter
		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		// Artist filter
		const artistFilter = this.filterArtist()
		if (artistFilter) {
			result = result.filter(c => c.chartArtist === artistFilter)
		}

		// Sort
		const field = this.sortField()
		const direction = this.sortDirection()
		result.sort((a, b) => {
			const aVal = field === 'artist' ? a.chartArtist : a.chartName
			const bVal = field === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return direction === 'asc' ? cmp : -cmp
		})

		this.filteredCharts.set(result)
	}

	toggleSortDirection(): void {
		this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc')
		this.applyFilter()
	}

	clearFilters(): void {
		this.filterQuery.set('')
		this.filterArtist.set('')
		this.applyFilter()
	}

	selectChart(chart: ChartVideoMatch): void {
		this.selectedChart.set(chart)
		this.searchQuery.set(chart.suggestedQuery)
		this.searchResults.set([])
		this.selectedVideo.set(null)
		this.searchError.set(null)
		this.searchSource.set('youtube')
		this.pasteUrl.set('')
		this.selectedLocalFile.set(null)
		this.viewMode.set('search')
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
		const query = this.searchQuery()
		if (!query.trim()) return

		this.isSearching.set(true)
		this.searchError.set(null)
		this.searchResults.set([])

		try {
			const results = await this.videoSyncService.searchVideos(query, 'youtube')
			this.searchResults.set(results)
		} catch (err) {
			this.searchError.set(`Search failed: ${err}`)
		} finally {
			this.isSearching.set(false)
		}
	}

	async downloadFromUrl(): Promise<void> {
		const chart = this.selectedChart()
		const url = this.pasteUrl()
		if (!chart || !url.trim()) return

		this.downloadError.set(null)

		try {
			await this.videoSyncService.downloadFromUrl({
				chartId: chart.chartId,
				url: url.trim(),
				outputPath: chart.chartPath,
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
				this.selectedLocalFile.set(filePath)
			}
		} catch (err) {
			this.searchError.set(`Failed to select file: ${err}`)
		}
	}

	async importLocalFile(): Promise<void> {
		const chart = this.selectedChart()
		const localFile = this.selectedLocalFile()
		if (!chart || !localFile) return

		this.downloadError.set(null)

		try {
			await this.videoSyncService.importLocalVideo({
				chartId: chart.chartId,
				sourcePath: localFile,
				outputPath: chart.chartPath,
			})
			this.goBackToList()
		} catch (err) {
			console.error('Import failed:', err)
			this.downloadError.set(`Import failed: ${err}`)
		}
	}

	selectVideo(video: YouTubeSearchResult): void {
		this.selectedVideo.set(video)
	}

	async downloadVideo(): Promise<void> {
		const chart = this.selectedChart()
		const video = this.selectedVideo()
		if (!chart || !video) return

		// Clear any previous error
		this.downloadError.set(null)

		try {
			await this.videoSyncService.downloadVideo({
				chartId: chart.chartId,
				videoId: video.videoId,
				outputPath: chart.chartPath,
			})

			// Go back to list after successful download
			this.goBackToList()
		} catch (err) {
			console.error('Download failed:', err)
			// Error is already handled via downloadProgress subscription
		}
	}

	cancelDownload(): void {
		const video = this.selectedVideo()
		if (video) {
			this.videoSyncService.cancelDownload(video.videoId)
		}
	}

	goBackToList(): void {
		this.viewMode.set('list')
		this.selectedChart.set(null)
		this.selectedVideo.set(null)
		this.searchResults.set([])
		this.searchQuery.set('')
		this.searchError.set(null)
		this.downloadError.set(null)
		this.pasteUrl.set('')
		this.selectedLocalFile.set(null)
		this.searchSource.set('youtube')
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
		this.checkingTools.set(true)
		this.videoSyncService.checkTools()
	}

	// Event handler methods for template two-way binding
	onFilterQueryChange(value: string): void {
		this.filterQuery.set(value)
		this.applyFilter()
	}

	onFilterArtistChange(value: string): void {
		this.filterArtist.set(value)
		this.applyFilter()
	}

	onSortFieldChange(value: 'artist' | 'name'): void {
		this.sortField.set(value)
		this.applyFilter()
	}

	onSearchQueryChange(value: string): void {
		this.searchQuery.set(value)
	}

	onPasteUrlChange(value: string): void {
		this.pasteUrl.set(value)
	}

	onSearchSourceChange(value: 'youtube' | 'url' | 'local'): void {
		this.searchSource.set(value)
	}
}
