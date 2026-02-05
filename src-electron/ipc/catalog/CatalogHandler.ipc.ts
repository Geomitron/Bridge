/**
 * Bridge Catalog Manager - IPC Handlers
 * Exports functions that match Bridge's IPC pattern
 */

import { shell, dialog } from 'electron'
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
 * Get all configured library paths
 */
export async function catalogGetLibraryPaths(): Promise<string[]> {
	const db = getCatalogDb()
	const pathsJson = db.getSetting('libraryPaths')
	if (!pathsJson) return []
	try {
		return JSON.parse(pathsJson)
	} catch {
		return []
	}
}

/**
 * Add a new library path (opens dialog)
 */
export async function catalogAddLibraryPath(): Promise<string | null> {
	const db = getCatalogDb()

	const result = await dialog.showOpenDialog(mainWindow, {
		title: 'Select Chart Library Folder',
		properties: ['openDirectory'],
		message: 'Choose a folder containing your charts',
	})

	if (result.canceled || !result.filePaths.length) {
		return null
	}

	const newPath = result.filePaths[0]

	// Get existing paths
	const pathsJson = db.getSetting('libraryPaths')
	let paths: string[] = []
	if (pathsJson) {
		try {
			paths = JSON.parse(pathsJson)
		} catch {
			paths = []
		}
	}

	// Add new path if not already present
	if (!paths.includes(newPath)) {
		paths.push(newPath)
		db.setSetting('libraryPaths', JSON.stringify(paths))
	}

	return newPath
}

/**
 * Remove a library path by index
 */
export async function catalogRemoveLibraryPath(index: number): Promise<void> {
	const db = getCatalogDb()

	const pathsJson = db.getSetting('libraryPaths')
	if (!pathsJson) return

	try {
		const paths: string[] = JSON.parse(pathsJson)
		if (index >= 0 && index < paths.length) {
			paths.splice(index, 1)
			db.setSetting('libraryPaths', JSON.stringify(paths))
		}
	} catch {
		// Invalid JSON, reset
		db.setSetting('libraryPaths', '[]')
	}
}

/**
 * Scan all library paths for charts
 */
export async function catalogScan() {
	initScanner()

	const db = getCatalogDb()
	const pathsJson = db.getSetting('libraryPaths')

	if (!pathsJson) {
		throw new Error('No library paths configured. Please add at least one library folder.')
	}

	let paths: string[] = []
	try {
		paths = JSON.parse(pathsJson)
	} catch {
		throw new Error('Invalid library paths configuration.')
	}

	if (paths.length === 0) {
		throw new Error('No library paths configured. Please add at least one library folder.')
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
 * Get the configured removal folder
 */
export async function catalogGetRemovalFolder(): Promise<string | null> {
	const db = getCatalogDb()
	return db.getSetting('removalFolder') || null
}

/**
 * Set the removal folder (opens dialog)
 */
export async function catalogSetRemovalFolder(): Promise<string | null> {
	const db = getCatalogDb()

	const result = await dialog.showOpenDialog(mainWindow, {
		title: 'Select Removal Folder',
		properties: ['openDirectory'],
		message: 'Choose a folder where removed charts will be moved',
	})

	if (result.canceled || !result.filePaths.length) {
		return null
	}

	const folderPath = result.filePaths[0]
	db.setSetting('removalFolder', folderPath)
	return folderPath
}

/**
 * Clear the removal folder setting
 */
export async function catalogClearRemovalFolder(): Promise<void> {
	const db = getCatalogDb()
	db.setSetting('removalFolder', '')
}

/**
 * Remove a chart by moving it to the removal folder
 */
export async function catalogRemoveChart(id: number): Promise<{ success: boolean; error?: string }> {
	const db = getCatalogDb()

	const removalFolder = db.getSetting('removalFolder')
	if (!removalFolder) {
		return { success: false, error: 'No removal folder configured. Please set one in Library > Folders.' }
	}

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

		// Check if removal folder exists, create if not
		try {
			await fs.promises.access(removalFolder)
		} catch {
			try {
				await fs.promises.mkdir(removalFolder, { recursive: true })
			} catch (mkdirErr) {
				return {
					success: false,
					error: `Cannot create removal folder "${removalFolder}": ${mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr)}`,
				}
			}
		}

		// Get the chart folder name
		const folderName = path.basename(chart.path)

		// Create unique destination path (add timestamp if folder exists)
		let destPath = path.join(removalFolder, folderName)
		if (await fileExists(destPath)) {
			const timestamp = Date.now()
			destPath = path.join(removalFolder, `${folderName}_${timestamp}`)
		}

		// Try to move the folder
		try {
			await fs.promises.rename(chart.path, destPath)
		} catch (renameErr) {
			// rename() fails across drives, try copy + delete
			const errMsg = renameErr instanceof Error ? renameErr.message : String(renameErr)

			if (errMsg.includes('EXDEV') || errMsg.includes('cross-device')) {
				// Cross-device move - need to copy then delete
				try {
					await copyDirectory(chart.path, destPath)
					await fs.promises.rm(chart.path, { recursive: true, force: true })
				} catch (copyErr) {
					return {
						success: false,
						error: `Failed to copy chart across drives: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`,
					}
				}
			} else {
				return {
					success: false,
					error: `Failed to move chart: ${errMsg}\nFrom: ${chart.path}\nTo: ${destPath}`,
				}
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
 * Copy a directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
	await fs.promises.mkdir(dest, { recursive: true })
	const entries = await fs.promises.readdir(src, { withFileTypes: true })

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)

		if (entry.isDirectory()) {
			await copyDirectory(srcPath, destPath)
		} else {
			await fs.promises.copyFile(srcPath, destPath)
		}
	}
}

/**
 * Remove multiple charts
 */
export async function catalogRemoveCharts(ids: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
	const results = { success: 0, failed: 0, errors: [] as string[] }

	for (const id of ids) {
		const result = await catalogRemoveChart(id)
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
