/**
 * Bridge Catalog Manager - Chart Scanner Service
 * Scans directories for Clone Hero/YARG charts and extracts metadata
 */

import Bottleneck from 'bottleneck'
import * as crypto from 'crypto'
import { EventEmitter } from 'eventemitter3'
import * as fs from 'fs'
import * as path from 'path'
import { SngHeader, SngStream } from 'parse-sng'
import { scanChartFolder, ScannedChart, Difficulty, Instrument } from 'scan-chart'
import { Readable } from 'stream'

import { ChartRecord, ChartAssets, ScanProgress, ScanResult } from '../../../src-shared/interfaces/catalog.interface.js'
import { appearsToBeChartFolder, getExtension, hasChartExtension, hasIniExtension, hasAlbumName, hasSngExtension } from '../../../src-shared/UtilFunctions.js'
import { hasVideoExtension } from '../../ElectronUtilFunctions.js'
import { getCatalogDb } from './CatalogDatabase.js'

// File patterns for asset detection
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.webm', '.mkv', '.mov']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const STEM_NAMES = ['guitar', 'bass', 'drums', 'vocals', 'keys', 'rhythm', 'crowd', 'backing']
const AUDIO_EXTENSIONS = ['.ogg', '.mp3', '.wav', '.opus']

// Scanning configuration
const CONFIG = {
	/** Maximum concurrent chart scans - balances speed vs memory */
	MAX_CONCURRENT_SCANS: 20,
	/** Maximum directory depth to prevent infinite recursion */
	MAX_DIRECTORY_DEPTH: 20,
	/** Progress update interval - don't emit for every chart on large scans */
	PROGRESS_UPDATE_INTERVAL: 1,
	/** Maximum file size to read into memory (2GB) */
	MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024 * 1024,
	/** Total max size of files to load per chart (5GB) */
	MAX_TOTAL_FILES_SIZE_BYTES: 5 * 1024 * 1024 * 1024,
}

interface ScannerEvents {
	progress: (progress: ScanProgress) => void
}

interface ChartFolder {
	path: string
	files: string[]
	isSng: boolean
	folderHash?: string
}

class ChartScanner extends EventEmitter<ScannerEvents> {
	private isScanning = false
	private shouldCancel = false

	// Rate limiter for concurrent scans - ensures bounded memory usage
	private scanLimiter = new Bottleneck({
		maxConcurrent: CONFIG.MAX_CONCURRENT_SCANS,
	})

	/**
	 * Scan multiple library paths for charts
	 * Optimized for large libraries with parallel discovery and scanning
	 */
	async scanLibraryPaths(libraryPaths: string[]): Promise<ScanResult> {
		if (this.isScanning) {
			throw new Error('Scan already in progress')
		}

		this.isScanning = true
		this.shouldCancel = false
		const startTime = Date.now()
		const db = getCatalogDb()

		const result: ScanResult = {
			added: 0,
			updated: 0,
			removed: 0,
			errors: [],
			duration: 0,
		}

		try {
			// Phase 1: Discover chart folders from all paths in parallel
			this.emit('progress', { phase: 'discovering', current: 0, total: 0, message: 'Discovering chart folders...' })

			const discoveryPromises = libraryPaths.map(async libraryPath => {
				try {
					await fs.promises.access(libraryPath)
					return await this.discoverChartFolders(libraryPath)
				} catch (err) {
					result.errors.push({
						path: libraryPath,
						error: `Cannot access folder: ${err instanceof Error ? err.message : String(err)}`,
					})
					return []
				}
			})

			const discoveredArrays = await Promise.all(discoveryPromises)
			const allChartFolders = discoveredArrays.flat()

			if (this.shouldCancel) {
				return { ...result, duration: Date.now() - startTime }
			}

			this.emit('progress', {
				phase: 'discovering',
				current: allChartFolders.length,
				total: allChartFolders.length,
				message: `Found ${allChartFolders.length} chart folders`,
			})

			// Phase 2: Get existing paths and hashes for incremental scanning
			const existingPaths = db.getAllPaths()
			const existingHashes = db.getAllHashes()
			const scannedPaths = new Set<string>()
			const total = allChartFolders.length

			// Phase 3: Scan charts with rate limiting
			let completed = 0
			let lastProgressUpdate = 0

			const scanPromises = allChartFolders.map(chartFolder =>
				this.scanLimiter.schedule(async () => {
					if (this.shouldCancel) return

					scannedPaths.add(chartFolder.path)

					try {
						// Compute folder hash first to check if we can skip
						const folderHash = await this.computeFolderHash(chartFolder.path, chartFolder.files)

						// Check if chart exists and is unchanged
						const isNew = !existingPaths.has(chartFolder.path)
						const existingHash = existingHashes.get(chartFolder.path)
						const isUnchanged = !isNew && existingHash === folderHash

						if (isUnchanged) {
							// Chart unchanged, just update lastScanned
							db.touchChart(chartFolder.path)
							result.updated++
						} else {
							// Chart is new or changed - perform full scan
							const chart = await this.scanChartFolder(chartFolder, folderHash)
							db.upsertChart(chart)

							if (isNew) {
								result.added++
							} else {
								result.updated++
							}
						}
					} catch (err) {
						result.errors.push({
							path: chartFolder.path,
							error: err instanceof Error ? err.message : String(err),
						})
					}

					// Throttled progress updates for large scans
					completed++
					if (completed - lastProgressUpdate >= CONFIG.PROGRESS_UPDATE_INTERVAL || completed === total) {
						lastProgressUpdate = completed
						this.emit('progress', {
							phase: 'scanning',
							current: completed,
							total,
							currentPath: chartFolder.path,
							message: `Scanned ${completed}/${total} charts`,
						})
					}
				})
			)

			await Promise.all(scanPromises)

			// Phase 4: Remove orphaned records
			if (!this.shouldCancel) {
				result.removed = db.deleteOrphans(scannedPaths)
			}

			result.duration = Date.now() - startTime
			this.emit('progress', { phase: 'complete', current: total, total, message: 'Scan complete' })

			return result
		} finally {
			this.isScanning = false
		}
	}

	cancelScan(): void {
		this.shouldCancel = true
		this.scanLimiter.stop()
		// Recreate limiter for next scan
		this.scanLimiter = new Bottleneck({
			maxConcurrent: CONFIG.MAX_CONCURRENT_SCANS,
		})
	}

	/**
	 * Discover all chart folders in a directory tree
	 * Uses parallel traversal for speed
	 */
	private async discoverChartFolders(rootPath: string): Promise<ChartFolder[]> {
		const chartFolders: ChartFolder[] = []

		const scanDir = async (dirPath: string, depth: number): Promise<void> => {
			if (depth > CONFIG.MAX_DIRECTORY_DEPTH || this.shouldCancel) return

			let entries: fs.Dirent[]
			try {
				entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
			} catch {
				return
			}

			// Check for .sng files first
			const sngFiles = entries.filter(e => e.isFile() && hasSngExtension(e.name))
			for (const sngFile of sngFiles) {
				chartFolders.push({
					path: path.join(dirPath, sngFile.name),
					files: [sngFile.name],
					isSng: true,
				})
			}

			// Get all files for chart folder detection
			const files = entries.filter(e => e.isFile()).map(e => e.name)
			const extensions = files.map(f => getExtension(f))

			// Check if this appears to be a chart folder (has chart file + ini/audio)
			const subfolders = entries.filter(e =>
				e.isDirectory() && !e.name.startsWith('.') && e.name !== '__MACOSX'
			)

			if (appearsToBeChartFolder(extensions) && subfolders.length === 0) {
				// This is a chart folder - don't recurse into it
				chartFolders.push({
					path: dirPath,
					files,
					isSng: false,
				})
				return
			}

			// Recurse into subdirectories in parallel
			const subPromises = subfolders.map(entry =>
				scanDir(path.join(dirPath, entry.name), depth + 1)
			)
			await Promise.all(subPromises)
		}

		await scanDir(rootPath, 0)
		return chartFolders
	}

	/**
	 * Scan a single chart folder and extract metadata using scan-chart library
	 */
	private async scanChartFolder(chartFolder: ChartFolder, folderHash: string): Promise<Omit<ChartRecord, 'id'>> {
		// Load files for scan-chart
		const files = chartFolder.isSng
			? await this.getFilesFromSng(chartFolder.path)
			: await this.getFilesFromFolder(chartFolder)

		// Use scan-chart library for robust parsing
		const scannedChart = scanChartFolder(files)

		// Detect additional assets not covered by scan-chart
		const assets = chartFolder.isSng
			? this.getAssetsFromSngFiles(files)
			: await this.detectAssets(chartFolder.path)

		// Convert scan-chart result to our ChartRecord format
		return this.convertToChartRecord(scannedChart, chartFolder.path, folderHash, assets)
	}

	/**
	 * Load files from a regular chart folder
	 */
	private async getFilesFromFolder(chartFolder: ChartFolder): Promise<{ fileName: string; data: Uint8Array }[]> {
		const results: { fileName: string; data: Uint8Array }[] = []
		let totalSize = 0

		// Sort files by size to load smaller files first
		const filesWithStats = await Promise.all(
			chartFolder.files.map(async fileName => {
				const filePath = path.join(chartFolder.path, fileName)
				try {
					const stat = await fs.promises.stat(filePath)
					return { fileName, filePath, size: stat.size }
				} catch {
					return { fileName, filePath, size: 0 }
				}
			})
		)

		const sortedFiles = filesWithStats.sort((a, b) => a.size - b.size)

		for (const { fileName, filePath, size } of sortedFiles) {
			// Only load files needed for scanning (chart, ini, album art)
			// Skip large files like video/audio unless needed
			const shouldLoad = hasChartExtension(fileName) ||
				hasIniExtension(fileName) ||
				hasAlbumName(fileName)

			if (shouldLoad && size < CONFIG.MAX_FILE_SIZE_BYTES && totalSize + size < CONFIG.MAX_TOTAL_FILES_SIZE_BYTES) {
				try {
					const data = await fs.promises.readFile(filePath)
					results.push({ fileName, data })
					totalSize += size
				} catch {
					// File read failed, add with empty data
					results.push({ fileName, data: new Uint8Array() })
				}
			} else {
				// Add file reference without data (for asset detection)
				results.push({ fileName, data: new Uint8Array() })
			}
		}

		return results
	}

	/**
	 * Load files from a .sng archive
	 */
	private async getFilesFromSng(sngPath: string): Promise<{ fileName: string; data: Uint8Array }[]> {
		const files: { fileName: string; data: Uint8Array }[] = []

		try {
			const sngStream = new SngStream(
				Readable.toWeb(fs.createReadStream(sngPath)) as ReadableStream<Uint8Array>,
				{ generateSongIni: true }
			)

			let header: SngHeader

			await new Promise<void>((resolve, reject) => {
				sngStream.on('header', h => { header = h })
				sngStream.on('error', reject)

				sngStream.on('file', async (fileName, fileStream, nextFile) => {
					try {
						// Check file size from header
						const fileMeta = header?.fileMeta?.find(f => f.filename === fileName)
						const fileSize = fileMeta ? Number(fileMeta.contentsLen) : 0
						const shouldLoad = hasChartExtension(fileName) ||
							hasIniExtension(fileName) ||
							hasAlbumName(fileName)

						if (shouldLoad && fileSize < CONFIG.MAX_FILE_SIZE_BYTES && !hasVideoExtension(fileName)) {
							// Read the file data
							const chunks: Uint8Array[] = []
							const reader = fileStream.getReader()

							while (true) {
								const { done, value } = await reader.read()
								if (done) break
								chunks.push(value)
							}

							const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
							const data = new Uint8Array(totalLength)
							let offset = 0
							for (const chunk of chunks) {
								data.set(chunk, offset)
								offset += chunk.length
							}

							files.push({ fileName, data })
						} else {
							// Skip large/video files but record their presence
							const reader = fileStream.getReader()
							while (true) {
								const { done } = await reader.read()
								if (done) break
							}
							files.push({ fileName, data: new Uint8Array() })
						}

						if (nextFile) {
							nextFile()
						} else {
							resolve()
						}
					} catch (err) {
						reject(err)
					}
				})

				sngStream.start()
			})
		} catch (err) {
			// .sng parsing failed, return empty files
			console.error('Failed to parse .sng file:', err)
		}

		return files
	}

	/**
	 * Convert ScannedChart from scan-chart to our ChartRecord format
	 */
	private convertToChartRecord(
		scanned: ScannedChart,
		folderPath: string,
		folderHash: string,
		assets: ChartAssets
	): Omit<ChartRecord, 'id'> {
		const notesData = scanned.notesData

		// Get instrument presence from notesData
		const instruments = notesData?.instruments ?? []
		const hasGuitar = instruments.includes('guitar')
		const hasBass = instruments.includes('bass')
		const hasDrums = instruments.includes('drums')
		const hasKeys = instruments.includes('keys')
		const hasRhythm = instruments.includes('rhythm')
		const hasGHL = instruments.includes('guitarghl') || instruments.includes('bassghl')
		const hasVocals = notesData?.hasVocals ?? false

		// Extract difficulty levels per instrument from notesData
		const getDifficultiesForInstrument = (inst: Instrument): string => {
			if (!notesData?.noteCounts) return ''
			const diffs = notesData.noteCounts
				.filter(nc => nc.instrument === inst && nc.count > 0)
				.map(nc => this.difficultyToCode(nc.difficulty))
			return this.sortDifficulties(diffs).join(',')
		}

		// Determine chart type from available files
		let chartType: 'mid' | 'chart' | 'sng' | null = null
		if (assets.chart) {
			const lower = assets.chart.toLowerCase()
			if (lower.endsWith('.mid')) chartType = 'mid'
			else if (lower.endsWith('.chart')) chartType = 'chart'
			else if (lower.endsWith('.sng') || folderPath.toLowerCase().endsWith('.sng')) chartType = 'sng'
		} else if (folderPath.toLowerCase().endsWith('.sng')) {
			chartType = 'sng'
		}

		return {
			path: folderPath,
			name: scanned.name || path.basename(folderPath).replace(/\.sng$/i, ''),
			artist: scanned.artist || 'Unknown Artist',
			album: scanned.album || '',
			genre: scanned.genre || '',
			year: this.parseYear(scanned.year),
			charter: scanned.charter || '',

			diff_guitar: scanned.diff_guitar ?? null,
			diff_bass: scanned.diff_bass ?? null,
			diff_drums: scanned.diff_drums ?? null,
			diff_keys: scanned.diff_keys ?? null,
			diff_vocals: scanned.diff_vocals ?? null,
			diff_rhythm: scanned.diff_rhythm ?? null,
			diff_guitarghl: scanned.diff_guitarghl ?? null,
			diff_bassghl: scanned.diff_bassghl ?? null,

			hasGuitar,
			hasBass,
			hasDrums,
			hasKeys,
			hasVocals,
			hasRhythm,
			hasGHL,

			guitarDiffs: getDifficultiesForInstrument('guitar'),
			bassDiffs: getDifficultiesForInstrument('bass'),
			drumsDiffs: getDifficultiesForInstrument('drums'),
			keysDiffs: getDifficultiesForInstrument('keys'),
			vocalsDiffs: '', // Vocals don't have traditional difficulty levels
			rhythmDiffs: getDifficultiesForInstrument('rhythm'),
			ghlGuitarDiffs: getDifficultiesForInstrument('guitarghl'),
			ghlBassDiffs: getDifficultiesForInstrument('bassghl'),

			chartType,

			hasVideo: scanned.hasVideoBackground || assets.video !== null,
			hasBackground: assets.background !== null,
			hasAlbumArt: scanned.albumArt !== null || assets.albumArt !== null,
			hasStems: Object.keys(assets.stems).length > 0,
			hasLyrics: notesData?.hasLyrics ?? notesData?.hasVocals ?? false,

			songLength: scanned.song_length ?? null,
			previewStart: scanned.preview_start_time ?? null,

			chorusId: null,
			folderHash,
			lastScanned: new Date().toISOString(),
		}
	}

	/**
	 * Detect assets in a chart folder (video, background, stems, etc.)
	 */
	private async detectAssets(folderPath: string): Promise<ChartAssets> {
		let entries: fs.Dirent[]
		try {
			entries = await fs.promises.readdir(folderPath, { withFileTypes: true })
		} catch {
			entries = []
		}

		const files = entries.filter(e => e.isFile()).map(e => e.name.toLowerCase())

		const findByPrefix = (prefix: string, extensions: string[]): string | null => {
			for (const ext of extensions) {
				const pattern = prefix + ext
				const found = files.find(f => f === pattern.toLowerCase())
				if (found) {
					const original = entries.find(e => e.name.toLowerCase() === found)
					return original ? path.join(folderPath, original.name) : null
				}
			}
			return null
		}

		const findFile = (patterns: string[]): string | null => {
			for (const pattern of patterns) {
				const found = files.find(f => f === pattern.toLowerCase())
				if (found) {
					const original = entries.find(e => e.name.toLowerCase() === found)
					return original ? path.join(folderPath, original.name) : null
				}
			}
			return null
		}

		// Detect stems
		const stems: ChartAssets['stems'] = {}
		for (const stem of STEM_NAMES) {
			const stemFile = findByPrefix(stem, AUDIO_EXTENSIONS)
			if (stemFile) {
				stems[stem as keyof typeof stems] = stemFile
			}
		}

		return {
			video: findByPrefix('video', VIDEO_EXTENSIONS),
			background: findByPrefix('background', IMAGE_EXTENSIONS),
			albumArt: findByPrefix('album', IMAGE_EXTENSIONS),
			stems,
			audio: findFile(['song.ogg', 'song.mp3', 'song.wav', 'guitar.ogg', 'guitar.mp3']),
			chart: findFile(['notes.chart', 'notes.mid']),
		}
	}

	/**
	 * Get asset information from files loaded from .sng
	 */
	private getAssetsFromSngFiles(files: { fileName: string; data: Uint8Array }[]): ChartAssets {
		const fileNames = files.map(f => f.fileName.toLowerCase())

		const findFile = (patterns: string[]): string | null => {
			for (const pattern of patterns) {
				if (fileNames.includes(pattern.toLowerCase())) {
					return pattern
				}
			}
			return null
		}

		const findByPrefix = (prefix: string, extensions: string[]): string | null => {
			for (const ext of extensions) {
				const pattern = prefix + ext
				if (fileNames.includes(pattern.toLowerCase())) {
					return pattern
				}
			}
			return null
		}

		const stems: ChartAssets['stems'] = {}
		for (const stem of STEM_NAMES) {
			const stemFile = findByPrefix(stem, AUDIO_EXTENSIONS)
			if (stemFile) {
				stems[stem as keyof typeof stems] = stemFile
			}
		}

		return {
			video: findByPrefix('video', VIDEO_EXTENSIONS),
			background: findByPrefix('background', IMAGE_EXTENSIONS),
			albumArt: findByPrefix('album', IMAGE_EXTENSIONS),
			stems,
			audio: findFile(['song.ogg', 'song.mp3', 'song.wav', 'guitar.ogg', 'guitar.mp3']),
			chart: findFile(['notes.chart', 'notes.mid']),
		}
	}

	/**
	 * Compute a hash of folder contents for change detection
	 * Uses file names, sizes, and modification times
	 */
	private async computeFolderHash(folderPath: string, files?: string[]): Promise<string> {
		const hash = crypto.createHash('md5')

		try {
			if (folderPath.toLowerCase().endsWith('.sng')) {
				// For .sng files, hash the file itself
				const stat = await fs.promises.stat(folderPath)
				hash.update(`${path.basename(folderPath)}:${stat.size}:${stat.mtimeMs}`)
			} else {
				// For folders, hash all files
				const entries = files
					? files.map(f => ({ name: f }))
					: (await fs.promises.readdir(folderPath, { withFileTypes: true }))
						.filter(e => e.isFile())

				const sortedFiles = entries.sort((a, b) => a.name.localeCompare(b.name))

				for (const file of sortedFiles) {
					const filePath = path.join(folderPath, file.name)
					try {
						const stat = await fs.promises.stat(filePath)
						hash.update(`${file.name}:${stat.size}:${stat.mtimeMs}`)
					} catch {
						hash.update(file.name)
					}
				}
			}
		} catch {
			hash.update(folderPath)
		}

		return hash.digest('hex')
	}

	/**
	 * Rescan a single chart (for manual refresh)
	 */
	async rescanChart(folderPath: string): Promise<ChartRecord | null> {
		const db = getCatalogDb()

		try {
			await fs.promises.access(folderPath)
		} catch {
			const existing = db.getChartByPath(folderPath)
			if (existing) {
				db.deleteChart(existing.id)
			}
			return null
		}

		const isSng = hasSngExtension(folderPath)
		let files: string[] = []

		if (!isSng) {
			const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })
			files = entries.filter(e => e.isFile()).map(e => e.name)
		}

		const chartFolder: ChartFolder = {
			path: folderPath,
			files,
			isSng,
		}

		const folderHash = await this.computeFolderHash(folderPath, files)
		const chart = await this.scanChartFolder(chartFolder, folderHash)
		const id = db.upsertChart(chart)
		return db.getChart(id)
	}

	/**
	 * Convert scan-chart Difficulty to our single-letter code
	 */
	private difficultyToCode(diff: Difficulty): string {
		switch (diff) {
			case 'easy': return 'e'
			case 'medium': return 'm'
			case 'hard': return 'h'
			case 'expert': return 'x'
			default: return ''
		}
	}

	/**
	 * Sort difficulty codes in standard order
	 */
	private sortDifficulties(diffs: string[]): string[] {
		const order = ['e', 'm', 'h', 'x']
		return [...new Set(diffs)].filter(d => d).sort((a, b) => order.indexOf(a) - order.indexOf(b))
	}

	/**
	 * Parse year from various formats
	 */
	private parseYear(year: string | number | undefined): number | null {
		if (year === undefined || year === null) return null
		if (typeof year === 'number') return Number.isFinite(year) ? year : null
		const parsed = parseInt(year, 10)
		return Number.isFinite(parsed) ? parsed : null
	}
}

// Singleton instance
let instance: ChartScanner | null = null

export function getChartScanner(): ChartScanner {
	if (!instance) {
		instance = new ChartScanner()
	}
	return instance
}
