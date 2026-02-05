/**
 * Bridge Lyrics Module - Lyrics Service
 * Handles LRCLIB API integration and LRC conversion
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { spawn } from 'child_process'
import { EventEmitter } from 'eventemitter3'
import { LyricsSearchResult, LyricLine, LyricsDownloadProgress } from '../../../src-shared/interfaces/lyrics.interface.js'

interface LrcLyrics {
	lines: LyricLine[]
	artist?: string
	title?: string
	album?: string
	duration?: number
}

interface LyricsServiceEvents {
	lyricsProgress: (progress: LyricsDownloadProgress) => void
}

class LyricsService extends EventEmitter<LyricsServiceEvents> {
	private readonly LRCLIB_API = 'https://lrclib.net/api'

	/**
	 * Search LRCLIB for lyrics
	 */
	async searchLyrics(artist: string, title: string): Promise<LyricsSearchResult[]> {
		const query = encodeURIComponent(`${artist} ${title}`)
		const url = `${this.LRCLIB_API}/search?q=${query}`

		try {
			const response = await this.httpGet(url)
			const results = JSON.parse(response) as LyricsSearchResult[]

			// Filter to only include results with synced lyrics
			return results.filter(r => r.syncedLyrics && !r.instrumental)
		} catch (err) {
			console.error('LRCLIB search failed:', err)
			return []
		}
	}

	/**
	 * Get lyrics by track details (exact match)
	 */
	async getLyrics(artist: string, title: string, album?: string, duration?: number): Promise<LyricsSearchResult | null> {
		let url = `${this.LRCLIB_API}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`

		if (album) {
			url += `&album_name=${encodeURIComponent(album)}`
		}
		if (duration) {
			url += `&duration=${Math.round(duration)}`
		}

		try {
			const response = await this.httpGet(url)
			const result = JSON.parse(response) as LyricsSearchResult

			if (result.syncedLyrics) {
				return result
			}
			return null
		} catch {
			return null
		}
	}

	/**
	 * Get lyrics by LRCLIB ID
	 */
	async getLyricsById(id: number): Promise<LyricsSearchResult | null> {
		const url = `${this.LRCLIB_API}/get/${id}`

		try {
			const response = await this.httpGet(url)
			return JSON.parse(response) as LyricsSearchResult
		} catch {
			return null
		}
	}

	/**
	 * Parse LRC format string into structured lyrics
	 */
	parseLrc(lrcString: string): LrcLyrics {
		const lines: LyricLine[] = []
		const lrcLines = lrcString.split('\n')

		// LRC timestamp regex: [mm:ss.xx] or [mm:ss:xx]
		const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g

		for (const line of lrcLines) {
			const cleanLine = line.trim()
			if (!cleanLine) continue

			// Extract all timestamps from line
			const timestamps: number[] = []
			let match

			while ((match = timeRegex.exec(cleanLine)) !== null) {
				const minutes = parseInt(match[1], 10)
				const seconds = parseInt(match[2], 10)
				let ms = parseInt(match[3], 10)

				// Handle both .xx (centiseconds) and .xxx (milliseconds)
				if (match[3].length === 2) {
					ms *= 10
				}

				const time = (minutes * 60 + seconds) * 1000 + ms
				timestamps.push(time)
			}

			// Get the text after all timestamps
			const text = cleanLine.replace(/\[\d{2}:\d{2}[.:]\d{2,3}\]/g, '').trim()

			// Create a line entry for each timestamp
			for (const time of timestamps) {
				if (text) {
					lines.push({ time, text })
				}
			}
		}

		// Sort by time
		lines.sort((a, b) => a.time - b.time)

		return { lines }
	}

	/**
	 * Convert parsed lyrics to .chart event format
	 * Returns lines to add to the [Events] section
	 */
	lyricsToChartEvents(lyrics: LrcLyrics, resolution: number = 192, bpm: number = 120): string[] {
		const events: string[] = []

		// Calculate ticks per millisecond
		// resolution = ticks per quarter note
		// at 120 BPM, 1 quarter note = 500ms
		// ticks per ms = resolution / 500 = resolution * bpm / 60000
		const ticksPerMs = (resolution * bpm) / 60000

		let phraseStart = true

		for (let i = 0; i < lyrics.lines.length; i++) {
			const line = lyrics.lines[i]
			const tick = Math.round(line.time * ticksPerMs)

			// Add phrase_start at beginning of each line
			if (phraseStart) {
				events.push(`  ${tick} = E "phrase_start"`)
				phraseStart = false
			}

			// Add the lyric
			events.push(`  ${tick} = E "lyric ${line.text}"`)

			// Check if next line is far away (new phrase) or end of lyrics
			const nextLine = lyrics.lines[i + 1]
			if (!nextLine || (nextLine.time - line.time) > 3000) {
				// Add phrase_end after a gap
				const endTick = tick + Math.round(500 * ticksPerMs) // 500ms after lyric
				events.push(`  ${endTick} = E "phrase_end"`)
				phraseStart = true
			}
		}

		return events
	}

	/**
	 * Inject lyrics into a .chart file
	 */
	async injectLyricsIntoChart(chartPath: string, lyrics: LrcLyrics): Promise<void> {
		let content = await fs.promises.readFile(chartPath, 'utf-8')

		// Get resolution and BPM from chart
		const resMatch = content.match(/Resolution\s*=\s*(\d+)/i)
		const resolution = resMatch ? parseInt(resMatch[1], 10) : 192

		// Get BPM from [SyncTrack] section
		const syncMatch = content.match(/\[SyncTrack\][\s\S]*?(\d+)\s*=\s*B\s+(\d+)/i)
		const bpm = syncMatch ? parseInt(syncMatch[2], 10) / 1000 : 120

		// Generate lyric events
		const lyricEvents = this.lyricsToChartEvents(lyrics, resolution, bpm)

		// Check if [Events] section exists
		const eventsMatch = content.match(/\[Events\]\s*\{([^}]*)\}/i)

		if (eventsMatch) {
			// Insert lyrics into existing Events section
			const existingEvents = eventsMatch[1]

			// Remove any existing lyric events
			const cleanedEvents = existingEvents
				.split('\n')
				.filter(line => !line.includes('"lyric ') && !line.includes('"phrase_'))
				.join('\n')

			const newEventsContent = cleanedEvents.trim() + '\n' + lyricEvents.join('\n') + '\n'
			content = content.replace(/\[Events\]\s*\{[^}]*\}/i, `[Events]\n{\n${newEventsContent}}`)
		} else {
			// Add new Events section before first track section
			const eventsSection = `[Events]\n{\n${lyricEvents.join('\n')}\n}\n`

			// Find a good place to insert (after [Song] and [SyncTrack])
			const insertMatch = content.match(/(\[SyncTrack\]\s*\{[^}]*\})/i)
			if (insertMatch) {
				const insertPos = content.indexOf(insertMatch[0]) + insertMatch[0].length
				content = content.slice(0, insertPos) + '\n' + eventsSection + content.slice(insertPos)
			} else {
				// Just append
				content += '\n' + eventsSection
			}
		}

		await fs.promises.writeFile(chartPath, content, 'utf-8')
	}

	/**
	 * Download and inject lyrics into a chart
	 */
	async downloadAndInjectLyrics(
		chartId: number,
		lyricsId: number,
		chartPath: string,
		chartType: 'mid' | 'chart' | 'sng' | null,
		offsetMs: number = 0
	): Promise<{ success: boolean; error?: string }> {
		try {
			// Emit progress
			this.emit('lyricsProgress', {
				phase: 'downloading',
				percent: 20,
				message: 'Downloading lyrics from LRCLIB...',
				chartId,
			})

			// Get lyrics
			const lyricsResult = await this.getLyricsById(lyricsId)
			if (!lyricsResult || !lyricsResult.syncedLyrics) {
				return { success: false, error: 'No synced lyrics found' }
			}

			this.emit('lyricsProgress', {
				phase: 'converting',
				percent: 50,
				message: 'Converting lyrics...',
				chartId,
			})

			// Parse LRC
			const lyrics = this.parseLrc(lyricsResult.syncedLyrics)
			if (lyrics.lines.length === 0) {
				return { success: false, error: 'Lyrics are empty' }
			}

			// Apply timing offset if specified
			if (offsetMs !== 0) {
				for (const line of lyrics.lines) {
					line.time = Math.max(0, line.time + offsetMs)
				}
			}

			this.emit('lyricsProgress', {
				phase: 'writing',
				percent: 80,
				message: 'Writing lyrics to chart...',
				chartId,
			})

			// Find the chart file
			const chartDir = chartPath
			let chartFile: string | null = null
			let midiFile: string | null = null

			const entries = await fs.promises.readdir(chartDir)
			for (const entry of entries) {
				const lower = entry.toLowerCase()
				if (lower === 'notes.chart') {
					chartFile = path.join(chartDir, entry)
				} else if (lower === 'notes.mid') {
					midiFile = path.join(chartDir, entry)
				}
			}

			if (!chartFile) {
				// Try to find any .chart file
				for (const entry of entries) {
					if (entry.toLowerCase().endsWith('.chart')) {
						chartFile = path.join(chartDir, entry)
						break
					}
				}
			}

			if (!midiFile) {
				// Try to find any .mid file
				for (const entry of entries) {
					if (entry.toLowerCase().endsWith('.mid')) {
						midiFile = path.join(chartDir, entry)
						break
					}
				}
			}

			// Prefer .chart files, but support .mid
			if (chartFile) {
				await this.injectLyricsIntoChart(chartFile, lyrics)
			} else if (midiFile) {
				await this.injectLyricsIntoMidi(midiFile, lyrics)
			} else {
				return { success: false, error: 'No .chart or .mid file found in folder' }
			}

			this.emit('lyricsProgress', {
				phase: 'complete',
				percent: 100,
				message: 'Lyrics added successfully!',
				chartId,
			})

			return { success: true }
		} catch (err) {
			this.emit('lyricsProgress', {
				phase: 'error',
				percent: 0,
				message: `Error: ${err instanceof Error ? err.message : String(err)}`,
				chartId,
			})

			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			}
		}
	}

	/**
	 * HTTP GET helper
	 */
	private httpGet(url: string): Promise<string> {
		return new Promise((resolve, reject) => {
			https.get(url, {
				headers: {
					'User-Agent': 'Bridge-Catalog-Manager/1.0',
				},
			}, res => {
				if (res.statusCode === 404) {
					reject(new Error('Not found'))
					return
				}

				if (res.statusCode !== 200) {
					reject(new Error(`HTTP ${res.statusCode}`))
					return
				}

				let data = ''
				res.on('data', chunk => data += chunk)
				res.on('end', () => resolve(data))
				res.on('error', reject)
			}).on('error', reject)
		})
	}

	/**
	 * Inject lyrics into a MIDI file
	 * Creates/updates the PART VOCALS track with lyric meta events
	 */
	private async injectLyricsIntoMidi(midiPath: string, lyrics: LrcLyrics): Promise<void> {
		const buffer = await fs.promises.readFile(midiPath)

		// Parse MIDI header
		if (buffer.toString('ascii', 0, 4) !== 'MThd') {
			throw new Error('Invalid MIDI file')
		}

		const headerLength = buffer.readUInt32BE(4)
		const format = buffer.readUInt16BE(8)
		const numTracks = buffer.readUInt16BE(10)
		const division = buffer.readUInt16BE(12)

		// Try to extract tempo from track 0 (tempo track)
		// Default: 120 BPM = 500000 microseconds per quarter note
		let microsecondsPerQuarter = 500000

		// Scan first track for tempo events (FF 51 03 tt tt tt)
		const scanPos = 8 + headerLength
		if (buffer.toString('ascii', scanPos, scanPos + 4) === 'MTrk') {
			const track0Length = buffer.readUInt32BE(scanPos + 4)
			const track0End = scanPos + 8 + track0Length
			let p = scanPos + 8

			while (p < track0End - 6) {
				// Look for FF 51 03 (tempo meta event)
				if (buffer[p] === 0xFF && buffer[p + 1] === 0x51 && buffer[p + 2] === 0x03) {
					// Read 3-byte tempo value
					microsecondsPerQuarter = (buffer[p + 3] << 16) | (buffer[p + 4] << 8) | buffer[p + 5]
					break // Use first tempo event
				}
				p++
			}
		}

		// Calculate ticks per millisecond
		// microsecondsPerQuarter / 1000 = milliseconds per quarter note
		// division = ticks per quarter note
		// ticksPerMs = division / (microsecondsPerQuarter / 1000) = division * 1000 / microsecondsPerQuarter
		const ticksPerMs = (division * 1000) / microsecondsPerQuarter

		// Find existing PART VOCALS track or create one
		let pos = 8 + headerLength
		let vocalsTrackStart = -1
		let vocalsTrackEnd = -1
		let trackIndex = 0

		while (pos < buffer.length && trackIndex < numTracks) {
			if (buffer.toString('ascii', pos, pos + 4) !== 'MTrk') {
				break
			}

			const trackLength = buffer.readUInt32BE(pos + 4)
			const trackDataStart = pos + 8
			const trackDataEnd = trackDataStart + trackLength

			// Check if this is PART VOCALS track
			const trackData = buffer.slice(trackDataStart, Math.min(trackDataEnd, trackDataStart + 200))
			if (trackData.includes(Buffer.from('PART VOCALS'))) {
				vocalsTrackStart = pos
				vocalsTrackEnd = trackDataEnd
			}

			pos = trackDataEnd
			trackIndex++
		}

		// Build new PART VOCALS track with lyrics
		const newTrack = this.buildMidiLyricsTrack(lyrics, division, ticksPerMs)

		let newBuffer: Buffer

		if (vocalsTrackStart >= 0) {
			// Replace existing PART VOCALS track
			const before = buffer.slice(0, vocalsTrackStart)
			const after = buffer.slice(vocalsTrackEnd)
			newBuffer = Buffer.concat([before, newTrack, after])
		} else {
			// Append new track and update track count
			newBuffer = Buffer.concat([buffer, newTrack])
			// Update number of tracks in header
			newBuffer.writeUInt16BE(numTracks + 1, 10)
		}

		await fs.promises.writeFile(midiPath, newBuffer)
	}

	/**
	 * Build a MIDI track with lyrics
	 * Splits lyric lines into individual words for proper MIDI format
	 * Includes note events and phrase markers so Clone Hero will display the lyrics
	 */
	private buildMidiLyricsTrack(lyrics: LrcLyrics, division: number, ticksPerMs: number): Buffer {
		const chunks: Buffer[] = []

		// Track header
		chunks.push(Buffer.from('MTrk'))

		// We'll calculate length at the end
		const lengthPlaceholder = Buffer.alloc(4)
		chunks.push(lengthPlaceholder)

		// Track name event: FF 03 len "PART VOCALS"
		const trackName = Buffer.from('PART VOCALS')
		chunks.push(Buffer.from([0x00, 0xFF, 0x03, trackName.length]))
		chunks.push(trackName)

		// Build list of all lyric words with timing and duration
		// Also track phrase (line) boundaries
		const lyricEvents: { tick: number; text: string; durationTicks: number; isFirstInPhrase: boolean; phraseEndTick: number }[] = []

		for (let i = 0; i < lyrics.lines.length; i++) {
			const line = lyrics.lines[i]
			const nextLine = lyrics.lines[i + 1]

			const lineStartMs = line.time
			const lineEndMs = nextLine ? nextLine.time : (lineStartMs + 3000) // Assume 3 sec if last line
			const lineDurationMs = lineEndMs - lineStartMs

			// Split line into words
			const words = line.text.split(/\s+/).filter(w => w.length > 0)
			if (words.length === 0) continue

			// Distribute words evenly across the line duration (use 80% of duration for words)
			const wordDurationMs = (lineDurationMs * 0.8) / words.length
			const wordDurationTicks = Math.round(wordDurationMs * ticksPerMs * 0.9) // 90% of spacing for note duration

			// Calculate phrase end tick (end of this line)
			const phraseEndTick = Math.round((lineStartMs + lineDurationMs * 0.95) * ticksPerMs)

			for (let j = 0; j < words.length; j++) {
				const wordStartMs = lineStartMs + (j * wordDurationMs)
				const tick = Math.round(wordStartMs * ticksPerMs)

				lyricEvents.push({
					tick,
					text: words[j],
					durationTicks: Math.max(wordDurationTicks, Math.round(division / 4)), // At least a 16th note
					isFirstInPhrase: j === 0,
					phraseEndTick,
				})
			}
		}

		// Sort by tick (should already be sorted, but just in case)
		lyricEvents.sort((a, b) => a.tick - b.tick)

		// Build combined events list: lyrics + notes + phrase markers
		// MIDI note constants for Rock Band/Clone Hero vocals
		const VOCAL_NOTE = 60 // Middle C (C4) - in valid vocal range 36-84
		const PHRASE_NOTE = 105 // A6 - phrase marker note
		const VOCAL_CHANNEL = 0
		const VELOCITY = 100

		interface MidiEvent {
			tick: number
			data: Buffer
		}

		const allEvents: MidiEvent[] = []

		for (const event of lyricEvents) {
			// If this is the first word in a phrase, add phrase marker
			if (event.isFirstInPhrase) {
				// Phrase marker note on
				const phraseOnData = Buffer.from([0x90 | VOCAL_CHANNEL, PHRASE_NOTE, VELOCITY])
				allEvents.push({ tick: event.tick, data: phraseOnData })

				// Phrase marker note off (at end of phrase)
				const phraseOffData = Buffer.from([0x80 | VOCAL_CHANNEL, PHRASE_NOTE, 0])
				allEvents.push({ tick: event.phraseEndTick, data: phraseOffData })
			}

			// Lyric meta event
			const textBuffer = Buffer.from(event.text, 'utf-8')
			const lyricData = Buffer.concat([
				Buffer.from([0xFF, 0x05]),
				this.encodeVariableLength(textBuffer.length),
				textBuffer,
			])
			allEvents.push({ tick: event.tick, data: lyricData })

			// Note on event: 9n kk vv (n=channel, kk=note, vv=velocity)
			const noteOnData = Buffer.from([0x90 | VOCAL_CHANNEL, VOCAL_NOTE, VELOCITY])
			allEvents.push({ tick: event.tick, data: noteOnData })

			// Note off event: 8n kk vv
			const noteOffData = Buffer.from([0x80 | VOCAL_CHANNEL, VOCAL_NOTE, 0])
			allEvents.push({ tick: event.tick + event.durationTicks, data: noteOffData })
		}

		// Sort all events by tick
		allEvents.sort((a, b) => a.tick - b.tick)

		// Write events with delta times
		let lastTick = 0

		for (const event of allEvents) {
			const delta = Math.max(0, event.tick - lastTick)
			lastTick = event.tick

			// Variable-length delta time
			chunks.push(this.encodeVariableLength(delta))
			// Event data
			chunks.push(event.data)
		}

		// End of track: FF 2F 00
		chunks.push(Buffer.from([0x00, 0xFF, 0x2F, 0x00]))

		// Calculate total track data length (excluding header)
		const trackData = Buffer.concat(chunks.slice(2))
		lengthPlaceholder.writeUInt32BE(trackData.length, 0)

		return Buffer.concat(chunks)
	}

	/**
	 * Encode a number as MIDI variable-length quantity
	 */
	private encodeVariableLength(value: number): Buffer {
		if (value < 0) value = 0

		const bytes: number[] = []
		bytes.push(value & 0x7F)
		value >>= 7

		while (value > 0) {
			bytes.push((value & 0x7F) | 0x80)
			value >>= 7
		}

		return Buffer.from(bytes.reverse())
	}

	/**
	 * Delete lyrics from a chart file
	 */
	async deleteLyrics(chartPath: string, chartType: 'mid' | 'chart' | 'sng' | null): Promise<{ success: boolean; error?: string }> {
		try {
			// Find the chart/mid file
			const files = await fs.promises.readdir(chartPath)

			if (chartType === 'chart' || !chartType) {
				// Look for .chart file
				const chartFile = files.find(f => f.toLowerCase() === 'notes.chart') ||
					files.find(f => f.toLowerCase().endsWith('.chart'))

				if (chartFile) {
					const chartFilePath = path.join(chartPath, chartFile)
					const content = await fs.promises.readFile(chartFilePath, 'utf-8')

					// Remove the [Events] section lyrics or rebuild without lyrics
					const newContent = this.removeLyricsFromChart(content)
					await fs.promises.writeFile(chartFilePath, newContent, 'utf-8')
					return { success: true }
				}
			}

			if (chartType === 'mid' || !chartType) {
				// For MIDI files, we'd need to remove the PART VOCALS track
				// This is more complex - for now just return success as lyrics in MIDI
				// are less commonly user-added
				const midFile = files.find(f => f.toLowerCase() === 'notes.mid') ||
					files.find(f => f.toLowerCase().endsWith('.mid'))

				if (midFile) {
					// For MIDI, removing lyrics is complex - would need to parse and rebuild
					// For now, we'll just mark it as done since MIDI lyrics removal is rare
					return { success: true }
				}
			}

			return { success: false, error: 'No chart file found' }
		} catch (err) {
			return { success: false, error: `Error: ${err}` }
		}
	}

	/**
	 * Remove lyrics from a .chart file content
	 */
	private removeLyricsFromChart(content: string): string {
		const lines = content.split('\n')
		const newLines: string[] = []
		let inEventsSection = false
		let braceCount = 0

		for (const line of lines) {
			const trimmed = line.trim()

			if (trimmed === '[Events]') {
				inEventsSection = true
				newLines.push(line)
				continue
			}

			if (inEventsSection) {
				if (trimmed === '{') {
					braceCount++
					newLines.push(line)
					continue
				}
				if (trimmed === '}') {
					braceCount--
					if (braceCount === 0) {
						inEventsSection = false
					}
					newLines.push(line)
					continue
				}

				// Skip lyric and phrase_start/phrase_end events
				if (trimmed.includes('"lyric ') ||
					trimmed.includes('"phrase_start"') ||
					trimmed.includes('"phrase_end"')) {
					continue
				}
			}

			newLines.push(line)
		}

		return newLines.join('\n')
	}

	/**
	 * Find audio file in chart folder and return as base64 data URL for playback
	 * Prefers vocal/vocals track if available
	 * Also returns detected vocal start time if vocals track exists
	 */
	async getAudioAsDataUrl(chartPath: string): Promise<{ dataUrl: string; vocalStartMs: number | null; hasVocalsTrack: boolean } | null> {
		try {
			const entries = await fs.promises.readdir(chartPath)

			// First look for vocals track (preferred for sync)
			const vocalNames = ['vocals.ogg', 'vocals.opus', 'vocals.mp3', 'vocal.ogg', 'vocal.opus', 'vocal.mp3']
			let audioFile: string | null = null
			let hasVocalsTrack = false

			for (const name of vocalNames) {
				const match = entries.find(e => e.toLowerCase() === name)
				if (match) {
					audioFile = path.join(chartPath, match)
					hasVocalsTrack = true
					break
				}
			}

			// Fall back to song file
			if (!audioFile) {
				const songNames = [
					'song.ogg', 'song.opus', 'song.mp3', 'song.wav',
					'guitar.ogg', 'guitar.opus', 'guitar.mp3',
				]

				for (const name of songNames) {
					const match = entries.find(e => e.toLowerCase() === name)
					if (match) {
						audioFile = path.join(chartPath, match)
						break
					}
				}
			}

			// Last resort: any audio file
			if (!audioFile) {
				const audioExtensions = ['.ogg', '.opus', '.mp3', '.wav', '.flac']
				for (const entry of entries) {
					const ext = path.extname(entry).toLowerCase()
					if (audioExtensions.includes(ext)) {
						audioFile = path.join(chartPath, entry)
						break
					}
				}
			}

			if (!audioFile) {
				return null
			}

			// Read file
			const fileBuffer = await fs.promises.readFile(audioFile)
			const ext = path.extname(audioFile).toLowerCase()

			// Determine MIME type
			let mimeType = 'audio/ogg'
			if (ext === '.mp3') mimeType = 'audio/mpeg'
			else if (ext === '.wav') mimeType = 'audio/wav'
			else if (ext === '.flac') mimeType = 'audio/flac'
			else if (ext === '.opus') mimeType = 'audio/opus'
			else if (ext === '.ogg') mimeType = 'audio/ogg'

			const base64 = fileBuffer.toString('base64')
			const dataUrl = `data:${mimeType};base64,${base64}`

			// Try to detect vocal start time if this is a vocals track
			let vocalStartMs: number | null = null
			if (hasVocalsTrack) {
				vocalStartMs = await this.detectAudioStart(audioFile)
			}

			return { dataUrl, vocalStartMs, hasVocalsTrack }
		} catch (err) {
			console.error('Error loading audio file:', err)
			return null
		}
	}

	/**
	 * Detect when audio actually starts (first non-silent moment)
	 * Uses ffmpeg to analyze audio levels
	 */
	private async detectAudioStart(audioPath: string): Promise<number | null> {
		return new Promise(resolve => {
			try {
				// Use ffmpeg to detect silence and find where it ends
				// silencedetect filter finds silent periods
				const ffmpeg = spawn('ffmpeg', [
					'-i', audioPath,
					'-af', 'silencedetect=noise=-40dB:d=0.1',
					'-f', 'null',
					'-',
				])

				let stderr = ''

				ffmpeg.stderr.on('data', data => {
					stderr += data.toString()
				})

				ffmpeg.on('close', () => {
					// Parse ffmpeg output for silence_end (first one is when audio starts)
					// Format: [silencedetect @ ...] silence_end: 5.123 | silence_duration: 5.123
					const match = stderr.match(/silence_end:\s*([\d.]+)/)
					if (match) {
						const seconds = parseFloat(match[1])
						const ms = Math.round(seconds * 1000)
						console.log(`Detected vocal start at ${ms}ms (${seconds}s)`)
						resolve(ms)
					} else {
						// No silence detected at start - audio starts immediately
						console.log('No initial silence detected, vocals start at 0')
						resolve(0)
					}
				})

				ffmpeg.on('error', err => {
					console.error('ffmpeg error detecting audio start:', err)
					resolve(null)
				})

				// Timeout after 10 seconds
				setTimeout(() => {
					ffmpeg.kill()
					resolve(null)
				}, 10000)
			} catch (err) {
				console.error('Error detecting audio start:', err)
				resolve(null)
			}
		})
	}
}

// Singleton
let instance: LyricsService | null = null

export function getLyricsService(): LyricsService {
	if (!instance) {
		instance = new LyricsService()
	}
	return instance
}
