/**
 * Bridge Catalog Manager - IPC Handlers
 * Exports functions that match Bridge's IPC pattern
 */

import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { CatalogFilter, ChartRecord, ScanProgress } from '../../../src-shared/interfaces/catalog.interface.js'
import { getCatalogDb } from './CatalogDatabase.js'
import { getChartScanner } from './ChartScanner.js'
import { mainWindow } from '../../main.js'

// Initialize scanner event forwarding
let scannerInitialized = false

function initScanner() {
	if (scannerInitialized) return
	scannerInitialized = true

	const scanner = getChartScanner()
	scanner.on('progress', (progress: ScanProgress) => {
		try {
			mainWindow?.webContents.send('catalogScanProgress', progress)
		} catch {
			// Window might be closed
		}
	})
}

/**
 * Scan library paths for charts
 * @param paths Array of folder paths to scan
 */
export async function catalogScan(paths: string[]) {
	initScanner()

	if (!paths || paths.length === 0) {
		throw new Error('No library paths provided. Please configure library folders in Settings.')
	}

	const scanner = getChartScanner()
	return scanner.scanLibraryPaths(paths)
}

/**
 * Get charts with filtering
 */
export async function catalogGetCharts(filter: CatalogFilter) {
	const db = getCatalogDb()
	return db.getCharts(filter)
}

/**
 * Get a single chart by ID
 */
export async function catalogGetChart(id: number) {
	const db = getCatalogDb()
	return db.getChart(id)
}

/**
 * Get catalog statistics
 */
export async function catalogGetStats() {
	const db = getCatalogDb()
	return db.getStats()
}

/**
 * Get count of charts matching filter (for pagination)
 */
export async function catalogGetChartsCount(filter: CatalogFilter) {
	const db = getCatalogDb()
	return db.getChartsCount(filter)
}

/**
 * Update chart metadata
 */
export async function catalogUpdateChart(input: { id: number; updates: Partial<ChartRecord> }) {
	const db = getCatalogDb()
	const scanner = getChartScanner()

	const chart = db.getChart(input.id)
	if (!chart) {
		throw new Error(`Chart not found: ${input.id}`)
	}

	// Update song.ini on disk
	await updateSongIni(chart.path, input.updates)

	// Rescan to pick up changes
	return scanner.rescanChart(chart.path)
}

/**
 * Get distinct values for filter dropdowns
 */
export async function catalogGetDistinct(column: 'artist' | 'charter' | 'genre' | 'album') {
	const db = getCatalogDb()
	return db.getDistinctValues(column)
}

/**
 * Open chart folder in file explorer
 */
export function catalogOpenFolder(id: number) {
	const db = getCatalogDb()
	const chart = db.getChart(id)
	if (chart) {
		shell.openPath(chart.path)
	}
}

/**
 * Update song.ini file with new values
 */
async function updateSongIni(chartPath: string, updates: Partial<ChartRecord>): Promise<void> {
	const iniPath = path.join(chartPath, 'song.ini')

	let content = ''
	let hasSection = false

	try {
		content = await fs.promises.readFile(iniPath, 'utf-8')
		hasSection = content.toLowerCase().includes('[song]')
	} catch {
		// File doesn't exist, we'll create it
	}

	const lines = content.split(/\r?\n/)
	const existingKeys = new Map<string, number>()

	lines.forEach((line, index) => {
		const match = line.match(/^([^=]+)=(.*)$/)
		if (match) {
			existingKeys.set(match[1].trim().toLowerCase(), index)
		}
	})

	// Map ChartRecord fields to song.ini keys
	const fieldMap: Record<string, string> = {
		name: 'name',
		artist: 'artist',
		album: 'album',
		genre: 'genre',
		year: 'year',
		charter: 'charter',
	}

	for (const [field, iniKey] of Object.entries(fieldMap)) {
		if (field in updates) {
			const value = updates[field as keyof ChartRecord]
			if (value === undefined || value === null) continue

			// Don't add quotes - Clone Hero handles values without them
			const iniValue = String(value)
			const lineContent = `${iniKey} = ${iniValue}`

			if (existingKeys.has(iniKey.toLowerCase())) {
				lines[existingKeys.get(iniKey.toLowerCase())!] = lineContent
			} else {
				if (hasSection) {
					const sectionIndex = lines.findIndex(l => l.toLowerCase().includes('[song]'))
					lines.splice(sectionIndex + 1, 0, lineContent)
				} else {
					lines.push(lineContent)
				}
			}
		}
	}

	// Ensure file starts with [song] section
	if (!hasSection && lines.length > 0 && !lines[0].toLowerCase().startsWith('[')) {
		lines.unshift('[song]')
	}

	await fs.promises.writeFile(iniPath, lines.join('\n'), 'utf-8')
}

/**
 * Delete a chart permanently
 */
export async function catalogDeleteChart(id: number): Promise<{ success: boolean; error?: string }> {
	const db = getCatalogDb()

	const chart = db.getChart(id)
	if (!chart) {
		return { success: false, error: `Chart not found (ID: ${id})` }
	}

	try {
		// Check if source folder exists
		try {
			await fs.promises.access(chart.path)
		} catch {
			// Source doesn't exist, just remove from DB
			db.deleteChart(id)
			return { success: true }
		}

		// Delete the chart folder permanently
		try {
			await fs.promises.rm(chart.path, { recursive: true, force: true })
		} catch (deleteErr) {
			return {
				success: false,
				error: `Failed to delete chart: ${deleteErr instanceof Error ? deleteErr.message : String(deleteErr)}\nPath: ${chart.path}`,
			}
		}

		// Remove from database
		db.deleteChart(id)

		return { success: true }
	} catch (err) {
		return {
			success: false,
			error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
		}
	}
}

/**
 * Delete multiple charts permanently
 */
export async function catalogDeleteCharts(ids: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
	const results = { success: 0, failed: 0, errors: [] as string[] }

	for (const id of ids) {
		const result = await catalogDeleteChart(id)
		if (result.success) {
			results.success++
		} else {
			results.failed++
			if (result.error) {
				results.errors.push(result.error)
			}
		}
	}

	return results
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.promises.access(filePath)
		return true
	} catch {
		return false
	}
}

/**
 * Check if charts exist in library by artist, name, and charter
 * Used to mark Chorus search results that are already in library
 */
export async function catalogCheckChartsExist(
	charts: Array<{ artist: string; name: string; charter: string }>
): Promise<Record<string, boolean>> {
	const db = getCatalogDb()
	const resultMap = db.checkChartsExist(charts)

	// Convert Map to plain object for IPC serialization
	const result: Record<string, boolean> = {}
	resultMap.forEach((value, key) => {
		result[key] = value
	})

	return result
}
