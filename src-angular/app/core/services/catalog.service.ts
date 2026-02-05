/**
 * Bridge Catalog Manager - Angular Catalog Service
 * Provides catalog operations to Angular components via Electron IPC
 */

import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChartRecord, CatalogFilter, CatalogStats, ScanProgress, ScanResult } from '../../../../src-shared/interfaces/catalog.interface.js'

@Injectable({
	providedIn: 'root',
})
export class CatalogService {
	// State subjects
	private chartsSubject = new BehaviorSubject<ChartRecord[]>([])
	private statsSubject = new BehaviorSubject<CatalogStats | null>(null)
	private scanProgressSubject = new BehaviorSubject<ScanProgress | null>(null)
	private isLoadingSubject = new BehaviorSubject<boolean>(false)
	private libraryPathsSubject = new BehaviorSubject<string[]>([])
	private filterSubject = new BehaviorSubject<CatalogFilter>({
		sortBy: 'artist',
		sortDirection: 'asc',
	})

	// Public observables
	readonly charts$ = this.chartsSubject.asObservable()
	readonly stats$ = this.statsSubject.asObservable()
	readonly scanProgress$ = this.scanProgressSubject.asObservable()
	readonly isLoading$ = this.isLoadingSubject.asObservable()
	readonly libraryPaths$ = this.libraryPathsSubject.asObservable()
	readonly filter$ = this.filterSubject.asObservable()

	constructor() {
		this.setupIpcListeners()
		this.loadLibraryPaths()
	}

	private setupIpcListeners(): void {
		window.electron.on.catalogScanProgress((progress: ScanProgress) => {
			this.scanProgressSubject.next(progress)
			if (progress.phase === 'complete') {
				this.scanProgressSubject.next(null)
				this.refreshCharts()
				this.refreshStats()
			}
		})
	}

	private async loadLibraryPaths(): Promise<void> {
		try {
			const paths = await window.electron.invoke.catalogGetLibraryPaths()
			this.libraryPathsSubject.next(paths || [])
			if (paths && paths.length > 0) {
				this.refreshCharts()
				this.refreshStats()
			}
		} catch (err) {
			console.error('Failed to load library paths:', err)
		}
	}

	async addLibraryPath(): Promise<string | null> {
		try {
			const newPath = await window.electron.invoke.catalogAddLibraryPath()
			if (newPath) {
				const paths = await window.electron.invoke.catalogGetLibraryPaths()
				this.libraryPathsSubject.next(paths || [])
			}
			return newPath
		} catch (err) {
			console.error('Failed to add library path:', err)
			return null
		}
	}

	async removeLibraryPath(index: number): Promise<void> {
		try {
			await window.electron.invoke.catalogRemoveLibraryPath(index)
			const paths = await window.electron.invoke.catalogGetLibraryPaths()
			this.libraryPathsSubject.next(paths || [])
		} catch (err) {
			console.error('Failed to remove library path:', err)
		}
	}

	async scanLibrary(): Promise<ScanResult | null> {
		this.isLoadingSubject.next(true)
		try {
			const result = await window.electron.invoke.catalogScan()
			return result
		} catch (err) {
			console.error('Failed to scan library:', err)
			return null
		} finally {
			this.isLoadingSubject.next(false)
		}
	}

	async refreshCharts(): Promise<void> {
		this.isLoadingSubject.next(true)
		try {
			const filter = this.filterSubject.value
			const charts = await window.electron.invoke.catalogGetCharts(filter)
			this.chartsSubject.next(charts)
		} catch (err) {
			console.error('Failed to refresh charts:', err)
		} finally {
			this.isLoadingSubject.next(false)
		}
	}

	async setFilter(filter: Partial<CatalogFilter>): Promise<void> {
		const newFilter = { ...this.filterSubject.value, ...filter }
		this.filterSubject.next(newFilter)
		await this.refreshCharts()
	}

	async refreshStats(): Promise<void> {
		try {
			const stats = await window.electron.invoke.catalogGetStats()
			this.statsSubject.next(stats)
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

	// Sync accessors
	get charts(): ChartRecord[] {
		return this.chartsSubject.value
	}

	get stats(): CatalogStats | null {
		return this.statsSubject.value
	}

	get filter(): CatalogFilter {
		return this.filterSubject.value
	}

	get libraryPaths(): string[] {
		return this.libraryPathsSubject.value
	}

	getChartsByIds(ids: number[]): ChartRecord[] {
		const idSet = new Set(ids)
		return this.charts.filter(c => idSet.has(c.id))
	}

	// Removal folder methods
	async getRemovalFolder(): Promise<string | null> {
		try {
			return await window.electron.invoke.catalogGetRemovalFolder()
		} catch (err) {
			console.error('Failed to get removal folder:', err)
			return null
		}
	}

	async setRemovalFolder(): Promise<string | null> {
		try {
			return await window.electron.invoke.catalogSetRemovalFolder()
		} catch (err) {
			console.error('Failed to set removal folder:', err)
			return null
		}
	}

	async clearRemovalFolder(): Promise<void> {
		try {
			await window.electron.invoke.catalogClearRemovalFolder()
		} catch (err) {
			console.error('Failed to clear removal folder:', err)
		}
	}

	async removeChart(id: number): Promise<{ success: boolean; error?: string }> {
		try {
			const result = await window.electron.invoke.catalogRemoveChart(id)
			if (result.success) {
				await this.refreshCharts()
				await this.refreshStats()
			}
			return result
		} catch (err) {
			console.error('Failed to remove chart:', err)
			return { success: false, error: String(err) }
		}
	}

	async removeCharts(ids: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
		try {
			const result = await window.electron.invoke.catalogRemoveCharts(ids)
			await this.refreshCharts()
			await this.refreshStats()
			return result
		} catch (err) {
			console.error('Failed to remove charts:', err)
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
