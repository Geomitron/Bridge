/**
 * Bridge Catalog Manager - Library Component
 * Main UI for browsing and managing local chart library
 */

import { Component, OnInit, inject, signal, computed, effect } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs'
import { ChartRecord, CatalogStats, ScanProgress, CatalogFilter } from '../../../../src-shared/interfaces/catalog.interface.js'
import { CatalogService } from '../../core/services/catalog.service'
import { ArtStudioService } from '../../core/services/art-studio.service'

@Component({
	selector: 'app-library',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './library.component.html',
})
export class LibraryComponent implements OnInit {
	private catalogService = inject(CatalogService)
	private artStudioService = inject(ArtStudioService)
	private router = inject(Router)
	private sanitizer = inject(DomSanitizer)

	private searchSubject = new Subject<string>()

	// Data (signals from service)
	charts = signal<ChartRecord[]>([])
	stats = signal<CatalogStats | null>(null)
	scanProgress = signal<ScanProgress | null>(null)
	libraryPaths = signal<string[]>([])
	filter = signal<CatalogFilter>({
		sortBy: 'artist',
		sortDirection: 'asc',
	})

	// UI State
	isLoading = signal(false)
	selectedIds = signal<Set<number>>(new Set())
	searchQuery = signal('')
	editingChart = signal<ChartRecord | null>(null)
	showFolderModal = signal(false)
	showFiltersExpanded = signal(false)
	removalFolder = signal<string | null>(null)
	showRemovalConfirm = signal(false)
	chartToRemove = signal<ChartRecord | null>(null)
	removalError = signal<string | null>(null)
	hoveredChartId = signal<number | null>(null)

	// Duplicates tracking
	showDuplicatesOnly = signal(false)
	duplicateKeys = signal<Set<string>>(new Set())  // Set of "artist|name" keys that have duplicates

	// Album art preview cache (path -> dataUrl)
	albumArtCache = signal<Map<string, string | null>>(new Map())
	loadingArtPaths = signal<Set<string>>(new Set())

	// Filter dropdown options
	artistOptions = signal<string[]>([])
	charterOptions = signal<string[]>([])
	genreOptions = signal<string[]>([])
	albumOptions = signal<string[]>([])

	// Computed properties
	allSelected = computed(() => {
		const charts = this.charts()
		const selectedIds = this.selectedIds()
		return charts.length > 0 && selectedIds.size === charts.length
	})

	selectedCharts = computed(() => {
		const ids = [...this.selectedIds()]
		return this.catalogService.getChartsByIds(ids)
	})

	hasActiveFilters = computed(() => {
		const f = this.filter()
		return !!(
			f.search ||
			f.artist ||
			f.charter ||
			f.genre ||
			f.chartType ||
			f.hasVideo !== undefined ||
			f.hasBackground !== undefined ||
			f.hasAlbumArt !== undefined ||
			f.hasGuitar !== undefined ||
			f.hasBass !== undefined ||
			f.hasDrums !== undefined ||
			f.hasKeys !== undefined ||
			f.hasVocals !== undefined ||
			f.guitarDiff ||
			f.bassDiff ||
			f.drumsDiff ||
			f.keysDiff
		)
	})

	missingVideoCount = computed(() => {
		const s = this.stats()
		return s ? s.totalCharts - s.withVideo : 0
	})

	missingBackgroundCount = computed(() => {
		const s = this.stats()
		return s ? s.totalCharts - s.withBackground : 0
	})

	missingAlbumArtCount = computed(() => {
		const s = this.stats()
		return s ? s.totalCharts - s.withAlbumArt : 0
	})

	missingLyricsCount = computed(() => {
		const s = this.stats()
		return s ? s.totalCharts - s.withLyrics : 0
	})

	scanProgressPercent = computed(() => {
		const progress = this.scanProgress()
		if (!progress || progress.total === 0) return 0
		return Math.round((progress.current / progress.total) * 100)
	})

	isScanning = computed(() => {
		const progress = this.scanProgress()
		return progress !== null &&
			progress.phase !== 'complete' &&
			progress.phase !== 'error'
	})

	duplicateCount = computed(() => {
		let count = 0
		const charts = this.charts()
		for (const chart of charts) {
			if (this.isDuplicate(chart)) {
				count++
			}
		}
		return count
	})

	displayedCharts = computed(() => {
		const charts = this.charts()
		if (this.showDuplicatesOnly()) {
			return charts.filter(c => this.isDuplicate(c))
		}
		return charts
	})

	constructor() {
		// Effect to react to charts changes and compute duplicates
		effect(() => {
			const charts = this.catalogService.charts()
			this.charts.set(charts)
			this.computeDuplicates(charts)
		})

		// Effect to react to stats changes
		effect(() => {
			this.stats.set(this.catalogService.stats())
		})

		// Effect to react to scanProgress changes
		effect(() => {
			this.scanProgress.set(this.catalogService.scanProgress())
		})

		// Effect to react to isLoading changes
		effect(() => {
			this.isLoading.set(this.catalogService.isLoading())
		})

		// Effect to react to libraryPaths changes
		effect(() => {
			this.libraryPaths.set(this.catalogService.libraryPaths())
		})

		// Effect to react to filter changes
		effect(() => {
			this.filter.set(this.catalogService.filter())
		})

		// Debounced search
		this.searchSubject.pipe(
			debounceTime(300),
			distinctUntilChanged(),
		).subscribe(query => {
			this.catalogService.search(query)
		})
	}

	ngOnInit(): void {
		// Load filter options
		this.loadFilterOptions()
		this.loadRemovalFolder()
	}

	async loadRemovalFolder(): Promise<void> {
		const folder = await this.catalogService.getRemovalFolder()
		this.removalFolder.set(folder)
	}

	async loadFilterOptions(): Promise<void> {
		const [artists, charters, genres, albums] = await Promise.all([
			this.catalogService.getDistinctValues('artist'),
			this.catalogService.getDistinctValues('charter'),
			this.catalogService.getDistinctValues('genre'),
			this.catalogService.getDistinctValues('album'),
		])
		this.artistOptions.set(artists)
		this.charterOptions.set(charters)
		this.genreOptions.set(genres)
		this.albumOptions.set(albums)
	}

	toggleFilters(): void {
		this.showFiltersExpanded.update(v => !v)
	}

	// Folder management
	manageFolders(): void {
		this.showFolderModal.set(true)
	}

	closeFolderModal(): void {
		this.showFolderModal.set(false)
	}

	async addFolder(): Promise<void> {
		await this.catalogService.addLibraryPath()
	}

	async removeFolder(index: number): Promise<void> {
		await this.catalogService.removeLibraryPath(index)
	}

	async saveFoldersAndScan(): Promise<void> {
		this.closeFolderModal()
		await this.scanLibrary()
	}

	async scanLibrary(): Promise<void> {
		if (this.libraryPaths().length === 0) {
			this.manageFolders()
			return
		}
		// Set immediate loading state before async operation starts
		this.scanProgress.set({ phase: 'starting', current: 0, total: 0, message: 'Starting scan...' })

		await this.catalogService.scanLibrary()
		await this.loadFilterOptions()
	}

	onSearchInput(event: Event): void {
		const query = (event.target as HTMLInputElement).value
		this.searchQuery.set(query)
		this.searchSubject.next(query)
	}

	clearSearch(): void {
		this.searchQuery.set('')
		this.searchSubject.next('')
	}

	sortBy(column: string): void {
		const currentFilter = this.filter()
		if (currentFilter.sortBy === column) {
			this.catalogService.setFilter({
				sortDirection: currentFilter.sortDirection === 'asc' ? 'desc' : 'asc',
			})
		} else {
			this.catalogService.setFilter({
				sortBy: column as CatalogFilter['sortBy'],
				sortDirection: 'asc',
			})
		}
	}

	getSortIndicator(column: string): string {
		const f = this.filter()
		if (f.sortBy !== column) return ''
		return f.sortDirection === 'asc' ? ' ▲' : ' ▼'
	}

	filterByAsset(asset: 'video' | 'background' | 'albumArt' | 'lyrics', hasAsset: boolean | undefined): void {
		switch (asset) {
			case 'video':
				this.catalogService.setFilter({ hasVideo: hasAsset })
				break
			case 'background':
				this.catalogService.setFilter({ hasBackground: hasAsset })
				break
			case 'albumArt':
				this.catalogService.setFilter({ hasAlbumArt: hasAsset })
				break
			case 'lyrics':
				this.catalogService.setFilter({ hasLyrics: hasAsset })
				break
		}
	}

	filterByArtist(artist: string): void {
		this.catalogService.setFilter({ artist: artist || undefined })
	}

	filterByCharter(charter: string): void {
		this.catalogService.setFilter({ charter: charter || undefined })
	}

	filterByGenre(genre: string): void {
		this.catalogService.setFilter({ genre: genre || undefined })
	}

	filterByChartType(chartType: string): void {
		this.catalogService.setFilter({ chartType: (chartType || undefined) as 'mid' | 'chart' | undefined })
	}

	filterByInstrument(instrument: string, value: string): void {
		const hasValue = value === '' ? undefined : value === 'true'
		switch (instrument) {
			case 'guitar':
				this.catalogService.setFilter({ hasGuitar: hasValue })
				break
			case 'bass':
				this.catalogService.setFilter({ hasBass: hasValue })
				break
			case 'drums':
				this.catalogService.setFilter({ hasDrums: hasValue })
				break
			case 'keys':
				this.catalogService.setFilter({ hasKeys: hasValue })
				break
			case 'vocals':
				this.catalogService.setFilter({ hasVocals: hasValue })
				break
		}
	}

	filterByDifficulty(instrument: string, diff: string): void {
		const diffValue = (diff || undefined) as 'e' | 'm' | 'h' | 'x' | undefined
		switch (instrument) {
			case 'guitar':
				this.catalogService.setFilter({ guitarDiff: diffValue })
				break
			case 'bass':
				this.catalogService.setFilter({ bassDiff: diffValue })
				break
			case 'drums':
				this.catalogService.setFilter({ drumsDiff: diffValue })
				break
			case 'keys':
				this.catalogService.setFilter({ keysDiff: diffValue })
				break
		}
	}

	clearFilters(): void {
		this.searchQuery.set('')
		this.catalogService.clearFilters()
	}

	toggleSelection(chart: ChartRecord): void {
		this.selectedIds.update(ids => {
			const newIds = new Set(ids)
			if (newIds.has(chart.id)) {
				newIds.delete(chart.id)
			} else {
				newIds.add(chart.id)
			}
			return newIds
		})
	}

	isSelected(chart: ChartRecord): boolean {
		return this.selectedIds().has(chart.id)
	}

	selectAll(): void {
		const charts = this.charts()
		const ids = this.selectedIds()
		if (ids.size === charts.length) {
			this.selectedIds.set(new Set())
		} else {
			this.selectedIds.set(new Set(charts.map(c => c.id)))
		}
	}

	clearSelection(): void {
		this.selectedIds.set(new Set())
	}

	openFolder(chart: ChartRecord): void {
		this.catalogService.openChartFolder(chart.id)
	}

	editChart(chart: ChartRecord): void {
		this.editingChart.set({ ...chart })
	}

	async saveChart(): Promise<void> {
		const chart = this.editingChart()
		if (!chart) return

		await this.catalogService.updateChart(chart.id, {
			name: chart.name,
			artist: chart.artist,
			album: chart.album,
			genre: chart.genre,
			year: chart.year,
			charter: chart.charter,
		})

		this.editingChart.set(null)
		await this.loadFilterOptions()
	}

	cancelEdit(): void {
		this.editingChart.set(null)
	}

	// Removal folder management
	async setRemovalFolder(): Promise<void> {
		const folder = await this.catalogService.setRemovalFolder()
		if (folder) {
			this.removalFolder.set(folder)
		}
	}

	async clearRemovalFolder(): Promise<void> {
		await this.catalogService.clearRemovalFolder()
		this.removalFolder.set(null)
	}

	confirmRemoveChart(chart: ChartRecord): void {
		if (!this.removalFolder()) {
			this.removalError.set('Please set a removal folder first. Click the Folders button to configure it.')
			return
		}
		this.chartToRemove.set(chart)
		this.showRemovalConfirm.set(true)
		this.removalError.set(null)
	}

	cancelRemoval(): void {
		this.chartToRemove.set(null)
		this.showRemovalConfirm.set(false)
		this.removalError.set(null)
	}

	async executeRemoval(): Promise<void> {
		const chart = this.chartToRemove()
		if (!chart) return

		this.removalError.set(null)

		try {
			const result = await this.catalogService.removeChart(chart.id)

			if (!result.success) {
				this.removalError.set(result.error || 'Unknown error occurred')
				console.error('Removal failed:', result.error)
				// Keep modal open to show error
				return
			}

			// Success - close modal
			this.chartToRemove.set(null)
			this.showRemovalConfirm.set(false)
			this.selectedIds.set(new Set())
		} catch (err) {
			this.removalError.set(`Exception: ${err instanceof Error ? err.message : String(err)}`)
			console.error('Removal exception:', err)
		}
	}

	async removeSelectedCharts(): Promise<void> {
		if (!this.removalFolder()) {
			this.removalError.set('Please set a removal folder first. Click the Folders button to configure it.')
			return
		}

		const ids = this.selectedIds()
		if (ids.size === 0) return

		const confirmed = confirm(`Remove ${ids.size} chart(s) to the removal folder?`)
		if (!confirmed) return

		this.removalError.set(null)

		try {
			const result = await this.catalogService.removeCharts([...ids])

			if (result.failed > 0) {
				this.removalError.set(`Removed ${result.success} charts. ${result.failed} failed.\n${result.errors.join('\n')}`)
				console.error('Batch removal errors:', result.errors)
			}

			this.selectedIds.set(new Set())
		} catch (err) {
			this.removalError.set(`Exception: ${err instanceof Error ? err.message : String(err)}`)
			console.error('Batch removal exception:', err)
		}
	}

	dismissError(): void {
		this.removalError.set(null)
	}

	// Format difficulty levels for display
	formatDiffs(diffs: string): string {
		if (!diffs) return '-'
		return diffs.split(',').map(d => {
			switch (d) {
				case 'e': return 'E'
				case 'm': return 'M'
				case 'h': return 'H'
				case 'x': return 'X'
				default: return d.toUpperCase()
			}
		}).join('')
	}

	// Asset deletion methods
	async deleteVideo(chart: ChartRecord): Promise<void> {
		if (!confirm(`Delete video from "${chart.artist} - ${chart.name}"?`)) return

		try {
			const result = await window.electron.invoke.videoDeleteFromChart(chart.id)
			if (result.success) {
				await this.catalogService.refreshCharts()
				await this.catalogService.refreshStats()
			} else {
				this.removalError.set(result.error || 'Failed to delete video')
			}
		} catch (err) {
			this.removalError.set(`Error: ${err}`)
		}
	}

	async deleteBackground(chart: ChartRecord): Promise<void> {
		if (!confirm(`Delete background from "${chart.artist} - ${chart.name}"?`)) return

		try {
			const result = await window.electron.invoke.artDeleteBackground(chart.id)
			if (result.success) {
				await this.catalogService.refreshCharts()
				await this.catalogService.refreshStats()
			} else {
				this.removalError.set(result.error || 'Failed to delete background')
			}
		} catch (err) {
			this.removalError.set(`Error: ${err}`)
		}
	}

	async deleteAlbumArt(chart: ChartRecord): Promise<void> {
		if (!confirm(`Delete album art from "${chart.artist} - ${chart.name}"?`)) return

		try {
			const result = await window.electron.invoke.artDeleteAlbumArt(chart.id)
			if (result.success) {
				await this.catalogService.refreshCharts()
				await this.catalogService.refreshStats()
			} else {
				this.removalError.set(result.error || 'Failed to delete album art')
			}
		} catch (err) {
			this.removalError.set(`Error: ${err}`)
		}
	}

	async deleteLyrics(chart: ChartRecord): Promise<void> {
		if (!confirm(`Delete lyrics from "${chart.artist} - ${chart.name}"?`)) return

		try {
			const result = await window.electron.invoke.lyricsDelete(chart.id)
			if (result.success) {
				await this.catalogService.refreshCharts()
				await this.catalogService.refreshStats()
			} else {
				this.removalError.set(result.error || 'Failed to delete lyrics')
			}
		} catch (err) {
			this.removalError.set(`Error: ${err}`)
		}
	}

	// Navigation methods - go to specific tabs with chart pre-selected
	goToVideo(chart: ChartRecord): void {
		// Store selected chart info for video tab to pick up
		sessionStorage.setItem('selectedChartForVideo', JSON.stringify({
			id: chart.id,
			name: chart.name,
			artist: chart.artist,
			path: chart.path,
			songLength: chart.songLength,
		}))
		this.router.navigate(['/video-sync'])
	}

	goToArt(chart: ChartRecord, type: 'album' | 'background'): void {
		sessionStorage.setItem('selectedChartForArt', JSON.stringify({
			id: chart.id,
			name: chart.name,
			artist: chart.artist,
			album: chart.album,
			path: chart.path,
			type,
		}))
		this.router.navigate(['/art-studio'])
	}

	goToLyrics(chart: ChartRecord): void {
		sessionStorage.setItem('selectedChartForLyrics', JSON.stringify({
			id: chart.id,
			name: chart.name,
			artist: chart.artist,
			album: chart.album,
			path: chart.path,
			chartType: chart.chartType,
		}))
		this.router.navigate(['/lyrics'])
	}

	// ==================== Duplicates Detection ====================

	private computeDuplicates(charts: ChartRecord[]): void {
		// Count occurrences of each artist+name combo (case insensitive)
		const counts = new Map<string, number>()

		for (const chart of charts) {
			const key = `${(chart.artist || '').toLowerCase().trim()}|${(chart.name || '').toLowerCase().trim()}`
			counts.set(key, (counts.get(key) || 0) + 1)
		}

		// Store keys that have more than one occurrence
		const newDuplicateKeys = new Set<string>()
		for (const [key, count] of counts) {
			if (count > 1) {
				newDuplicateKeys.add(key)
			}
		}
		this.duplicateKeys.set(newDuplicateKeys)
	}

	isDuplicate(chart: ChartRecord): boolean {
		const key = `${(chart.artist || '').toLowerCase().trim()}|${(chart.name || '').toLowerCase().trim()}`
		return this.duplicateKeys().has(key)
	}

	toggleDuplicatesFilter(): void {
		this.showDuplicatesOnly.update(v => !v)
	}

	// ==================== Charter Name Rendering ====================

	renderCharterName(charter: string | null): SafeHtml {
		if (!charter) return ''

		// Parse <color=X>text</color> or <color=#XXXXXX>text</color> tags
		let result = charter

		// Handle <color=name>text</color> and <color=#hex>text</color>
		result = result.replace(/<color=([^>]+)>([^<]*)<\/color>/gi, (_, color, text) => {
			// Sanitize color value - only allow valid color names or hex codes
			const safeColor = this.sanitizeColor(color)
			return `<span style="color: ${safeColor}">${this.escapeHtml(text)}</span>`
		})

		// Handle unclosed color tags like <color=orange>text (rest of string)
		result = result.replace(/<color=([^>]+)>([^<]*)/gi, (_, color, text) => {
			const safeColor = this.sanitizeColor(color)
			return `<span style="color: ${safeColor}">${this.escapeHtml(text)}</span>`
		})

		// Remove any remaining HTML tags for safety
		result = result.replace(/<(?!\/?span)[^>]+>/g, '')

		return this.sanitizer.bypassSecurityTrustHtml(result)
	}

	private sanitizeColor(color: string): string {
		// Allow hex colors
		if (/^#[0-9A-Fa-f]{3,8}$/.test(color)) {
			return color
		}

		// Allow common color names
		const validColors = [
			'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'cyan',
			'magenta', 'white', 'black', 'gray', 'grey', 'lime', 'aqua', 'navy',
			'teal', 'olive', 'maroon', 'silver', 'gold', 'coral', 'crimson',
		]

		if (validColors.includes(color.toLowerCase())) {
			return color.toLowerCase()
		}

		// Default to inherit if color is invalid
		return 'inherit'
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;')
	}

	/**
	 * Strip HTML tags from charter names for dropdown display
	 */
	stripHtmlTags(text: string): string {
		if (!text) return ''
		// Remove <color=X>...</color> tags and any other HTML
		return text
			.replace(/<color=[^>]*>/gi, '')
			.replace(/<\/color>/gi, '')
			.replace(/<[^>]*>/g, '')
	}

	/**
	 * Get album art URL for a chart - returns cached data URL or triggers load
	 */
	getAlbumArtUrl(chart: ChartRecord): string | null {
		if (!chart.hasAlbumArt) return null

		// Return cached if available
		const cache = this.albumArtCache()
		if (cache.has(chart.path)) {
			return cache.get(chart.path) || null
		}

		// Trigger async load if not already loading
		const loading = this.loadingArtPaths()
		if (!loading.has(chart.path)) {
			this.loadAlbumArt(chart.path)
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

	// Helper method for ngModel binding on editingChart
	updateEditingChart(field: keyof ChartRecord, value: any): void {
		this.editingChart.update(chart => {
			if (!chart) return null
			return { ...chart, [field]: value }
		})
	}
}
