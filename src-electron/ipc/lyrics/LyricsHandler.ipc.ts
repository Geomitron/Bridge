/**
 * Bridge Lyrics Module - IPC Handlers
 */

import { ChartLyricsMatch, LyricsSearchResult, LyricsDownloadProgress } from '../../../src-shared/interfaces/lyrics.interface.js'
import { getCatalogDb } from '../catalog/CatalogDatabase.js'
import { getLyricsService } from './LyricsService.js'
import { mainWindow } from '../../main.js'

// Initialize event forwarding
let initialized = false

function initLyricsService() {
	if (initialized) return
	initialized = true

	const service = getLyricsService()
	service.on('lyricsProgress', (progress: LyricsDownloadProgress) => {
		try {
			mainWindow?.webContents.send('lyricsProgress', progress)
		} catch {
			// Window might be closed
		}
	})
}

/**
 * Search LRCLIB for lyrics
 */
export async function lyricsSearch(input: { artist: string; title: string }): Promise<LyricsSearchResult[]> {
	const service = getLyricsService()
	return service.searchLyrics(input.artist, input.title)
}

/**
 * Get lyrics by exact match
 */
export async function lyricsGet(input: { artist: string; title: string; album?: string; duration?: number }): Promise<LyricsSearchResult | null> {
	const service = getLyricsService()
	return service.getLyrics(input.artist, input.title, input.album, input.duration)
}

/**
 * Get lyrics by LRCLIB ID
 */
export async function lyricsGetById(id: number): Promise<LyricsSearchResult | null> {
	const service = getLyricsService()
	return service.getLyricsById(id)
}

/**
 * Download and inject lyrics into a chart
 */
export async function lyricsDownload(input: {
	chartId: number
	lyricsId: number
	outputPath: string
	chartType: 'mid' | 'chart' | 'sng' | null
	offsetMs?: number
}): Promise<{ success: boolean; error?: string }> {
	initLyricsService()

	const service = getLyricsService()
	const db = getCatalogDb()

	const result = await service.downloadAndInjectLyrics(
		input.chartId,
		input.lyricsId,
		input.outputPath,
		input.chartType,
		input.offsetMs ?? 0
	)

	if (result.success) {
		db.updateChartLyricsStatus(input.chartId, true)
	}

	return result
}

/**
 * Get charts missing lyrics
 */
export async function lyricsGetChartsMissing(limit: number = 10000): Promise<ChartLyricsMatch[]> {
	const db = getCatalogDb()

	// Get charts without lyrics, preferring .chart files since we can inject into those
	const charts = db.getCharts({
		hasLyrics: false,
		limit,
	})

	return charts.map(chart => ({
		chartId: chart.id,
		chartName: chart.name,
		chartArtist: chart.artist,
		chartAlbum: chart.album,
		chartPath: chart.path,
		chartType: chart.chartType,
		songLength: chart.songLength,
		suggestedQuery: `${chart.artist} ${chart.name}`.trim(),
	}))
}

/**
 * Batch search and download lyrics for multiple charts
 */
export async function lyricsBatchDownload(chartIds: number[]): Promise<{ success: number; failed: number; skipped: number }> {
	initLyricsService()

	const db = getCatalogDb()
	const service = getLyricsService()
	const results = { success: 0, failed: 0, skipped: 0 }

	for (const chartId of chartIds) {
		const chart = db.getChart(chartId)
		if (!chart) {
			results.failed++
			continue
		}

		// Skip if already has lyrics
		if (chart.hasLyrics) {
			results.skipped++
			continue
		}

		// Skip MIDI files for now
		if (chart.chartType !== 'chart') {
			results.skipped++
			continue
		}

		try {
			// Search for lyrics
			const searchResults = await service.searchLyrics(chart.artist, chart.name)

			if (searchResults.length === 0) {
				results.failed++
				continue
			}

			// Use first result
			const lyrics = searchResults[0]

			const result = await service.downloadAndInjectLyrics(
				chartId,
				lyrics.id,
				chart.path,
				chart.chartType
			)

			if (result.success) {
				db.updateChartLyricsStatus(chartId, true)
				results.success++
			} else {
				results.failed++
			}

			// Small delay between requests to be nice to LRCLIB
			await new Promise(resolve => setTimeout(resolve, 500))
		} catch {
			results.failed++
		}
	}

	return results
}

/**
 * Check if a chart has lyrics
 */
export async function lyricsCheckChart(chartId: number): Promise<{ hasLyrics: boolean }> {
	const db = getCatalogDb()
	const chart = db.getChart(chartId)

	return {
		hasLyrics: chart?.hasLyrics ?? false,
	}
}

/**
 * Delete lyrics from a chart file
 */
export async function lyricsDelete(chartId: number): Promise<{ success: boolean; error?: string }> {
	const db = getCatalogDb()
	const service = getLyricsService()

	const chart = db.getChart(chartId)
	if (!chart) {
		return { success: false, error: 'Chart not found' }
	}

	try {
		const result = await service.deleteLyrics(chart.path, chart.chartType)
		if (result.success) {
			db.updateChartLyricsStatus(chartId, false)
		}
		return result
	} catch (err) {
		return { success: false, error: `Error deleting lyrics: ${err}` }
	}
}

/**
 * Get audio file path for a chart (for sync tool preview)
 * Returns as base64 data URL for playback in renderer
 */
export async function lyricsGetAudioPath(chartPath: string): Promise<{ dataUrl: string; vocalStartMs: number | null; hasVocalsTrack: boolean } | null> {
	const service = getLyricsService()
	return service.getAudioAsDataUrl(chartPath)
}
