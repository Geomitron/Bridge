/**
 * Bridge Art Studio Module - IPC Handlers
 */

import * as path from 'path'
import * as fs from 'fs'
import {
	AlbumArtResult,
	ArtDownloadOptions,
	ArtDownloadProgress,
	BackgroundGenerateOptions,
	ChartArtMatch,
} from '../../../src-shared/interfaces/art-studio.interface.js'
import { getImageService } from './ImageService.js'
import { getCatalogDb } from '../catalog/CatalogDatabase.js'
import { mainWindow } from '../../main.js'

// Initialize service event forwarding
let serviceInitialized = false

function initService() {
	if (serviceInitialized) return
	serviceInitialized = true

	const imageService = getImageService()
	imageService.on('progress', (progress: ArtDownloadProgress) => {
		try {
			mainWindow?.webContents.send('artDownloadProgress', progress)
		} catch {
			// Window might be closed
		}
	})
}

/**
 * Search for album art
 */
export async function artSearchAlbumArt(input: { artist: string; album: string }): Promise<AlbumArtResult[]> {
	initService()
	const imageService = getImageService()
	return imageService.searchAlbumArt(input.artist, input.album)
}

/**
 * Download image to chart folder
 */
export async function artDownloadImage(options: ArtDownloadOptions): Promise<string> {
	initService()
	const imageService = getImageService()
	const db = getCatalogDb()

	// Get chart path if not provided
	if (!options.outputPath) {
		const chart = db.getChart(options.chartId)
		if (!chart) {
			throw new Error(`Chart not found: ${options.chartId}`)
		}
		options.outputPath = chart.path
	}

	const outputFile = await imageService.downloadImage(options)

	// Update catalog
	if (options.type === 'album') {
		db.updateChartAlbumArtStatus(options.chartId, true)
	} else {
		db.updateChartBackgroundStatus(options.chartId, true)
	}

	return outputFile
}

/**
 * Generate background from album art or solid color
 */
export async function artGenerateBackground(options: BackgroundGenerateOptions): Promise<string> {
	initService()
	const imageService = getImageService()
	const db = getCatalogDb()

	// Get chart info if not all provided
	const chart = db.getChart(options.chartId)
	if (!chart) {
		throw new Error(`Chart not found: ${options.chartId}`)
	}

	if (!options.outputPath) {
		options.outputPath = chart.path
	}

	// Always check for existing album art to use as base if not explicitly provided
	if (!options.albumArtPath) {
		try {
			const entries = await fs.promises.readdir(chart.path)
			for (const entry of entries) {
				const lower = entry.toLowerCase()
				if (lower === 'album.png' || lower === 'album.jpg' || lower === 'album.jpeg') {
					options.albumArtPath = path.join(chart.path, entry)
					break
				}
			}
		} catch (err) {
			console.error('Failed to read chart directory for album art:', err)
		}
	}

	const outputFile = await imageService.generateBackground(options)

	// Update catalog
	db.updateChartBackgroundStatus(options.chartId, true)

	return outputFile
}

/**
 * Get charts missing album art
 */
export async function artGetChartsMissingAlbumArt(limit: number = 10000): Promise<ChartArtMatch[]> {
	const db = getCatalogDb()
	const charts = db.getCharts({
		hasAlbumArt: false,
		limit,
		sortBy: 'artist',
		sortDirection: 'asc',
	})

	return charts.map(chart => ({
		chartId: chart.id,
		chartName: chart.name,
		chartArtist: chart.artist,
		chartAlbum: chart.album || '',
		chartPath: chart.path,
		hasBackground: chart.hasBackground,
		hasAlbumArt: chart.hasAlbumArt,
		suggestedQuery: `${chart.artist} ${chart.album || chart.name}`.trim(),
	}))
}

/**
 * Get charts missing backgrounds
 */
export async function artGetChartsMissingBackground(limit: number = 10000): Promise<ChartArtMatch[]> {
	const db = getCatalogDb()
	const charts = db.getCharts({
		hasBackground: false,
		limit,
		sortBy: 'artist',
		sortDirection: 'asc',
	})

	return charts.map(chart => ({
		chartId: chart.id,
		chartName: chart.name,
		chartArtist: chart.artist,
		chartAlbum: chart.album || '',
		chartPath: chart.path,
		hasBackground: chart.hasBackground,
		hasAlbumArt: chart.hasAlbumArt,
		suggestedQuery: `${chart.artist} ${chart.album || chart.name}`.trim(),
	}))
}

/**
 * Check if album art exists for a chart
 */
export async function artCheckChartAssets(chartId: number): Promise<{ hasAlbumArt: boolean; hasBackground: boolean; albumArtPath?: string; backgroundPath?: string }> {
	const db = getCatalogDb()
	const chart = db.getChart(chartId)

	if (!chart) {
		throw new Error(`Chart not found: ${chartId}`)
	}

	const result = {
		hasAlbumArt: false,
		hasBackground: false,
		albumArtPath: undefined as string | undefined,
		backgroundPath: undefined as string | undefined,
	}

	// Check for album art
	for (const ext of ['png', 'jpg', 'jpeg']) {
		const artPath = path.join(chart.path, `album.${ext}`)
		if (fs.existsSync(artPath)) {
			result.hasAlbumArt = true
			result.albumArtPath = artPath
			break
		}
	}

	// Check for background
	for (const ext of ['png', 'jpg', 'jpeg']) {
		const bgPath = path.join(chart.path, `background.${ext}`)
		if (fs.existsSync(bgPath)) {
			result.hasBackground = true
			result.backgroundPath = bgPath
			break
		}
	}

	return result
}

/**
 * Batch fetch album art for multiple charts
 */
export async function artBatchFetchAlbumArt(chartIds: number[]): Promise<{ success: number; failed: number; skipped: number }> {
	initService()
	const imageService = getImageService()
	const db = getCatalogDb()

	let success = 0
	let failed = 0
	let skipped = 0

	for (const chartId of chartIds) {
		const chart = db.getChart(chartId)
		if (!chart) {
			skipped++
			continue
		}

		// Skip if already has album art
		const existingArt = path.join(chart.path, 'album.png')
		const existingJpg = path.join(chart.path, 'album.jpg')
		if (fs.existsSync(existingArt) || fs.existsSync(existingJpg)) {
			skipped++
			continue
		}

		try {
			// Search for album art
			const results = await imageService.searchAlbumArt(chart.artist, chart.album || chart.name)

			if (results.length > 0) {
				// Download the first (best) result
				await imageService.downloadImage({
					chartId,
					imageUrl: results[0].url,
					outputPath: chart.path,
					type: 'album',
				})
				db.updateChartAlbumArtStatus(chartId, true)
				success++
			} else {
				failed++
			}
		} catch (err) {
			console.error(`Failed to fetch album art for ${chart.artist} - ${chart.name}:`, err)
			failed++
		}

		// Small delay to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 500))
	}

	return { success, failed, skipped }
}

/**
 * Batch generate backgrounds from album art
 */
export async function artBatchGenerateBackgrounds(chartIds: number[]): Promise<{ success: number; failed: number; skipped: number }> {
	initService()
	const imageService = getImageService()
	const db = getCatalogDb()

	let success = 0
	let failed = 0
	let skipped = 0

	for (const chartId of chartIds) {
		const chart = db.getChart(chartId)
		if (!chart) {
			skipped++
			continue
		}

		// Skip if already has background
		const existingBg = path.join(chart.path, 'background.png')
		const existingJpg = path.join(chart.path, 'background.jpg')
		if (fs.existsSync(existingBg) || fs.existsSync(existingJpg)) {
			skipped++
			continue
		}

		try {
			// Check for album art to use as base
			let albumArtPath: string | undefined
			for (const ext of ['png', 'jpg', 'jpeg']) {
				const artPath = path.join(chart.path, `album.${ext}`)
				if (fs.existsSync(artPath)) {
					albumArtPath = artPath
					break
				}
			}

			await imageService.generateBackground({
				chartId,
				outputPath: chart.path,
				style: albumArtPath ? 'blur' : 'gradient',
				albumArtPath,
			})

			db.updateChartBackgroundStatus(chartId, true)
			success++
		} catch (err) {
			console.error(`Failed to generate background for ${chart.artist} - ${chart.name}:`, err)
			failed++
		}
	}

	return { success, failed, skipped }
}

/**
 * Delete background image from chart folder
 */
export async function artDeleteBackground(chartId: number): Promise<{ success: boolean; error?: string }> {
	const db = getCatalogDb()
	const chart = db.getChart(chartId)

	if (!chart) {
		return { success: false, error: 'Chart not found' }
	}

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
	let deleted = false

	try {
		const entries = await fs.promises.readdir(chart.path)

		for (const entry of entries) {
			const lower = entry.toLowerCase()
			if (lower.startsWith('background') && imageExtensions.some(ext => lower.endsWith(ext))) {
				await fs.promises.unlink(path.join(chart.path, entry))
				deleted = true
			}
		}

		if (deleted) {
			db.updateChartBackgroundStatus(chartId, false)
		}

		return { success: true }
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

/**
 * Delete album art from chart folder
 */
export async function artDeleteAlbumArt(chartId: number): Promise<{ success: boolean; error?: string }> {
	const db = getCatalogDb()
	const chart = db.getChart(chartId)

	if (!chart) {
		return { success: false, error: 'Chart not found' }
	}

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
	let deleted = false

	try {
		const entries = await fs.promises.readdir(chart.path)

		for (const entry of entries) {
			const lower = entry.toLowerCase()
			if (lower.startsWith('album') && imageExtensions.some(ext => lower.endsWith(ext))) {
				await fs.promises.unlink(path.join(chart.path, entry))
				deleted = true
			}
		}

		if (deleted) {
			db.updateChartAlbumArtStatus(chartId, false)
		}

		return { success: true }
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

/**
 * Batch delete backgrounds
 */
export async function artBatchDeleteBackgrounds(chartIds: number[]): Promise<{ success: number; failed: number }> {
	const results = { success: 0, failed: 0 }

	for (const chartId of chartIds) {
		const result = await artDeleteBackground(chartId)
		if (result.success) {
			results.success++
		} else {
			results.failed++
		}
	}

	return results
}

/**
 * Batch regenerate backgrounds with custom blur
 */
export async function artBatchRegenerateBackgrounds(
	input: { chartIds: number[]; blurAmount: number }
): Promise<{ success: number; failed: number; skipped: number }> {
	initService()
	const imageService = getImageService()
	const db = getCatalogDb()

	const { chartIds, blurAmount = 50 } = input

	let success = 0
	let failed = 0
	let skipped = 0

	for (const chartId of chartIds) {
		const chart = db.getChart(chartId)
		if (!chart) {
			failed++
			continue
		}

		try {
			// Delete existing background first
			const entries = await fs.promises.readdir(chart.path)
			for (const entry of entries) {
				const lower = entry.toLowerCase()
				if (lower.startsWith('background') && ['.png', '.jpg', '.jpeg'].some(ext => lower.endsWith(ext))) {
					await fs.promises.unlink(path.join(chart.path, entry))
				}
			}

			// Check for album art to use as base
			let albumArtPath: string | undefined
			for (const ext of ['png', 'jpg', 'jpeg']) {
				const artPath = path.join(chart.path, `album.${ext}`)
				if (fs.existsSync(artPath)) {
					albumArtPath = artPath
					break
				}
			}

			if (!albumArtPath) {
				// No album art, skip or use gradient
				skipped++
				continue
			}

			await imageService.generateBackground({
				chartId,
				outputPath: chart.path,
				style: 'blur',
				albumArtPath,
				blurAmount,
			})

			db.updateChartBackgroundStatus(chartId, true)
			success++
		} catch (err) {
			console.error(`Failed to regenerate background for ${chart.artist} - ${chart.name}:`, err)
			failed++
		}
	}

	return { success, failed, skipped }
}

/**
 * Get album art as a base64 data URL
 * Used for displaying thumbnails in the renderer without file:// protocol issues
 */
export async function artGetAlbumArtDataUrl(
	input: { chartPath: string; maxSize?: number }
): Promise<string | null> {
	const { chartPath, maxSize = 150 } = input

	try {
		// Find the album art file
		const entries = await fs.promises.readdir(chartPath)
		let albumArtFile: string | null = null

		for (const entry of entries) {
			const lower = entry.toLowerCase()
			if (lower === 'album.png' || lower === 'album.jpg' || lower === 'album.jpeg') {
				albumArtFile = path.join(chartPath, entry)
				break
			}
		}

		if (!albumArtFile) return null

		// Read the file
		const buffer = await fs.promises.readFile(albumArtFile)
		const ext = path.extname(albumArtFile).toLowerCase()
		const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

		// Convert to base64 data URL
		const base64 = buffer.toString('base64')
		return `data:${mimeType};base64,${base64}`
	} catch (err) {
		console.error('Failed to get album art data URL:', err)
		return null
	}
}

/**
 * Get background as a base64 data URL
 * Used for displaying thumbnails in the renderer without file:// protocol issues
 */
export async function artGetBackgroundDataUrl(
	input: { chartPath: string; maxSize?: number }
): Promise<string | null> {
	const { chartPath, maxSize = 150 } = input

	try {
		// Find the background file
		const entries = await fs.promises.readdir(chartPath)
		let backgroundFile: string | null = null

		for (const entry of entries) {
			const lower = entry.toLowerCase()
			if (lower.startsWith('background') &&
				(lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
				backgroundFile = path.join(chartPath, entry)
				break
			}
		}

		if (!backgroundFile) return null

		// Read the file
		const buffer = await fs.promises.readFile(backgroundFile)
		const ext = path.extname(backgroundFile).toLowerCase()
		const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

		// Convert to base64 data URL
		const base64 = buffer.toString('base64')
		return `data:${mimeType};base64,${base64}`
	} catch (err) {
		console.error('Failed to get background data URL:', err)
		return null
	}
}
