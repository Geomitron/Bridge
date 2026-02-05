/**
 * Bridge Art Studio Module - Component
 */

import { Component, OnInit, inject, signal, computed, effect } from '@angular/core'
import { FormsModule } from '@angular/forms'
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
	standalone: true,
	imports: [FormsModule],
	templateUrl: './art-studio.component.html',
})
export class ArtStudioComponent implements OnInit {
	private artStudioService = inject(ArtStudioService)
	catalogService = inject(CatalogService)

	// View state
	viewMode = signal<ViewMode>('overview')

	// Charts lists
	chartsMissingAlbumArt = signal<ChartArtMatch[]>([])
	chartsMissingBackground = signal<ChartArtMatch[]>([])
	filteredAlbumArtCharts = signal<ChartArtMatch[]>([])
	filteredBackgroundCharts = signal<ChartArtMatch[]>([])
	allChartsForBrowse = signal<ChartArtMatch[]>([])
	filteredBrowseCharts = signal<ChartArtMatch[]>([])
	allChartsForBrowseBackgrounds = signal<ChartArtMatch[]>([])
	filteredBrowseBackgroundCharts = signal<ChartArtMatch[]>([])
	loadingCharts = signal(false)
	browseShowMissingOnly = signal(false)
	browseBackgroundsShowMissingOnly = signal(false)

	// Album art cache for browse view (chartPath -> dataUrl)
	albumArtCache = signal<Map<string, string | null>>(new Map())
	loadingArtPaths = signal<Set<string>>(new Set())

	// Background cache for browse backgrounds view (chartPath -> dataUrl)
	backgroundCache = signal<Map<string, string | null>>(new Map())
	loadingBackgroundPaths = signal<Set<string>>(new Set())

	// Filter/sort state
	filterQuery = signal('')
	filterArtist = signal('')
	sortField = signal<'artist' | 'name'>('artist')
	sortDirection = signal<'asc' | 'desc'>('asc')
	albumArtArtistOptions = signal<string[]>([])
	backgroundArtistOptions = signal<string[]>([])
	browseArtistOptions = signal<string[]>([])
	browseBackgroundArtistOptions = signal<string[]>([])

	// Selected chart for single operations
	selectedChart = signal<ChartArtMatch | null>(null)

	// Multi-select for browse backgrounds
	selectedBrowseBackgroundIds = signal<Set<number>>(new Set())

	// Album art search
	albumArtResults = signal<AlbumArtResult[]>([])
	isSearchingArt = signal(false)
	searchError = signal<string | null>(null)

	// Progress
	downloadProgress = signal<ArtDownloadProgress | null>(null)
	isProcessing = signal(false)

	// Batch operations
	batchMode = signal(false)
	selectedChartIds = signal<Set<number>>(new Set())
	batchResults = signal<{ success: number; failed: number; skipped: number } | null>(null)

	// Blur setting for background generation
	blurAmount = signal(20)  // Default blur sigma (0-50, 0 = no blur, 50 = heavy blur)

	constructor() {
		// Effect to react to downloadProgress from service
		effect(() => {
			const progress = this.artStudioService.downloadProgress()
			this.downloadProgress.set(progress)

			if (progress?.phase === 'complete') {
				this.loadCharts()
				this.catalogService.refreshCharts()
				this.catalogService.refreshStats()
			}
		})

		// Effect to react to isProcessing from service
		effect(() => {
			this.isProcessing.set(this.artStudioService.isProcessing())
		})
	}

	ngOnInit(): void {
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
		this.loadingCharts.set(true)

		try {
			// Always refresh the catalog first
			await this.catalogService.refreshCharts()

			const [albumArt, backgrounds] = await Promise.all([
				this.artStudioService.getChartsMissingAlbumArt(10000),
				this.artStudioService.getChartsMissingBackground(10000),
			])
			this.chartsMissingAlbumArt.set(albumArt)
			this.chartsMissingBackground.set(backgrounds)
			this.buildArtistOptions()
			this.applyAlbumArtFilter()
			this.applyBackgroundFilter()

			// If in browse mode, also refresh that data and clear cache
			if (this.viewMode() === 'browseAll') {
				this.albumArtCache.set(new Map())
				await this.loadAllChartsForBrowse()
			}
		} catch (err) {
			console.error('Failed to load charts:', err)
		} finally {
			this.loadingCharts.set(false)
		}
	}

	async loadAllChartsForBrowse(): Promise<void> {
		// Only set loading if not already loading (could be called from loadCharts)
		const wasLoading = this.loadingCharts()
		if (!wasLoading) {
			this.loadingCharts.set(true)
		}

		try {
			// Get all charts from the catalog service
			const allCharts = this.catalogService.charts()

			// Convert ChartRecord to ChartArtMatch format
			const chartsForBrowse = allCharts.map(chart => ({
				chartId: chart.id,
				chartName: chart.name,
				chartArtist: chart.artist,
				chartAlbum: chart.album || '',
				chartPath: chart.path,
				hasAlbumArt: chart.hasAlbumArt,
				hasBackground: chart.hasBackground,
				suggestedQuery: `${chart.artist} ${chart.album || chart.name}`,
			}))
			this.allChartsForBrowse.set(chartsForBrowse)

			// Build artist options for browse
			const artists = new Set<string>()
			chartsForBrowse.forEach(c => {
				if (c.chartArtist) artists.add(c.chartArtist)
			})
			this.browseArtistOptions.set(Array.from(artists).sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase())
			))

			this.applyBrowseFilter()
		} catch (err) {
			console.error('Failed to load charts for browse:', err)
		} finally {
			// Only clear loading if we set it
			if (!wasLoading) {
				this.loadingCharts.set(false)
			}
		}
	}

	applyBrowseFilter(): void {
		let result = [...this.allChartsForBrowse()]

		// Filter by missing art only
		if (this.browseShowMissingOnly()) {
			result = result.filter(c => !c.hasAlbumArt)
		}

		// Filter by search query
		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		// Filter by artist
		const artist = this.filterArtist()
		if (artist) {
			result = result.filter(c => c.chartArtist === artist)
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

		this.filteredBrowseCharts.set(result)

		// Pre-load visible album art (first 50)
		this.preloadAlbumArt(result.slice(0, 50))
	}

	/**
	 * Get album art URL for a chart - returns cached data URL or triggers load
	 */
	getAlbumArtUrl(chart: ChartArtMatch): string | null {
		if (!chart.hasAlbumArt) return null

		const cache = this.albumArtCache()
		// Return cached if available
		if (cache.has(chart.chartPath)) {
			return cache.get(chart.chartPath) || null
		}

		// Trigger async load if not already loading
		const loading = this.loadingArtPaths()
		if (!loading.has(chart.chartPath)) {
			this.loadAlbumArt(chart.chartPath)
		}

		return null // Will show placeholder until loaded
	}

	/**
	 * Load album art asynchronously and cache it
	 */
	private async loadAlbumArt(chartPath: string): Promise<void> {
		if (this.loadingArtPaths().has(chartPath)) return

		this.loadingArtPaths.update(paths => {
			const newPaths = new Set(paths)
			newPaths.add(chartPath)
			return newPaths
		})

		try {
			const dataUrl = await this.artStudioService.getAlbumArtDataUrl(chartPath)
			this.albumArtCache.update(cache => {
				const newCache = new Map(cache)
				newCache.set(chartPath, dataUrl)
				return newCache
			})
		} catch (err) {
			console.error('Failed to load album art:', err)
			this.albumArtCache.update(cache => {
				const newCache = new Map(cache)
				newCache.set(chartPath, null)
				return newCache
			})
		} finally {
			this.loadingArtPaths.update(paths => {
				const newPaths = new Set(paths)
				newPaths.delete(chartPath)
				return newPaths
			})
		}
	}

	/**
	 * Pre-load album art for a batch of charts
	 */
	private async preloadAlbumArt(charts: ChartArtMatch[]): Promise<void> {
		const cache = this.albumArtCache()
		const loading = this.loadingArtPaths()
		const toLoad = charts.filter(c =>
			c.hasAlbumArt &&
			!cache.has(c.chartPath) &&
			!loading.has(c.chartPath)
		)

		// Load in batches of 10 to avoid overwhelming
		for (let i = 0; i < toLoad.length; i += 10) {
			const batch = toLoad.slice(i, i + 10)
			await Promise.all(batch.map(c => this.loadAlbumArt(c.chartPath)))
		}
	}

	// ==================== Browse Backgrounds Methods ====================

	async loadAllChartsForBrowseBackgrounds(): Promise<void> {
		this.loadingCharts.set(true)

		try {
			const allCharts = this.catalogService.charts()

			// Convert ChartRecord to ChartArtMatch format
			const chartsForBrowse = allCharts.map(chart => ({
				chartId: chart.id,
				chartName: chart.name,
				chartArtist: chart.artist,
				chartAlbum: chart.album || '',
				chartPath: chart.path,
				hasAlbumArt: chart.hasAlbumArt,
				hasBackground: chart.hasBackground,
				suggestedQuery: `${chart.artist} ${chart.album || chart.name}`,
			}))
			this.allChartsForBrowseBackgrounds.set(chartsForBrowse)

			// Build artist options
			const artists = new Set<string>()
			chartsForBrowse.forEach(c => {
				if (c.chartArtist) artists.add(c.chartArtist)
			})
			this.browseBackgroundArtistOptions.set(Array.from(artists).sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase())
			))

			this.applyBrowseBackgroundsFilter()
		} catch (err) {
			console.error('Failed to load charts for browse backgrounds:', err)
		} finally {
			this.loadingCharts.set(false)
		}
	}

	applyBrowseBackgroundsFilter(): void {
		let result = [...this.allChartsForBrowseBackgrounds()]

		// Filter by missing only
		if (this.browseBackgroundsShowMissingOnly()) {
			result = result.filter(c => !c.hasBackground)
		}

		// Filter by search query
		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		// Filter by artist
		const artist = this.filterArtist()
		if (artist) {
			result = result.filter(c => c.chartArtist === artist)
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

		this.filteredBrowseBackgroundCharts.set(result)

		// Pre-load visible backgrounds (first 50)
		this.preloadBackgrounds(result.slice(0, 50))
	}

	/**
	 * Get background URL for a chart - returns cached data URL or triggers load
	 */
	getBackgroundUrl(chart: ChartArtMatch): string | null {
		if (!chart.hasBackground) return null

		const cache = this.backgroundCache()
		// Return cached if available
		if (cache.has(chart.chartPath)) {
			return cache.get(chart.chartPath) || null
		}

		// Trigger async load if not already loading
		const loading = this.loadingBackgroundPaths()
		if (!loading.has(chart.chartPath)) {
			this.loadBackground(chart.chartPath)
		}

		return null
	}

	/**
	 * Load background asynchronously and cache it
	 */
	private async loadBackground(chartPath: string): Promise<void> {
		if (this.loadingBackgroundPaths().has(chartPath)) return

		this.loadingBackgroundPaths.update(paths => {
			const newPaths = new Set(paths)
			newPaths.add(chartPath)
			return newPaths
		})

		try {
			const dataUrl = await this.artStudioService.getBackgroundDataUrl(chartPath)
			this.backgroundCache.update(cache => {
				const newCache = new Map(cache)
				newCache.set(chartPath, dataUrl)
				return newCache
			})
		} catch (err) {
			console.error('Failed to load background:', err)
			this.backgroundCache.update(cache => {
				const newCache = new Map(cache)
				newCache.set(chartPath, null)
				return newCache
			})
		} finally {
			this.loadingBackgroundPaths.update(paths => {
				const newPaths = new Set(paths)
				newPaths.delete(chartPath)
				return newPaths
			})
		}
	}

	/**
	 * Pre-load backgrounds for a batch of charts
	 */
	private async preloadBackgrounds(charts: ChartArtMatch[]): Promise<void> {
		const cache = this.backgroundCache()
		const loading = this.loadingBackgroundPaths()
		const toLoad = charts.filter(c =>
			c.hasBackground &&
			!cache.has(c.chartPath) &&
			!loading.has(c.chartPath)
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
		this.selectedBrowseBackgroundIds.update(ids => {
			const newIds = new Set(ids)
			if (newIds.has(chartId)) {
				newIds.delete(chartId)
			} else {
				newIds.add(chartId)
			}
			return newIds
		})
	}

	/**
	 * Select all visible charts in browse backgrounds
	 */
	selectAllBrowseBackgrounds(): void {
		const filtered = this.filteredBrowseBackgroundCharts()
		const selected = this.selectedBrowseBackgroundIds()
		if (selected.size === filtered.length) {
			this.selectedBrowseBackgroundIds.set(new Set())
		} else {
			this.selectedBrowseBackgroundIds.set(new Set(filtered.map(c => c.chartId)))
		}
	}

	/**
	 * Regenerate backgrounds for selected charts in browse mode
	 */
	async regenerateSelectedBackgrounds(): Promise<void> {
		const selectedIds = this.selectedBrowseBackgroundIds()
		if (selectedIds.size === 0) return

		const confirmed = confirm(
			`Regenerate backgrounds for ${selectedIds.size} charts with blur amount ${this.blurAmount()}?\n\n` +
			`This will delete and recreate the backgrounds.`
		)
		if (!confirmed) return

		this.isProcessing.set(true)
		this.batchResults.set(null)

		try {
			const result = await window.electron.invoke.artBatchRegenerateBackgrounds({
				chartIds: Array.from(selectedIds),
				blurAmount: this.blurAmount(),
			})
			this.batchResults.set(result)

			// Clear cache for regenerated backgrounds
			selectedIds.forEach(id => {
				const chart = this.allChartsForBrowseBackgrounds().find(c => c.chartId === id)
				if (chart) {
					this.backgroundCache.update(cache => {
						const newCache = new Map(cache)
						newCache.delete(chart.chartPath)
						return newCache
					})
					chart.hasBackground = true
				}
			})

			// Reload backgrounds
			const chartsToReload = this.filteredBrowseBackgroundCharts().filter(
				c => selectedIds.has(c.chartId)
			)
			this.preloadBackgrounds(chartsToReload)

			this.selectedBrowseBackgroundIds.set(new Set())
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()
		} catch (err) {
			console.error('Batch regenerate failed:', err)
		} finally {
			this.isProcessing.set(false)
		}
	}

	/**
	 * Regenerate background for single selected chart
	 */
	async regenerateSingleBackground(): Promise<void> {
		const chart = this.selectedChart()
		if (!chart) return

		const chartPath = chart.chartPath

		try {
			this.isProcessing.set(true)

			await this.artStudioService.generateBackground({
				chartId: chart.chartId,
				outputPath: chartPath,
				style: chart.hasAlbumArt ? 'blur' : 'gradient',
				blurAmount: this.blurAmount(),
			})

			// Clear cache and reload
			this.backgroundCache.update(cache => {
				const newCache = new Map(cache)
				newCache.delete(chartPath)
				return newCache
			})
			chart.hasBackground = true

			const chartInList = this.allChartsForBrowseBackgrounds().find(c => c.chartId === chart?.chartId)
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
			this.isProcessing.set(false)
		}
	}

	buildArtistOptions(): void {
		const albumArtArtists = new Set<string>()
		this.chartsMissingAlbumArt().forEach(c => {
			if (c.chartArtist) albumArtArtists.add(c.chartArtist)
		})
		this.albumArtArtistOptions.set(Array.from(albumArtArtists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		))

		const bgArtists = new Set<string>()
		this.chartsMissingBackground().forEach(c => {
			if (c.chartArtist) bgArtists.add(c.chartArtist)
		})
		this.backgroundArtistOptions.set(Array.from(bgArtists).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase())
		))
	}

	applyAlbumArtFilter(): void {
		let result = [...this.chartsMissingAlbumArt()]

		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		const artist = this.filterArtist()
		if (artist) {
			result = result.filter(c => c.chartArtist === artist)
		}

		const field = this.sortField()
		const direction = this.sortDirection()
		result.sort((a, b) => {
			const aVal = field === 'artist' ? a.chartArtist : a.chartName
			const bVal = field === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return direction === 'asc' ? cmp : -cmp
		})

		this.filteredAlbumArtCharts.set(result)
	}

	applyBackgroundFilter(): void {
		let result = [...this.chartsMissingBackground()]

		const query = this.filterQuery()
		if (query) {
			const queryLower = query.toLowerCase()
			result = result.filter(c =>
				c.chartName.toLowerCase().includes(queryLower) ||
				c.chartArtist.toLowerCase().includes(queryLower)
			)
		}

		const artist = this.filterArtist()
		if (artist) {
			result = result.filter(c => c.chartArtist === artist)
		}

		const field = this.sortField()
		const direction = this.sortDirection()
		result.sort((a, b) => {
			const aVal = field === 'artist' ? a.chartArtist : a.chartName
			const bVal = field === 'artist' ? b.chartArtist : b.chartName
			const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
			return direction === 'asc' ? cmp : -cmp
		})

		this.filteredBackgroundCharts.set(result)
	}

	toggleSortDirection(): void {
		this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc')
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()
	}

	clearFilters(): void {
		this.filterQuery.set('')
		this.filterArtist.set('')
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode.set(mode)
		this.selectedChart.set(null)
		this.albumArtResults.set([])
		this.searchError.set(null)
		this.batchMode.set(false)
		this.selectedChartIds.set(new Set())
		this.selectedBrowseBackgroundIds.set(new Set())
		this.batchResults.set(null)
		this.filterQuery.set('')
		this.filterArtist.set('')
		this.applyAlbumArtFilter()
		this.applyBackgroundFilter()

		// Load all charts when entering browse modes
		if (mode === 'browseAll') {
			this.loadAllChartsForBrowse()
		} else if (mode === 'browseBackgrounds') {
			this.loadAllChartsForBrowseBackgrounds()
		}
	}

	selectChart(chart: ChartArtMatch): void {
		this.selectedChart.set(chart)
		this.albumArtResults.set([])
		this.searchError.set(null)

		// Auto-search for album art
		if (this.viewMode() === 'albumArt') {
			this.searchAlbumArt()
		}
	}

	async searchAlbumArt(): Promise<void> {
		const chart = this.selectedChart()
		if (!chart) return

		this.isSearchingArt.set(true)
		this.searchError.set(null)
		this.albumArtResults.set([])

		try {
			const results = await this.artStudioService.searchAlbumArt(
				chart.chartArtist,
				chart.chartAlbum || chart.chartName
			)
			this.albumArtResults.set(results)

			if (results.length === 0) {
				this.searchError.set('No album art found. Try searching manually.')
			}
		} catch (err) {
			this.searchError.set(`Search failed: ${err}`)
		} finally {
			this.isSearchingArt.set(false)
		}
	}

	async downloadAlbumArt(result: AlbumArtResult): Promise<void> {
		const chart = this.selectedChart()
		if (!chart) return

		const chartPath = chart.chartPath
		const chartId = chart.chartId

		try {
			await this.artStudioService.downloadImage({
				chartId: chart.chartId,
				imageUrl: result.url,
				outputPath: chart.chartPath,
				type: 'album',
			})

			// Invalidate the cache for this chart so it reloads
			this.albumArtCache.update(cache => {
				const newCache = new Map(cache)
				newCache.delete(chartPath)
				return newCache
			})

			// Update the chart's hasAlbumArt flag in browse list
			const chartInBrowse = this.allChartsForBrowse().find(c => c.chartId === chartId)
			if (chartInBrowse) {
				chartInBrowse.hasAlbumArt = true
			}

			// Update selected chart
			chart.hasAlbumArt = true

			// Remove from missing list
			this.chartsMissingAlbumArt.update(charts =>
				charts.filter(c => c.chartId !== chartId)
			)
			this.applyAlbumArtFilter()

			// Clear search results but keep chart selected to show updated art
			this.albumArtResults.set([])

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()

			// Force reload of this chart's album art
			this.loadAlbumArt(chartPath)
		} catch (err) {
			console.error('Download failed:', err)
		}
	}

	async generateBackground(): Promise<void> {
		const chart = this.selectedChart()
		if (!chart) return

		try {
			await this.artStudioService.generateBackground({
				chartId: chart.chartId,
				outputPath: chart.chartPath,
				style: chart.hasAlbumArt ? 'blur' : 'gradient',
				blurAmount: this.blurAmount(),
			})

			// Remove from list and clear selection
			this.chartsMissingBackground.update(charts =>
				charts.filter(c => c.chartId !== chart?.chartId)
			)
			this.applyBackgroundFilter()
			this.selectedChart.set(null)
		} catch (err) {
			console.error('Generate failed:', err)
		}
	}

	// Batch operations
	toggleBatchMode(): void {
		this.batchMode.update(v => !v)
		this.selectedChartIds.set(new Set())
		this.batchResults.set(null)
	}

	toggleChartSelection(chartId: number): void {
		this.selectedChartIds.update(ids => {
			const newIds = new Set(ids)
			if (newIds.has(chartId)) {
				newIds.delete(chartId)
			} else {
				newIds.add(chartId)
			}
			return newIds
		})
	}

	selectAll(charts: ChartArtMatch[]): void {
		const ids = this.selectedChartIds()
		if (ids.size === charts.length) {
			this.selectedChartIds.set(new Set())
		} else {
			this.selectedChartIds.set(new Set(charts.map(c => c.chartId)))
		}
	}

	async batchFetchAlbumArt(): Promise<void> {
		const ids = this.selectedChartIds()
		if (ids.size === 0) return

		this.batchResults.set(null)

		try {
			const results = await this.artStudioService.batchFetchAlbumArt(Array.from(ids))
			this.batchResults.set(results)
			await this.loadCharts()
			this.selectedChartIds.set(new Set())
		} catch (err) {
			console.error('Batch fetch failed:', err)
		}
	}

	async batchGenerateBackgrounds(): Promise<void> {
		const ids = this.selectedChartIds()
		if (ids.size === 0) return

		this.batchResults.set(null)

		try {
			const results = await this.artStudioService.batchGenerateBackgrounds(Array.from(ids))
			this.batchResults.set(results)
			await this.loadCharts()
			this.selectedChartIds.set(new Set())
		} catch (err) {
			console.error('Batch generate failed:', err)
		}
	}

	async batchDeleteBackgrounds(): Promise<void> {
		const ids = this.selectedChartIds()
		if (ids.size === 0) return

		const confirmed = confirm(`Delete backgrounds from ${ids.size} charts?`)
		if (!confirmed) return

		this.batchResults.set(null)
		this.isProcessing.set(true)

		try {
			const result = await window.electron.invoke.artBatchDeleteBackgrounds(Array.from(ids))
			this.batchResults.set({ success: result.success, failed: result.failed, skipped: 0 })
			await this.loadCharts()
			this.selectedChartIds.set(new Set())
		} catch (err) {
			console.error('Batch delete failed:', err)
		} finally {
			this.isProcessing.set(false)
		}
	}

	async batchRegenerateBackgrounds(): Promise<void> {
		const ids = this.selectedChartIds()
		if (ids.size === 0) return

		const confirmed = confirm(
			`Regenerate backgrounds for ${ids.size} charts with blur amount ${this.blurAmount()}?\n\n` +
			`This will delete existing backgrounds and create new ones.`
		)
		if (!confirmed) return

		this.batchResults.set(null)
		this.isProcessing.set(true)

		try {
			const result = await window.electron.invoke.artBatchRegenerateBackgrounds({
				chartIds: Array.from(ids),
				blurAmount: this.blurAmount(),
			})
			this.batchResults.set(result)
			await this.loadCharts()
			this.selectedChartIds.set(new Set())
		} catch (err) {
			console.error('Batch regenerate failed:', err)
		} finally {
			this.isProcessing.set(false)
		}
	}

	goBack(): void {
		this.selectedChart.set(null)
		this.albumArtResults.set([])
		this.searchError.set(null)
	}

	async deleteSelectedAlbumArt(): Promise<void> {
		const chart = this.selectedChart()
		if (!chart) return

		const confirmed = confirm(`Delete album art for "${chart.chartName}"?`)
		if (!confirmed) return

		const chartPath = chart.chartPath

		try {
			await this.artStudioService.deleteAlbumArt(chart.chartId)

			// Clear the cache for this chart
			this.albumArtCache.update(cache => {
				const newCache = new Map(cache)
				newCache.delete(chartPath)
				return newCache
			})

			// Update the local data
			chart.hasAlbumArt = false
			const chartInList = this.allChartsForBrowse().find(c => c.chartId === chart?.chartId)
			if (chartInList) {
				chartInList.hasAlbumArt = false
			}

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()
		} catch (err) {
			console.error('Failed to delete album art:', err)
		}
	}

	async regenerateSelectedBackground(): Promise<void> {
		const chart = this.selectedChart()
		if (!chart || !chart.hasAlbumArt) return

		try {
			this.isProcessing.set(true)

			await this.artStudioService.generateBackground({
				chartId: chart.chartId,
				outputPath: chart.chartPath,
				style: 'blur',
				blurAmount: this.blurAmount(),
			})

			// Update the local data
			chart.hasBackground = true
			const chartInList = this.allChartsForBrowse().find(c => c.chartId === chart?.chartId)
			if (chartInList) {
				chartInList.hasBackground = true
			}

			// Refresh catalog
			this.catalogService.refreshCharts()
			this.catalogService.refreshStats()

		} catch (err) {
			console.error('Failed to regenerate background:', err)
		} finally {
			this.isProcessing.set(false)
		}
	}

	// Event handlers for template two-way binding
	onFilterQueryChange(value: string): void {
		this.filterQuery.set(value)
	}

	onFilterArtistChange(value: string): void {
		this.filterArtist.set(value)
	}

	onSortFieldChange(value: 'artist' | 'name'): void {
		this.sortField.set(value)
	}

	onBrowseShowMissingOnlyChange(value: boolean): void {
		this.browseShowMissingOnly.set(value)
		this.applyBrowseFilter()
	}

	onBrowseBackgroundsShowMissingOnlyChange(value: boolean): void {
		this.browseBackgroundsShowMissingOnly.set(value)
		this.applyBrowseBackgroundsFilter()
	}

	onBlurAmountChange(value: number): void {
		this.blurAmount.set(value)
	}

	clearBatchResults(): void {
		this.batchResults.set(null)
	}
}
