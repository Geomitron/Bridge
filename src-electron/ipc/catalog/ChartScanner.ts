/**
 * Bridge Catalog Manager - Chart Scanner Service
 * Scans directories for Clone Hero/YARG charts and extracts metadata
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { EventEmitter } from 'eventemitter3'
import { ChartRecord, SongIniData, ChartAssets, ScanProgress, ScanResult } from '../../../src-shared/interfaces/catalog.interface.js'
import { getCatalogDb } from './CatalogDatabase.js'

// File patterns for chart detection
const CHART_FILES = ['notes.chart', 'notes.mid']
const AUDIO_FILES = ['song.ogg', 'song.mp3', 'song.wav', 'guitar.ogg', 'guitar.mp3']
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.webm', '.mkv', '.mov']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

interface ScannerEvents {
	progress: (progress: ScanProgress) => void
}

class ChartScanner extends EventEmitter<ScannerEvents> {
	private isScanning = false
	private shouldCancel = false

	/**
	 * Scan multiple library paths
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
			// Phase 1: Discover chart folders from all paths
			this.emit('progress', { phase: 'discovering', current: 0, total: 0, message: 'Discovering chart folders...' })

			const allChartFolders: string[] = []
			for (const libraryPath of libraryPaths) {
				if (this.shouldCancel) break

				try {
					await fs.promises.access(libraryPath)
					const folders = await this.discoverChartFolders(libraryPath)
					allChartFolders.push(...folders)
				} catch (err) {
					result.errors.push({
						path: libraryPath,
						error: `Cannot access folder: ${err instanceof Error ? err.message : String(err)}`,
					})
				}
			}

			if (this.shouldCancel) {
				return { ...result, duration: Date.now() - startTime }
			}

			// Phase 2: Scan each folder
			const existingPaths = db.getAllPaths()
			const scannedPaths = new Set<string>()
			const total = allChartFolders.length

			for (let i = 0; i < allChartFolders.length; i++) {
				if (this.shouldCancel) break

				const folderPath = allChartFolders[i]
				scannedPaths.add(folderPath)

				this.emit('progress', {
					phase: 'scanning',
					current: i + 1,
					total,
					currentPath: folderPath,
					message: `Scanning ${path.basename(folderPath)}`,
				})

				try {
					const chart = await this.scanChartFolder(folderPath)
					const isNew = !existingPaths.has(folderPath)

					db.upsertChart(chart)

					if (isNew) {
						result.added++
					} else {
						result.updated++
					}
				} catch (err) {
					result.errors.push({
						path: folderPath,
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}

			// Phase 3: Remove orphaned records
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
	}

	private async discoverChartFolders(rootPath: string): Promise<string[]> {
		const chartFolders: string[] = []

		const scanDir = async (dirPath: string, depth: number = 0): Promise<void> => {
			if (depth > 10 || this.shouldCancel) return

			let entries: fs.Dirent[]
			try {
				entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
			} catch {
				return
			}

			const hasChart = entries.some(e =>
				e.isFile() && CHART_FILES.includes(e.name.toLowerCase())
			)

			if (hasChart) {
				chartFolders.push(dirPath)
				return
			}

			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith('.')) {
					await scanDir(path.join(dirPath, entry.name), depth + 1)
				}
			}
		}

		await scanDir(rootPath)
		return chartFolders
	}

	private async scanChartFolder(folderPath: string): Promise<Omit<ChartRecord, 'id'>> {
		const songIni = await this.parseSongIni(folderPath)
		const assets = await this.detectAssets(folderPath)
		const folderHash = await this.computeFolderHash(folderPath)

		// Determine chart type from the chart file
		let chartType: 'mid' | 'chart' | 'sng' | null = null
		if (assets.chart) {
			const lower = assets.chart.toLowerCase()
			if (lower.endsWith('.mid')) chartType = 'mid'
			else if (lower.endsWith('.chart')) chartType = 'chart'
			else if (lower.endsWith('.sng')) chartType = 'sng'
		}

		// Check if this is from an official charter (Harmonix = Rock Band, Neversoft = Guitar Hero)
		// These always have all difficulties (EMHX)
		const charterName = (songIni.charter || songIni.frets || '').toLowerCase()
		const isOfficialCharter = charterName.includes('harmonix') ||
			charterName.includes('neversoft') ||
			charterName.includes('vicarious visions') ||
			charterName.includes('budcat') ||
			charterName.includes('freestyle games')

		// Detect if this is a GH3-style encrypted MIDI
		// GH3 charts have `icon = gh3` or `multiplier_note` in song.ini
		const isGH3Style = songIni.icon === 'gh3' ||
			songIni.multiplier_note !== undefined ||
			(songIni as any).gh3_unlock !== undefined ||
			isOfficialCharter

		// Parse chart file to detect available difficulty levels
		let diffLevels = await this.parseChartDifficulties(assets.chart, chartType)

		// For GH3-style encrypted MIDIs or official charters, if parsing returned minimal results but
		// we know instruments exist (from song.ini diff_ fields or track detection),
		// assume all standard difficulties (E/M/H/X) are available
		if (isGH3Style && chartType === 'mid') {
			diffLevels = await this.parseGH3MidiDifficulties(assets.chart, songIni, diffLevels)
		}

		// Get difficulties (null means not present, >= 0 means charted)
		const diff_guitar = songIni.diff_guitar ?? null
		const diff_bass = songIni.diff_bass ?? null
		const diff_drums = songIni.diff_drums ?? songIni.diff_drums_real ?? null
		const diff_keys = songIni.diff_keys ?? null
		const diff_vocals = songIni.diff_vocals ?? null
		const diff_rhythm = songIni.diff_rhythm ?? null
		const diff_guitarghl = songIni.diff_guitarghl ?? null
		const diff_bassghl = songIni.diff_bassghl ?? null

		// Determine which instruments are available based on parsed chart or song.ini
		const hasGuitar = diffLevels.guitar.length > 0 || (diff_guitar !== null && diff_guitar >= -1)
		const hasBass = diffLevels.bass.length > 0 || (diff_bass !== null && diff_bass >= -1)
		const hasDrums = diffLevels.drums.length > 0 || (diff_drums !== null && diff_drums >= -1)
		const hasKeys = diffLevels.keys.length > 0 || (diff_keys !== null && diff_keys >= -1)
		const hasVocals = diffLevels.vocals.length > 0 || (diff_vocals !== null && diff_vocals >= -1)
		const hasRhythm = diffLevels.rhythm.length > 0 || (diff_rhythm !== null && diff_rhythm >= -1)
		const hasGHL = diffLevels.ghlGuitar.length > 0 || diffLevels.ghlBass.length > 0 ||
			(diff_guitarghl !== null && diff_guitarghl >= -1) ||
			(diff_bassghl !== null && diff_bassghl >= -1)

		// For official charters, force all difficulties for any instrument that exists
		// These are always complete charts from the original games
		if (isOfficialCharter) {
			const allDiffs = ['e', 'm', 'h', 'x']
			if (hasGuitar) diffLevels.guitar = allDiffs
			if (hasBass) diffLevels.bass = allDiffs
			if (hasDrums) diffLevels.drums = allDiffs
			if (hasKeys) diffLevels.keys = allDiffs
			if (hasVocals) diffLevels.vocals = allDiffs
			if (hasRhythm) diffLevels.rhythm = allDiffs
			if (hasGHL) {
				diffLevels.ghlGuitar = allDiffs
				diffLevels.ghlBass = allDiffs
			}
		}

		return {
			path: folderPath,
			name: songIni.name || path.basename(folderPath),
			artist: songIni.artist || 'Unknown Artist',
			album: songIni.album || '',
			genre: songIni.genre || '',
			year: typeof songIni.year === 'number' ? songIni.year :
				typeof songIni.year === 'string' ? parseInt(songIni.year, 10) || null : null,
			charter: songIni.charter || songIni.frets || '',

			diff_guitar,
			diff_bass,
			diff_drums,
			diff_keys,
			diff_vocals,
			diff_rhythm,
			diff_guitarghl,
			diff_bassghl,

			hasGuitar,
			hasBass,
			hasDrums,
			hasKeys,
			hasVocals,
			hasRhythm,
			hasGHL,

			// Store difficulty levels as comma-separated strings
			guitarDiffs: diffLevels.guitar.join(','),
			bassDiffs: diffLevels.bass.join(','),
			drumsDiffs: diffLevels.drums.join(','),
			keysDiffs: diffLevels.keys.join(','),
			vocalsDiffs: diffLevels.vocals.join(','),
			rhythmDiffs: diffLevels.rhythm.join(','),
			ghlGuitarDiffs: diffLevels.ghlGuitar.join(','),
			ghlBassDiffs: diffLevels.ghlBass.join(','),

			chartType,

			hasVideo: assets.video !== null,
			hasBackground: assets.background !== null,
			hasAlbumArt: assets.albumArt !== null,
			hasStems: Object.keys(assets.stems).length > 0,
			hasLyrics: await this.detectLyrics(folderPath, assets.chart, chartType),

			songLength: songIni.song_length ?? null,
			previewStart: songIni.preview_start_time ?? null,

			chorusId: null,
			folderHash: folderHash,
			lastScanned: new Date().toISOString(),
		}
	}

	/**
	 * Parse chart file to detect available difficulty levels per instrument
	 */
	private async parseChartDifficulties(chartPath: string | null, chartType: 'mid' | 'chart' | 'sng' | null): Promise<{
		guitar: string[]
		bass: string[]
		drums: string[]
		keys: string[]
		vocals: string[]
		rhythm: string[]
		ghlGuitar: string[]
		ghlBass: string[]
	}> {
		const result = {
			guitar: [] as string[],
			bass: [] as string[],
			drums: [] as string[],
			keys: [] as string[],
			vocals: [] as string[],
			rhythm: [] as string[],
			ghlGuitar: [] as string[],
			ghlBass: [] as string[],
		}

		if (!chartPath) {
			return result
		}

		try {
			if (chartType === 'chart') {
				return await this.parseChartFileDifficulties(chartPath)
			} else if (chartType === 'mid') {
				return await this.parseMidiDifficulties(chartPath)
			}
		} catch (err) {
			// Failed to parse, return empty
			console.error('Failed to parse chart difficulties:', err)
		}

		return result
	}

	/**
	 * Parse .chart file for difficulty sections
	 */
	private async parseChartFileDifficulties(chartPath: string): Promise<{
		guitar: string[]
		bass: string[]
		drums: string[]
		keys: string[]
		vocals: string[]
		rhythm: string[]
		ghlGuitar: string[]
		ghlBass: string[]
	}> {
		const result = {
			guitar: [] as string[],
			bass: [] as string[],
			drums: [] as string[],
			keys: [] as string[],
			vocals: [] as string[],
			rhythm: [] as string[],
			ghlGuitar: [] as string[],
			ghlBass: [] as string[],
		}

		const content = await fs.promises.readFile(chartPath, 'utf-8')

		// .chart files have sections like [ExpertSingle], [HardSingle], etc.
		const sectionRegex = /\[(Easy|Medium|Hard|Expert)(Single|DoubleBass|DoubleRhythm|Drums|Keyboard|GHLGuitar|GHLBass)\]/gi

		let match
		while ((match = sectionRegex.exec(content)) !== null) {
			const diff = match[1].toLowerCase()
			const inst = match[2].toLowerCase()

			const diffCode = diff === 'easy' ? 'e' : diff === 'medium' ? 'm' : diff === 'hard' ? 'h' : 'x'

			switch (inst) {
				case 'single':
					if (!result.guitar.includes(diffCode)) result.guitar.push(diffCode)
					break
				case 'doublebass':
					if (!result.bass.includes(diffCode)) result.bass.push(diffCode)
					break
				case 'doublerhythm':
					if (!result.rhythm.includes(diffCode)) result.rhythm.push(diffCode)
					break
				case 'drums':
					if (!result.drums.includes(diffCode)) result.drums.push(diffCode)
					break
				case 'keyboard':
					if (!result.keys.includes(diffCode)) result.keys.push(diffCode)
					break
				case 'ghlguitar':
					if (!result.ghlGuitar.includes(diffCode)) result.ghlGuitar.push(diffCode)
					break
				case 'ghlbass':
					if (!result.ghlBass.includes(diffCode)) result.ghlBass.push(diffCode)
					break
			}
		}

		// Sort difficulty levels
		const sortDiffs = (arr: string[]) => {
			const order = ['e', 'm', 'h', 'x']
			return arr.sort((a, b) => order.indexOf(a) - order.indexOf(b))
		}

		result.guitar = sortDiffs(result.guitar)
		result.bass = sortDiffs(result.bass)
		result.drums = sortDiffs(result.drums)
		result.keys = sortDiffs(result.keys)
		result.rhythm = sortDiffs(result.rhythm)
		result.ghlGuitar = sortDiffs(result.ghlGuitar)
		result.ghlBass = sortDiffs(result.ghlBass)

		return result
	}

	/**
	 * Parse MIDI file for difficulty levels
	 * MIDI stores notes on tracks, with difficulty determined by note pitch:
	 * - Expert: 96-100 (and 96-100 for open notes on some tracks)
	 * - Hard: 84-88
	 * - Medium: 72-76
	 * - Easy: 60-64
	 * Drums use different ranges:
	 * - Expert: 96-100
	 * - Hard: 84-88
	 * - Medium: 72-76
	 * - Easy: 60-64
	 */
	private async parseMidiDifficulties(midiPath: string): Promise<{
		guitar: string[]
		bass: string[]
		drums: string[]
		keys: string[]
		vocals: string[]
		rhythm: string[]
		ghlGuitar: string[]
		ghlBass: string[]
	}> {
		const result = {
			guitar: [] as string[],
			bass: [] as string[],
			drums: [] as string[],
			keys: [] as string[],
			vocals: [] as string[],
			rhythm: [] as string[],
			ghlGuitar: [] as string[],
			ghlBass: [] as string[],
		}

		const buffer = await fs.promises.readFile(midiPath)

		// Simple MIDI parser - we just need to find track names and note ranges
		// MIDI format: chunks starting with 'MTrk'

		let pos = 0

		// Check MIDI header
		if (buffer.toString('ascii', 0, 4) !== 'MThd') {
			return result
		}

		// Skip header (MThd + length + format + tracks + division)
		pos = 14

		// Track name to instrument mapping
		const trackMap: { [key: string]: keyof typeof result } = {
			'part guitar': 'guitar',
			'part bass': 'bass',
			'part drums': 'drums',
			'part keys': 'keys',
			'part vocals': 'vocals',
			'part rhythm': 'rhythm',
			'part guitar ghl': 'ghlGuitar',
			'part bass ghl': 'ghlBass',
			't1 gems': 'guitar',  // Rock Band format
			'part real_guitar': 'guitar',
			'part real_bass': 'bass',
		}

		// Note ranges for each difficulty (standard 5-fret)
		const diffRanges = {
			'e': { min: 60, max: 64 },
			'm': { min: 72, max: 76 },
			'h': { min: 84, max: 88 },
			'x': { min: 96, max: 100 },
		}

		while (pos < buffer.length - 8) {
			// Look for track chunk
			if (buffer.toString('ascii', pos, pos + 4) !== 'MTrk') {
				pos++
				continue
			}

			pos += 4
			const trackLength = buffer.readUInt32BE(pos)
			pos += 4

			const trackEnd = pos + trackLength
			let currentTrackName = ''
			const notesFound = new Set<number>()

			// Parse track events
			while (pos < trackEnd && pos < buffer.length) {
				// Read variable-length delta time
				let delta = 0
				let byte
				do {
					byte = buffer[pos++]
					delta = (delta << 7) | (byte & 0x7f)
				} while (byte & 0x80 && pos < trackEnd)

				if (pos >= trackEnd) break

				const eventType = buffer[pos]

				// Meta event
				if (eventType === 0xff) {
					pos++
					const metaType = buffer[pos++]

					// Read length
					let length = 0
					do {
						byte = buffer[pos++]
						length = (length << 7) | (byte & 0x7f)
					} while (byte & 0x80 && pos < trackEnd)

					// Track name (meta type 0x03)
					if (metaType === 0x03 && length > 0) {
						currentTrackName = buffer.toString('ascii', pos, pos + length).toLowerCase().trim()
					}

					pos += length
				}
				// Note On (0x90-0x9F)
				else if ((eventType & 0xf0) === 0x90) {
					pos++
					const note = buffer[pos++]
					const velocity = buffer[pos++]

					if (velocity > 0) {
						notesFound.add(note)
					}
				}
				// Note Off (0x80-0x8F)
				else if ((eventType & 0xf0) === 0x80) {
					pos += 3
				}
				// Other channel events (2 data bytes)
				else if ((eventType & 0xf0) === 0xa0 || // Aftertouch
					(eventType & 0xf0) === 0xb0 || // Control Change
					(eventType & 0xf0) === 0xe0) { // Pitch Bend
					pos += 3
				}
				// Program Change, Channel Pressure (1 data byte)
				else if ((eventType & 0xf0) === 0xc0 ||
					(eventType & 0xf0) === 0xd0) {
					pos += 2
				}
				// SysEx
				else if (eventType === 0xf0 || eventType === 0xf7) {
					pos++
					let length = 0
					do {
						byte = buffer[pos++]
						length = (length << 7) | (byte & 0x7f)
					} while (byte & 0x80 && pos < trackEnd)
					pos += length
				}
				// Running status or unknown - try to skip
				else {
					pos++
				}
			}

			// Map track to instrument and check which difficulties have notes
			const instrument = trackMap[currentTrackName]
			if (instrument && notesFound.size > 0) {
				for (const [diff, range] of Object.entries(diffRanges)) {
					for (const note of notesFound) {
						if (note >= range.min && note <= range.max) {
							if (!result[instrument].includes(diff)) {
								result[instrument].push(diff)
							}
							break
						}
					}
				}
			}

			pos = trackEnd
		}

		// Sort difficulty levels
		const sortDiffs = (arr: string[]) => {
			const order = ['e', 'm', 'h', 'x']
			return arr.sort((a, b) => order.indexOf(a) - order.indexOf(b))
		}

		result.guitar = sortDiffs(result.guitar)
		result.bass = sortDiffs(result.bass)
		result.drums = sortDiffs(result.drums)
		result.keys = sortDiffs(result.keys)
		result.rhythm = sortDiffs(result.rhythm)
		result.ghlGuitar = sortDiffs(result.ghlGuitar)
		result.ghlBass = sortDiffs(result.ghlBass)

		return result
	}

	/**
	 * Handle GH3-style encrypted MIDI files and official charter charts
	 * These MIDIs can't be parsed normally, so we detect instruments from
	 * track names and assume all difficulties (E/M/H/X) are present
	 */
	private async parseGH3MidiDifficulties(
		midiPath: string | null,
		songIni: SongIniData,
		existingResult: {
			guitar: string[]
			bass: string[]
			drums: string[]
			keys: string[]
			vocals: string[]
			rhythm: string[]
			ghlGuitar: string[]
			ghlBass: string[]
		}
	): Promise<typeof existingResult> {
		const result = { ...existingResult }
		const allDiffs = ['e', 'm', 'h', 'x']

		// If we already parsed ALL difficulties for an instrument, keep those
		// But if we only found 1-2 difficulties, it's likely a parsing issue with encrypted MIDIs
		const hasCompleteParse =
			result.guitar.length >= 3 ||
			result.bass.length >= 3 ||
			result.drums.length >= 3 ||
			result.rhythm.length >= 3

		if (hasCompleteParse) {
			return result
		}

		// For GH3 MIDIs / official charters, detect which instrument tracks exist
		// and assume all difficulties are present
		if (midiPath) {
			try {
				const buffer = await fs.promises.readFile(midiPath)
				const trackNames = this.extractMidiTrackNames(buffer)

				for (const trackName of trackNames) {
					const lower = trackName.toLowerCase().trim()

					if (lower === 'part guitar' || lower === 't1 gems') {
						result.guitar = allDiffs
					} else if (lower === 'part bass') {
						result.bass = allDiffs
					} else if (lower === 'part drums') {
						result.drums = allDiffs
					} else if (lower === 'part keys') {
						result.keys = allDiffs
					} else if (lower === 'part vocals') {
						result.vocals = allDiffs
					} else if (lower === 'part rhythm') {
						result.rhythm = allDiffs
					} else if (lower === 'part guitar ghl') {
						result.ghlGuitar = allDiffs
					} else if (lower === 'part bass ghl') {
						result.ghlBass = allDiffs
					}
				}
			} catch (err) {
				// Failed to read, fall back to song.ini hints
			}
		}

		// Also use song.ini diff_ fields as hints for instruments we didn't detect from tracks
		// diff_* = -1 means "auto-detect" or "all difficulties present"
		if (songIni.diff_guitar !== undefined && songIni.diff_guitar >= -1 && result.guitar.length < 4) {
			result.guitar = allDiffs
		}
		if (songIni.diff_bass !== undefined && songIni.diff_bass >= -1 && result.bass.length < 4) {
			result.bass = allDiffs
		}
		if (songIni.diff_drums !== undefined && songIni.diff_drums >= -1 && result.drums.length < 4) {
			result.drums = allDiffs
		}
		if (songIni.diff_keys !== undefined && songIni.diff_keys >= -1 && result.keys.length < 4) {
			result.keys = allDiffs
		}
		if (songIni.diff_vocals !== undefined && songIni.diff_vocals >= -1 && result.vocals.length < 4) {
			result.vocals = allDiffs
		}
		if (songIni.diff_rhythm !== undefined && songIni.diff_rhythm >= -1 && result.rhythm.length < 4) {
			result.rhythm = allDiffs
		}

		return result
	}

	/**
	 * Extract track names from a MIDI file without fully parsing it
	 */
	private extractMidiTrackNames(buffer: Buffer): string[] {
		const trackNames: string[] = []
		let pos = 14 // Skip MIDI header

		while (pos < buffer.length - 8) {
			if (buffer.toString('ascii', pos, pos + 4) !== 'MTrk') {
				pos++
				continue
			}

			pos += 4
			const trackLength = buffer.readUInt32BE(pos)
			pos += 4
			const trackEnd = pos + trackLength

			// Look for track name meta event (FF 03)
			while (pos < trackEnd && pos < buffer.length - 4) {
				// Skip variable-length delta time
				let byte
				do {
					byte = buffer[pos++]
				} while (byte & 0x80 && pos < trackEnd)

				if (pos >= trackEnd) break

				const eventType = buffer[pos]

				if (eventType === 0xff) {
					pos++
					const metaType = buffer[pos++]

					// Read length
					let length = 0
					do {
						byte = buffer[pos++]
						length = (length << 7) | (byte & 0x7f)
					} while (byte & 0x80 && pos < trackEnd)

					// Track name (meta type 0x03)
					if (metaType === 0x03 && length > 0 && pos + length <= buffer.length) {
						const name = buffer.toString('ascii', pos, pos + length)
						trackNames.push(name)
					}

					pos += length

					// Found a track name, move to next track
					if (metaType === 0x03) break
				} else {
					// Skip other events - simplified, just move to next track
					break
				}
			}

			pos = trackEnd
		}

		return trackNames
	}

	private async parseSongIni(folderPath: string): Promise<SongIniData> {
		const iniPath = path.join(folderPath, 'song.ini')
		const data: SongIniData = {}

		try {
			const content = await fs.promises.readFile(iniPath, 'utf-8')
			const lines = content.split(/\r?\n/)

			for (const line of lines) {
				const trimmed = line.trim()

				if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('[')) {
					continue
				}

				const eqIndex = trimmed.indexOf('=')
				if (eqIndex === -1) continue

				const key = trimmed.substring(0, eqIndex).trim().toLowerCase()
				let value: string | number = trimmed.substring(eqIndex + 1).trim()

				if ((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1)
				}

				if (/^-?\d+$/.test(value)) {
					value = parseInt(value, 10)
				}

				data[key] = value
			}
		} catch {
			// song.ini might not exist
		}

		return data
	}

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
					return path.join(folderPath, entries.find(e => e.name.toLowerCase() === found)!.name)
				}
			}
			return null
		}

		const findFile = (patterns: string[]): string | null => {
			for (const pattern of patterns) {
				const found = files.find(f => f === pattern.toLowerCase())
				if (found) {
					return path.join(folderPath, entries.find(e => e.name.toLowerCase() === found)!.name)
				}
			}
			return null
		}

		// Detect stems
		const stems: ChartAssets['stems'] = {}
		const stemNames = ['guitar', 'bass', 'drums', 'vocals', 'keys', 'rhythm', 'crowd']
		for (const stem of stemNames) {
			const stemFile = findByPrefix(stem, ['.ogg', '.mp3', '.wav', '.opus'])
			if (stemFile) {
				stems[stem as keyof typeof stems] = stemFile
			}
		}

		return {
			video: findByPrefix('video', VIDEO_EXTENSIONS),
			background: findByPrefix('background', IMAGE_EXTENSIONS),
			albumArt: findByPrefix('album', IMAGE_EXTENSIONS),
			stems,
			audio: findFile(AUDIO_FILES),
			chart: findFile(CHART_FILES),
		}
	}

	private async computeFolderHash(folderPath: string): Promise<string> {
		const hash = crypto.createHash('md5')

		try {
			const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })
			const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))

			for (const file of files) {
				const filePath = path.join(folderPath, file.name)
				const stat = await fs.promises.stat(filePath)
				hash.update(`${file.name}:${stat.size}:${stat.mtimeMs}`)
			}
		} catch {
			hash.update(folderPath)
		}

		return hash.digest('hex')
	}

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

		const chart = await this.scanChartFolder(folderPath)
		const id = db.upsertChart(chart)
		return db.getChart(id)
	}

	/**
	 * Detect if a chart has lyrics
	 * Checks for:
	 * 1. lyrics.txt file in folder
	 * 2. lyric events in .chart files
	 * 3. PART VOCALS track with lyrics in .mid files
	 */
	private async detectLyrics(folderPath: string, chartPath: string | null, chartType: 'mid' | 'chart' | 'sng' | null): Promise<boolean> {
		// Check for lyrics.txt file
		try {
			const lyricsFile = path.join(folderPath, 'lyrics.txt')
			await fs.promises.access(lyricsFile)
			return true
		} catch {
			// No lyrics.txt
		}

		if (!chartPath) return false

		try {
			if (chartType === 'chart') {
				// Check for lyric events in .chart file
				const content = await fs.promises.readFile(chartPath, 'utf-8')
				// Look for lyric events like: = E "lyric text"
				return /=\s*E\s+"lyric\s/i.test(content)
			} else if (chartType === 'mid') {
				// Check for lyrics in MIDI - look for PART VOCALS track with lyric events
				const buffer = await fs.promises.readFile(chartPath)

				// Simple check - look for "PART VOCALS" and lyric meta event (0xFF 0x05)
				const hasVocalsTrack = buffer.includes(Buffer.from('PART VOCALS'))
				if (!hasVocalsTrack) return false

				// Look for lyric meta events (FF 05) in the file
				for (let i = 0; i < buffer.length - 2; i++) {
					if (buffer[i] === 0xFF && buffer[i + 1] === 0x05) {
						return true
					}
				}
			}
		} catch {
			// Failed to read chart file
		}

		return false
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
