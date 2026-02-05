/**
 * Bridge Catalog Manager - Angular Catalog Service
 * Provides catalog operations to Angular components via Electron IPC
 */

import { Injectable, signal, inject, computed } from '@angular/core'
import { ChartRecord, CatalogFilter, CatalogStats, ScanProgress, ScanResult } from '../../../../src-shared/interfaces/catalog.interface.js'
import { SettingsService } from './settings.service'

/** Number of charts to load per page */
const PAGE_SIZE = 100

@Injectable({
	providedIn: 'root',
})
export class CatalogService {
	private settingsService = inject(SettingsService)

	// State signals
	readonly charts = signal<ChartRecord[]>([])
	readonly stats = signal<CatalogStats | null>(null)
	readonly scanProgress = signal<ScanProgress | null>(null)
	readonly isLoading = signal<boolean>(false)
	readonly isLoadingMore = signal<boolean>(false)
	readonly filter = signal<CatalogFilter>({
		sortBy: 'artist',
		sortDirection: 'asc',
	})

	// Pagination state
	readonly totalFilteredCount = signal<number>(0)
	readonly currentOffset = signal<number>(0)

	// Computed: whether there are more charts to load
	readonly hasMore = computed(() => {
		return this.charts().length < this.totalFilteredCount()
	})

	constructor() {
		this.setupIpcListeners()
		this.initializeFromSettings()
	}

	private setupIpcListeners(): void {
		window.electron.on.catalogScanProgress((progress: ScanProgress) => {
			this.scanProgress.set(progress)
			if (progress.phase === 'complete') {
				this.scanProgress.set(null)
				this.refreshCharts()
				this.refreshStats()
			}
		})
	}

	private async initializeFromSettings(): Promise<void> {
		// Wait a tick for settings to be loaded
		setTimeout(async () => {
			const libraryFolders = this.settingsService.libraryFolders
			if (libraryFolders && libraryFolders.length > 0) {
				this.refreshCharts()
				this.refreshStats()
			}
		}, 100)
	}

	async scanLibrary(): Promise<ScanResult | null> {
		const libraryFolders = this.settingsService.libraryFolders
		if (libraryFolders.length === 0) {
			console.error('No library folders configured')
			return null
		}

		const paths = libraryFolders.map(f => f.path)

		this.isLoading.set(true)
		try {
			const result = await window.electron.invoke.catalogScan(paths)
			return result
		} catch (err) {
			console.error('Failed to scan library:', err)
			return null
		} finally {
			this.isLoading.set(false)
		}
	}

	async refreshCharts(): Promise<void> {
		this.isLoading.set(true)
		try {
			const currentFilter = this.filter()

			// Get total count for pagination (without limit/offset)
			const totalCount = await window.electron.invoke.catalogGetChartsCount(currentFilter)
			this.totalFilteredCount.set(totalCount)

			// Get first page of charts
			const paginatedFilter = { ...currentFilter, limit: PAGE_SIZE, offset: 0 }
			const charts = await window.electron.invoke.catalogGetCharts(paginatedFilter)
			this.charts.set(charts)
			this.currentOffset.set(charts.length)
		} catch (err) {
			console.error('Failed to refresh charts:', err)
		} finally {
			this.isLoading.set(false)
		}
	}

	/**
	 * Load the next page of charts (for infinite scroll)
	 */
	async loadMoreCharts(): Promise<void> {
		if (this.isLoadingMore() || !this.hasMore()) return

		this.isLoadingMore.set(true)
		try {
			const currentFilter = this.filter()
			const offset = this.currentOffset()

			const paginatedFilter = { ...currentFilter, limit: PAGE_SIZE, offset }
			const newCharts = await window.electron.invoke.catalogGetCharts(paginatedFilter)

			if (newCharts.length > 0) {
				this.charts.update(existing => [...existing, ...newCharts])
				this.currentOffset.update(o => o + newCharts.length)
			}
		} catch (err) {
			console.error('Failed to load more charts:', err)
		} finally {
			this.isLoadingMore.set(false)
		}
	}

	async setFilter(filterUpdates: Partial<CatalogFilter>): Promise<void> {
		const newFilter = { ...this.filter(), ...filterUpdates }
		this.filter.set(newFilter)
		// Reset pagination when filter changes
		this.currentOffset.set(0)
		await this.refreshCharts()
	}

	async refreshStats(): Promise<void> {
		try {
			const stats = await window.electron.invoke.catalogGetStats()
			this.stats.set(stats)
		} catch (err) {
			console.error('Failed to get stats:', err)
		}
	}

	async getChart(id: number): Promise<ChartRecord | null> {
		try {
			return await window.electron.invoke.catalogGetChart(id)
		} catch (err) {
			console.error('Failed to get chart:', err)
			return null
		}
	}

	async updateChart(id: number, updates: Partial<ChartRecord>): Promise<ChartRecord | null> {
		try {
			const chart = await window.electron.invoke.catalogUpdateChart({ id, updates })
			await this.refreshCharts()
			return chart
		} catch (err) {
			console.error('Failed to update chart:', err)
			return null
		}
	}

	openChartFolder(id: number): void {
		window.electron.emit.catalogOpenFolder(id)
	}

	async getDistinctValues(column: 'artist' | 'charter' | 'genre' | 'album'): Promise<string[]> {
		try {
			return await window.electron.invoke.catalogGetDistinct(column)
		} catch (err) {
			console.error(`Failed to get distinct ${column}:`, err)
			return []
		}
	}

	// Quick filter helpers
	async filterMissingVideo(): Promise<void> {
		await this.setFilter({ hasVideo: false })
	}

	async filterMissingBackground(): Promise<void> {
		await this.setFilter({ hasBackground: false })
	}

	async filterMissingAlbumArt(): Promise<void> {
		await this.setFilter({ hasAlbumArt: false })
	}

	async clearFilters(): Promise<void> {
		await this.setFilter({
			search: undefined,
			artist: undefined,
			charter: undefined,
			genre: undefined,
			hasVideo: undefined,
			hasBackground: undefined,
			hasAlbumArt: undefined,
			minDifficulty: undefined,
			maxDifficulty: undefined,
			instrument: undefined,
			sortBy: 'artist',
			sortDirection: 'asc',
		})
	}

	async search(query: string): Promise<void> {
		await this.setFilter({ search: query || undefined })
	}

	getChartsByIds(ids: number[]): ChartRecord[] {
		const idSet = new Set(ids)
		return this.charts().filter(c => idSet.has(c.id))
	}

	// Chart deletion methods
	async deleteChart(id: number): Promise<{ success: boolean; error?: string }> {
		try {
			const result = await window.electron.invoke.catalogDeleteChart(id)
			if (result.success) {
				await this.refreshCharts()
				await this.refreshStats()
			}
			return result
		} catch (err) {
			console.error('Failed to delete chart:', err)
			return { success: false, error: String(err) }
		}
	}

	async deleteCharts(ids: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
		try {
			const result = await window.electron.invoke.catalogDeleteCharts(ids)
			await this.refreshCharts()
			await this.refreshStats()
			return result
		} catch (err) {
			console.error('Failed to delete charts:', err)
			return { success: 0, failed: ids.length, errors: [String(err)] }
		}
	}

	/**
	 * Check if charts exist in library by artist, name, and charter
	 * Used to mark Chorus search results that are already in library
	 */
	async checkChartsExist(
		charts: Array<{ artist: string; name: string; charter: string }>
	): Promise<Record<string, boolean>> {
		try {
			return await window.electron.invoke.catalogCheckChartsExist(charts)
		} catch (err) {
			console.error('Failed to check charts existence:', err)
			return {}
		}
	}

	/**
	 * Generate a key for chart existence lookup
	 * Matches the format used by checkChartsExist
	 */
	getChartExistenceKey(artist: string, name: string, charter: string): string {
		return `${artist.toLowerCase().trim()}|${name.toLowerCase().trim()}|${charter.toLowerCase().trim()}`
	}
}
