/**
 * Bridge Art Studio Module - Component
 */

import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ArtStudioService } from '../../core/services/art-studio.service'
import { CatalogService } from '../../core/services/catalog.service'
import {
	AlbumArtResult,
	ArtDownloadProgress,
	ChartArtMatch,
} from '../../../../src-shared/interfaces/art-studio.interface.js'

type ViewMode = 'overview' | 'albumArt' | 'backgrounds' | 'browseAll' | 'browseBackgrounds'

@Component({
	selector: 'app-art-studio',
	templateUrl: './art-studio.component.html',
	standalone: false,
})
export class ArtStudioComponent implements OnInit {
	// View state
	viewMode: ViewMode = 'overview'

	// Charts lists
	chartsMissingAlbumArt: ChartArtMatch[] = []
	chartsMissingBackground: ChartArtMatch[] = []
	filteredAlbumArtCharts: ChartArtMatch[] = []
	filteredBackgroundCharts: ChartArtMatch[] = []
	allChartsForBrowse: ChartArtMatch[] = []
	filteredBrowseCharts: ChartArtMatch[] = []
	allChartsForBrowseBackgrounds: ChartArtMatch[] = []
	filteredBrowseBackgroundCharts: ChartArtMatch[] = []
	loadingCharts = false
	browseShowMissingOnly = false
	browseBackgroundsShowMissingOnly = false

	// Album art cache for browse view (chartPath -> dataUrl)
	albumArtCache: Map<string, string | null> = new Map()
	loadingArtPaths: Set<string> = new Set()

	// Background cache for browse backgrounds view (chartPath -> dataUrl)
	backgroundCache: Map<string, string | null> = new Map()
	loadingBackgroundPaths: Set<string> = new Set()

	// Filter/sort state
	filterQuery = ''
	filterArtist = ''
	sortField: 'artist' | 'name' = 'artist'
	sortDirection: 'asc' | 'desc' = 'asc'
	albumArtArtistOptions: string[] = []
	backgroundArtistOptions: string[] = []
	browseArtistOptions: string[] = []
	browseBackgroundArtistOptions: string[] = []

	// Selected chart for single operations
	selectedChart: ChartArtMatch | null = null

	// Multi-select for browse backgrounds
	selectedBrowseBackgroundIds = new Set<number>()

	// Album art search
	albumArtResults: AlbumArtResult[] = []
	isSearchingArt = false
	searchError: string | null = null

	// Progress
	downloadProgress: ArtDownloadProgress | null = null
	isProcessing = false

	// Batch operations
	batchMode = false
	selectedChartIds = new Set<number>()
	batchResults: { success: number; failed: number; skipped: number } | null = null

	// Blur setting for background generation
	blurAmount = 20  // Default blur sigma (0-50, 0 = no blur, 50 = heavy blur)

	constructor(
		private artStudioService: ArtStudioService,
		public catalogService: CatalogService,
		private ref: ChangeDetectorRef,
	) { }

	ngOnInit(): void {
		this.artStudioService.downloadProgress$.subscribe(progress => {
			this.downloadProgress = progress
			this.ref.detectChanges()

			if (progress?.phase === 'complete') {
				this.loadCharts()
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()
			}
		})

		this.artStudioService.isProcessing$.subscribe(processing => {
			this.isProcessing = processing
			this.ref.detectChanges()
		})

		this.loadCharts().then(() => {
			// Check if we were navigated here with a pre-selected chart
			this.checkForPreselectedChart()
		})
	}

	private checkForPreselectedChart(): void {
		const stored = sessionStorage.getItem('selectedChartForArt')
		if (stored) {
			sessionStorage.removeItem('selectedChartForArt')
			try {
				const chartData = JSON.parse(stored)
				// Go to the appropriate view mode based on type
				if (chartData.type === 'album') {
					this.setViewMode('albumArt')
					// Create a ChartArtMatch and select it
					const chart: ChartArtMatch = {
						chartId: chartData.id,
						chartName: chartData.name,
						chartArtist: chartData.artist,
						chartAlbum: chartData.album || '',
						chartPath: chartData.path,
						hasBackground: false,
						hasAlbumArt: false,
						suggestedQuery: `${chartData.artist} ${chartData.album || chartData.name}`,
					}
					this.selectChart(chart)
				} else if (chartData.type === 'background') {
					this.setViewMode('backgrounds')
					// For backgrounds, just navigate to the view - can't pre-select single chart there
				}
			} catch (err) {
				console.error('Failed to parse pre-selected chart:', err)
			}
		}
	}

	async loadCharts(): Promise<void> {
		this.loadingCharts = true
		this.ref.detectChanges()

		try {
			// Always refresh the catalog first
			await this.catalogService.refreshCharts()

			const [albumArt, backgrounds] = await Promise.all([
				this.artStudioService.getChartsMissingAlbumArt(10000),
				this.artStudioService.getChartsMissingBackground(10000),
			])
			this.chartsMissingAlbumArt = albumArt
			this.chartsMissingBackground = backgrounds
			this.buildArtistOptions()
			this.applyAlbumArtFilter()
			this.applyBackgroundFilter()

			// If in browse mode, also refresh that data and clear cache
			if (this.viewMode === 'browseAll') {
				this.albumArtCache.clear()
				await this.loadAllChartsForBrowse()
			}
		} catch (err) {
			console.error('Failed to load charts:', err)
		} finally {
			this.loadingCharts = false
			this.ref.detectChanges()
		}
	}

	async loadAllChartsForBrowse(): Promise<void> {
		// Only set loading if not already loading (could be called from loadCharts)
		const wasLoading = this.loadingCharts
		if (!wasLoading) {
			this.loadingCharts = true
			this.ref.detectChanges()
		}

		try {
			// Get all charts from the catalog service
			const allCharts = this.catalogService.charts

			// Convert ChartRecord to ChartArtMatch format
			this.allChartsForBrowse = allCharts.map(chart => ({
				chartId: chart.id,
				chartName: chart.name,
				chartArtist: chart.artist,
				chartAlbum: chart.album || '',
				chartPath: chart.path,
				hasAlbumArt: chart.hasAlbumArt,
				hasBackground: chart.hasBackground,
				suggestedQuery: `${chart.artist} ${chart.album || chart.name}`,
			}))

			// Build artist options for browse
			const artists = new Set<string>()
			this.allChartsForBrowse.forEach(c => {
				if (c.chartArtist) artists.add(c.chartArtist)
			})
			this.browseArtistOptions = Array.from(artists).sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase())
			)

			this.applyBrowseFilter()
		} catch (err) {
			console.error('Failed to load charts for browse:', err)
		} finally {
			// Only clear loading if we set it
			if (!wasLoading) {
				this.loadingCharts = false
				this.ref.detectChanges()
			}
		}
	}

	applyBrowseFilter(): void {
		let result = [...this.allChartsForBrowse]

		// Filter by missing art only
		if (this.browseShowMissingOnly) {
			result = result.filter(c => !c.hasAlbumArt)
		}

		// Filter by search query
		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		// Filter by artist
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

		this.filteredBrowseCharts = result
		this.ref.detectChanges()

		// Pre-load visible album art (first 50)
		this.preloadAlbumArt(result.slice(0, 50))
	}

	/**
	 * Get album art URL for a chart - returns cached data URL or triggers load
	 */
	getAlbumArtUrl(chart: ChartArtMatch): string | null {
		if (!chart.hasAlbumArt) return null

		// Return cached if available
		if (this.albumArtCache.has(chart.chartPath)) {
			return this.albumArtCache.get(chart.chartPath) || null
		}

		// Trigger async load if not already loading
		if (!this.loadingArtPaths.has(chart.chartPath)) {
			this.loadAlbumArt(chart.chartPath)
		}

		return null // Will show placeholder until loaded
	}

	/**
	 * Load album art asynchronously and cache it
	 */
	private async loadAlbumArt(chartPath: string): Promise<void> {
		if (this.loadingArtPaths.has(chartPath)) return
		this.loadingArtPaths.add(chartPath)

		try {
			const dataUrl = await this.artStudioService.getAlbumArtDataUrl(chartPath)
			this.albumArtCache.set(chartPath, dataUrl)
			this.ref.detectChanges()
		} catch (err) {
			console.error('Failed to load album art:', err)
			this.albumArtCache.set(chartPath, null)
		} finally {
			this.loadingArtPaths.delete(chartPath)
		}
	}

	/**
	 * Pre-load album art for a batch of charts
	 */
	private async preloadAlbumArt(charts: ChartArtMatch[]): Promise<void> {
		const toLoad = charts.filter(c =>
			c.hasAlbumArt &&
			!this.albumArtCache.has(c.chartPath) &&
			!this.loadingArtPaths.has(c.chartPath)
		)

		// Load in batches of 10 to avoid overwhelming
		for (let i = 0; i < toLoad.length; i += 10) {
			const batch = toLoad.slice(i, i + 10)
			await Promise.all(batch.map(c => this.loadAlbumArt(c.chartPath)))
		}
	}

	// ==================== Browse Backgrounds Methods ====================

	async loadAllChartsForBrowseBackgrounds(): Promise<void> {
		this.loadingCharts = true
		this.ref.detectChanges()

		try {
			const allCharts = this.catalogService.charts

			// Convert ChartRecord to ChartArtMatch format
			this.allChartsForBrowseBackgrounds = allCharts.map(chart => ({
				chartId: chart.id,
				chartName: chart.name,
				chartArtist: chart.artist,
				chartAlbum: chart.album || '',
				chartPath: chart.path,
				hasAlbumArt: chart.hasAlbumArt,
				hasBackground: chart.hasBackground,
				suggestedQuery: `${chart.artist} ${chart.album || chart.name}`,
			}))

			// Build artist options
			const artists = new Set<string>()
			this.allChartsForBrowseBackgrounds.forEach(c => {
				if (c.chartArtist) artists.add(c.chartArtist)
			})
			this.browseBackgroundArtistOptions = Array.from(artists).sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase())
			)

			this.applyBrowseBackgroundsFilter()
		} catch (err) {
			console.error('Failed to load charts for browse backgrounds:', err)
		} finally {
			this.loadingCharts = false
			this.ref.detectChanges()
		}
	}

	applyBrowseBackgroundsFilter(): void {
		let result = [...this.allChartsForBrowseBackgrounds]

		// Filter by missing only
		if (this.browseBackgroundsShowMissingOnly) {
			result = result.filter(c => !c.hasBackground)
		}

		// Filter by search query
		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		// Filter by artist
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

		this.filteredBrowseBackgroundCharts = result
		this.ref.detectChanges()

		// Pre-load visible backgrounds (first 50)
		this.preloadBackgrounds(result.slice(0, 50))
	}

	/**
	 * Get background URL for a chart - returns cached data URL or triggers load
	 */
	getBackgroundUrl(chart: ChartArtMatch): string | null {
		if (!chart.hasBackground) return null

		// Return cached if available
		if (this.backgroundCache.has(chart.chartPath)) {
			return this.backgroundCache.get(chart.chartPath) || null
		}

		// Trigger async load if not already loading
		if (!this.loadingBackgroundPaths.has(chart.chartPath)) {
			this.loadBackground(chart.chartPath)
		}

		return null
	}

	/**
	 * Load background asynchronously and cache it
	 */
	private async loadBackground(chartPath: string): Promise<void> {
		if (this.loadingBackgroundPaths.has(chartPath)) return
		this.loadingBackgroundPaths.add(chartPath)

		try {
			const dataUrl = await this.artStudioService.getBackgroundDataUrl(chartPath)
			this.backgroundCache.set(chartPath, dataUrl)
			this.ref.detectChanges()
		} catch (err) {
			console.error('Failed to load background:', err)
			this.backgroundCache.set(chartPath, null)
		} finally {
			this.loadingBackgroundPaths.delete(chartPath)
		}
	}

	/**
	 * Pre-load backgrounds for a batch of charts
	 */
	private async preloadBackgrounds(charts: ChartArtMatch[]): Promise<void> {
		const toLoad = charts.filter(c =>
			c.hasBackground &&
			!this.backgroundCache.has(c.chartPath) &&
			!this.loadingBackgroundPaths.has(c.chartPath)
		)

		// Load in batches of 10
		for (let i = 0; i < toLoad.length; i += 10) {
			const batch = toLoad.slice(i, i + 10)
			await Promise.all(batch.map(c => this.loadBackground(c.chartPath)))
		}
	}

	/**
	 * Toggle selection for browse backgrounds multi-select
	 */
	toggleBrowseBackgroundSelection(chartId: number): void {
		if (this.selectedBrowseBackgroundIds.has(chartId)) {
			this.selectedBrowseBackgroundIds.delete(chartId)
		} else {
			this.selectedBrowseBackgroundIds.add(chartId)
		}
		this.ref.detectChanges()
	}

	/**
	 * Select all visible charts in browse backgrounds
	 */
	selectAllBrowseBackgrounds(): void {
		if (this.selectedBrowseBackgroundIds.size === this.filteredBrowseBackgroundCharts.length) {
			this.selectedBrowseBackgroundIds.clear()
		} else {
			this.filteredBrowseBackgroundCharts.forEach(c => this.selectedBrowseBackgroundIds.add(c.chartId))
		}
		this.ref.detectChanges()
	}

	/**
	 * Regenerate backgrounds for selected charts in browse mode
	 */
	async regenerateSelectedBackgrounds(): Promise<void> {
		if (this.selectedBrowseBackgroundIds.size === 0) return

		const confirmed = confirm(
			`Regenerate backgrounds for ${this.selectedBrowseBackgroundIds.size} charts with blur amount ${this.blurAmount}?\n\n` +
			`This will delete and recreate the backgrounds.`
		)
		if (!confirmed) return

		this.isProcessing = true
		this.batchResults = null
		this.ref.detectChanges()

		try {
			const result = await window.electron.invoke.artBatchRegenerateBackgrounds({
				chartIds: Array.from(this.selectedBrowseBackgroundIds),
				blurAmount: this.blurAmount,
			})
			this.batchResults = result

			// Clear cache for regenerated backgrounds
			this.selectedBrowseBackgroundIds.forEach(id => {
				const chart = this.allChartsForBrowseBackgrounds.find(c => c.chartId === id)
				if (chart) {
					this.backgroundCache.delete(chart.chartPath)
					chart.hasBackground = true
				}
			})

			// Reload backgrounds
			const chartsToReload = this.filteredBrowseBackgroundCharts.filter(
				c => this.selectedBrowseBackgroundIds.has(c.chartId)
			)
			this.preloadBackgrounds(chartsToReload)

			this.selectedBrowseBackgroundIds.clear()
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()
		} catch (err) {
			console.error('Batch regenerate failed:', err)
		} finally {
			this.isProcessing = false
			this.ref.detectChanges()
		}
	}

	/**
	 * Regenerate background for single selected chart
	 */
	async regenerateSingleBackground(): Promise<void> {
		if (!this.selectedChart) return

		const chartPath = this.selectedChart.chartPath

		try {
			this.isProcessing = true
			this.ref.detectChanges()

			await this.artStudioService.generateBackground({
				chartId: this.selectedChart.chartId,
				outputPath: chartPath,
				style: this.selectedChart.hasAlbumArt ? 'blur' : 'gradient',
				blurAmount: this.blurAmount,
			})

			// Clear cache and reload
			this.backgroundCache.delete(chartPath)
			this.selectedChart.hasBackground = true

			const chartInList = this.allChartsForBrowseBackgrounds.find(c => c.chartId === this.selectedChart?.chartId)
			if (chartInList) {
				chartInList.hasBackground = true
			}

			// Reload the background
			this.loadBackground(chartPath)

			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()
		} catch (err) {
			console.error('Failed to regenerate background:', err)
		} finally {
			this.isProcessing = false
			this.ref.detectChanges()
		}
	}

	buildArtistOptions(): void {
		const albumArtArtists = new Set<string>()
		this.chartsMissingAlbumArt.forEach(c => {
			if (c.chartArtist) albumArtArtists.add(c.chartArtist)
		})
		this.albumArtArtistOptions = Array.from(albumArtArtists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		)

		const bgArtists = new Set<string>()
		this.chartsMissingBackground.forEach(c => {
			if (c.chartArtist) bgArtists.add(c.chartArtist)
		})
		this.backgroundArtistOptions = Array.from(bgArtists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		)
	}

	applyAlbumArtFilter(): void {
		let result = [...this.chartsMissingAlbumArt]

		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		if (this.filterArtist) {
			result = result.filter(c => c.chartArtist === this.filterArtist)
		}

		result.sort((a, b) => {
			const aVal = this.sortField === 'artist' ? a.chartArtist : a.chartName
			const bVal = this.sortField === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return this.sortDirection === 'asc' ? cmp : -cmp
		})

		this.filteredAlbumArtCharts = result
		this.ref.detectChanges()
	}

	applyBackgroundFilter(): void {
		let result = [...this.chartsMissingBackground]

		if (this.filterQuery) {
			const query = this.filterQuery.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(query) ||
				c.chartArtist.toLowerCase().includes(query)
			)
		}

		if (this.filterArtist) {
			result = result.filter(c => c.chartArtist === this.filterArtist)
		}

		result.sort((a, b) => {
			const aVal = this.sortField === 'artist' ? a.chartArtist : a.chartName
			const bVal = this.sortField === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return this.sortDirection === 'asc' ? cmp : -cmp
		})

		this.filteredBackgroundCharts = result
		this.ref.detectChanges()
	}

	toggleSortDirection(): void {
		this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()
	}

	clearFilters(): void {
		this.filterQuery = ''
		this.filterArtist = ''
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode = mode
		this.selectedChart = null
		this.albumArtResults = []
		this.searchError = null
		this.batchMode = false
		this.selectedChartIds.clear()
		this.selectedBrowseBackgroundIds.clear()
		this.batchResults = null
		this.filterQuery = ''
		this.filterArtist = ''
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()

		// Load all charts when entering browse modes
		if (mode === 'browseAll') {
			this.loadAllChartsForBrowse()
		} else if (mode === 'browseBackgrounds') {
			this.loadAllChartsForBrowseBackgrounds()
		}

		this.ref.detectChanges()
	}

	selectChart(chart: ChartArtMatch): void {
		this.selectedChart = chart
		this.albumArtResults = []
		this.searchError = null
		this.ref.detectChanges()

		// Auto-search for album art
		if (this.viewMode === 'albumArt') {
			this.searchAlbumArt()
		}
	}

	async searchAlbumArt(): Promise<void> {
		if (!this.selectedChart) return

		this.isSearchingArt = true
		this.searchError = null
		this.albumArtResults = []
		this.ref.detectChanges()

		try {
			this.albumArtResults = await this.artStudioService.searchAlbumArt(
				this.selectedChart.chartArtist,
				this.selectedChart.chartAlbum || this.selectedChart.chartName
			)

			if (this.albumArtResults.length === 0) {
				this.searchError = 'No album art found. Try searching manually.'
			}
		} catch (err) {
			this.searchError = `Search failed: ${err}`
		} finally {
			this.isSearchingArt = false
			this.ref.detectChanges()
		}
	}

	async downloadAlbumArt(result: AlbumArtResult): Promise<void> {
		if (!this.selectedChart) return

		const chartPath = this.selectedChart.chartPath
		const chartId = this.selectedChart.chartId

		try {
			await this.artStudioService.downloadImage({
				chartId: this.selectedChart.chartId,
				imageUrl: result.url,
				outputPath: this.selectedChart.chartPath,
				type: 'album',
			})

			// Invalidate the cache for this chart so it reloads
			this.albumArtCache.delete(chartPath)

			// Update the chart's hasAlbumArt flag in browse list
			const chartInBrowse = this.allChartsForBrowse.find(c => c.chartId === chartId)
			if (chartInBrowse) {
				chartInBrowse.hasAlbumArt = true
			}

			// Update selected chart
			if (this.selectedChart) {
				this.selectedChart.hasAlbumArt = true
			}

			// Remove from missing list
			this.chartsMissingAlbumArt = this.chartsMissingAlbumArt.filter(
				c => c.chartId !== chartId
			)
			this.applyAlbumArtFilter()

			// Clear search results but keep chart selected to show updated art
			this.albumArtResults = []

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()

			// Force reload of this chart's album art
			this.loadAlbumArt(chartPath)

			this.ref.detectChanges()
		} catch (err) {
			console.error('Download failed:', err)
		}
	}

	async generateBackground(): Promise<void> {
		if (!this.selectedChart) return

		try {
			await this.artStudioService.generateBackground({
				chartId: this.selectedChart.chartId,
				outputPath: this.selectedChart.chartPath,
				style: this.selectedChart.hasAlbumArt ? 'blur' : 'gradient',
				blurAmount: this.blurAmount,
			})

			// Remove from list and clear selection
			this.chartsMissingBackground = this.chartsMissingBackground.filter(
				c => c.chartId !== this.selectedChart?.chartId
			)
			this.applyBackgroundFilter()
			this.selectedChart = null
		} catch (err) {
			console.error('Generate failed:', err)
		}
	}

	// Batch operations
	toggleBatchMode(): void {
		this.batchMode = !this.batchMode
		this.selectedChartIds.clear()
		this.batchResults = null
		this.ref.detectChanges()
	}

	toggleChartSelection(chartId: number): void {
		if (this.selectedChartIds.has(chartId)) {
			this.selectedChartIds.delete(chartId)
		} else {
			this.selectedChartIds.add(chartId)
		}
		this.ref.detectChanges()
	}

	selectAll(charts: ChartArtMatch[]): void {
		if (this.selectedChartIds.size === charts.length) {
			this.selectedChartIds.clear()
		} else {
			charts.forEach(c => this.selectedChartIds.add(c.chartId))
		}
		this.ref.detectChanges()
	}

	async batchFetchAlbumArt(): Promise<void> {
		if (this.selectedChartIds.size === 0) return

		this.batchResults = null
		this.ref.detectChanges()

		try {
			this.batchResults = await this.artStudioService.batchFetchAlbumArt(
				Array.from(this.selectedChartIds)
			)
			await this.loadCharts()
			this.selectedChartIds.clear()
		} catch (err) {
			console.error('Batch fetch failed:', err)
		}
	}

	async batchGenerateBackgrounds(): Promise<void> {
		if (this.selectedChartIds.size === 0) return

		this.batchResults = null
		this.ref.detectChanges()

		try {
			this.batchResults = await this.artStudioService.batchGenerateBackgrounds(
				Array.from(this.selectedChartIds)
			)
			await this.loadCharts()
			this.selectedChartIds.clear()
		} catch (err) {
			console.error('Batch generate failed:', err)
		}
	}

	async batchDeleteBackgrounds(): Promise<void> {
		if (this.selectedChartIds.size === 0) return

		const confirmed = confirm(`Delete backgrounds from ${this.selectedChartIds.size} charts?`)
		if (!confirmed) return

		this.batchResults = null
		this.isProcessing = true
		this.ref.detectChanges()

		try {
			const result = await window.electron.invoke.artBatchDeleteBackgrounds(
				Array.from(this.selectedChartIds)
			)
			this.batchResults = { success: result.success, failed: result.failed, skipped: 0 }
			await this.loadCharts()
			this.selectedChartIds.clear()
		} catch (err) {
			console.error('Batch delete failed:', err)
		} finally {
			this.isProcessing = false
			this.ref.detectChanges()
		}
	}

	async batchRegenerateBackgrounds(): Promise<void> {
		if (this.selectedChartIds.size === 0) return

		const confirmed = confirm(
			`Regenerate backgrounds for ${this.selectedChartIds.size} charts with blur amount ${this.blurAmount}?\n\n` +
			`This will delete existing backgrounds and create new ones.`
		)
		if (!confirmed) return

		this.batchResults = null
		this.isProcessing = true
		this.ref.detectChanges()

		try {
			const result = await window.electron.invoke.artBatchRegenerateBackgrounds({
				chartIds: Array.from(this.selectedChartIds),
				blurAmount: this.blurAmount,
			})
			this.batchResults = result
			await this.loadCharts()
			this.selectedChartIds.clear()
		} catch (err) {
			console.error('Batch regenerate failed:', err)
		} finally {
			this.isProcessing = false
			this.ref.detectChanges()
		}
	}

	goBack(): void {
		this.selectedChart = null
		this.albumArtResults = []
		this.searchError = null
		this.ref.detectChanges()
	}

	async deleteSelectedAlbumArt(): Promise<void> {
		if (!this.selectedChart) return

		const confirmed = confirm(`Delete album art for "${this.selectedChart.chartName}"?`)
		if (!confirmed) return

		const chartPath = this.selectedChart.chartPath

		try {
			await this.artStudioService.deleteAlbumArt(this.selectedChart.chartId)

			// Clear the cache for this chart
			this.albumArtCache.delete(chartPath)

			// Update the local data
			this.selectedChart.hasAlbumArt = false
			const chartInList = this.allChartsForBrowse.find(c => c.chartId === this.selectedChart?.chartId)
			if (chartInList) {
				chartInList.hasAlbumArt = false
			}

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()

			this.ref.detectChanges()
		} catch (err) {
			console.error('Failed to delete album art:', err)
		}
	}

	async regenerateSelectedBackground(): Promise<void> {
		if (!this.selectedChart || !this.selectedChart.hasAlbumArt) return

		try {
			this.isProcessing = true
			this.ref.detectChanges()

			await this.artStudioService.generateBackground({
				chartId: this.selectedChart.chartId,
				outputPath: this.selectedChart.chartPath,
				style: 'blur',
				blurAmount: this.blurAmount,
			})

			// Update the local data
			this.selectedChart.hasBackground = true
			const chartInList = this.allChartsForBrowse.find(c => c.chartId === this.selectedChart?.chartId)
			if (chartInList) {
				chartInList.hasBackground = true
			}

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()

		} catch (err) {
			console.error('Failed to regenerate background:', err)
		} finally {
			this.isProcessing = false
			this.ref.detectChanges()
		}
	}
}
