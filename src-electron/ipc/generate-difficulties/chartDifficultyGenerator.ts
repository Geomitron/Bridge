import { exists, move } from 'fs-extra'
import { difficulties, Difficulty, Instrument, parseChartFile } from 'scan-chart'

import { hasChartExtension } from '../../../src-shared/UtilFunctions.js'

type ParsedChart = ReturnType<typeof parseChartFile>


interface TimeSignature {
	ts: number
	ms: number
}

interface BPM {
	bpm: number
	ms: number
}

function getTsForMs({ ms, tsForMs }: { ms: number; tsForMs: TimeSignature[] }): TimeSignature | undefined {
	ms = Math.floor(ms)
	let prevRet: TimeSignature | undefined
	for (const { ts, ms: lineMs } of tsForMs) {
		if (prevRet && lineMs > ms) return prevRet
		prevRet = { ts, ms: lineMs }
	}
	return prevRet
}

function getBpmForMs({ ms, bpmForMs }: { ms: number; bpmForMs: BPM[] }): BPM | undefined {
	ms = Math.floor(ms)
	let prevRet: BPM | undefined
	for (const { bpm, ms: lineMs } of bpmForMs) {
		if (prevRet && lineMs > ms) return prevRet
		prevRet = { bpm, ms: lineMs }
	}
	return prevRet
}

function getEffectiveBpm({ ms, bpmForMs }: { ms: number; bpmForMs: BPM[] }): number {
	const bpmData = getBpmForMs({ ms, bpmForMs })
	if (!bpmData) return 0
	return bpmData.bpm
}

function handleSyncTrack({ syncTrack }: { syncTrack: string[][] }): { bpmForMs: BPM[]; tsForMs: TimeSignature[] } {
	const bpmForMs: BPM[] = []
	const tsForMs: TimeSignature[] = []

	for (const [lineMs, line] of syncTrack) {
		const ms = parseInt(lineMs)
		if (line.includes('B ')) {
			const bpm = parseInt(line.replace('B ', '').trim()) / 1000.0
			bpmForMs.push({ bpm, ms })
		}
		if (line.includes('TS ')) {
			const ts = parseInt(line.replace('TS ', '').trim().split(' ')[0])
			tsForMs.push({ ts, ms })
		}
	}

	return { bpmForMs, tsForMs }
}

function getBeat({ milliseconds, resolution, tsForMs }: { milliseconds: number; resolution: number; tsForMs: TimeSignature[] }): number {
	const tsData = getTsForMs({ ms: milliseconds, tsForMs })
	if (!tsData) return 0
	const ts = tsData.ts
	const deltaMs = milliseconds - tsData.ms
	const beat = deltaMs / resolution
	return beat % ts
}

function notesToDiffSingle({
	difficulty,
	ms,
	notes,
	resolution,
	msDeltaAround = 0,
	tsForMs,
}: {
	difficulty: string
	ms: number
	notes: string[]
	resolution: number
	msDeltaAround: number
	tsForMs: TimeSignature[]
}
): string[] {
	const ret: string[] = []
	const beatNumber = getBeat({ milliseconds: ms, resolution, tsForMs })
	let onBeat = Math.floor(beatNumber) === beatNumber && beatNumber % 2 === 0
	const offBeat = Math.floor(beatNumber) === beatNumber && beatNumber % 2 === 1

	if (difficulty === 'easy') {
		if (msDeltaAround > resolution * 3) {
			if (!offBeat) onBeat = true
		}

		if (!onBeat) return ret
		for (const note of notes.slice(0, 1)) {
			const [, color, length] = note.split(' ')
			let newColor = color
			if (color === '4') newColor = '0'
			else if (color === '3') newColor = '1'
			else if (color === '7') newColor = '0'
			ret.push(`N ${newColor} ${length}`)
		}
		return ret
	}

	if (difficulty === 'medium') {
		if (msDeltaAround > resolution * 2) {
			if (!offBeat) onBeat = true
		}

		if (!onBeat && !offBeat) return ret
		for (const note of notes.slice(0, 2)) {
			const [, color, length] = note.split(' ')
			let newColor = color
			if (color === '4') newColor = '0'
			else if (color === '7') newColor = '0'
			ret.push(`N ${newColor} ${length}`)
		}
		return ret
	}

	if (difficulty === 'hard') {
		if (msDeltaAround >= resolution) {
			if (!offBeat) onBeat = true
		}

		if (Math.floor(beatNumber * 2) === beatNumber * 2) {
			onBeat = true
		}

		if (!onBeat && !offBeat) return ret
		return notes
	}

	return ret
}

function notesToDiffDrums({
	difficulty,
	ms,
	notes,
	resolution,
	msDeltaAround = 0,
	tsForMs,
	bpmForMs,
}: {
	difficulty: string
	ms: number
	notes: string[]
	resolution: number
	msDeltaAround: number
	tsForMs: TimeSignature[]
	bpmForMs: BPM[]
}
): string[] {
	const ret: string[] = []
	const beatNumber = getBeat({ milliseconds: ms, resolution, tsForMs })
	let onBeat = Math.floor(beatNumber) === beatNumber && beatNumber % 2 === 0
	const offBeat = Math.floor(beatNumber) === beatNumber && beatNumber % 2 === 1

	if (difficulty === 'easy') {
		if (msDeltaAround > resolution * 3) {
			if (!offBeat) onBeat = true
		}

		if (onBeat) {
			for (const note of notes) {
				const [, color, length] = note.split(' ')
				if (color === '0' && beatNumber === 0) {
					ret.push(`N ${color} ${length}`)
					break
				}
			}
			if (ret.length === 0) {
				for (const note of notes) {
					const [, color, length] = note.split(' ')
					if (['3', '4'].includes(color)) {
						ret.push(`N 2 ${length}`)
						break
					}
				}
			}
		}
		return ret
	}

	if (difficulty === 'medium') {
		if (msDeltaAround > resolution * 2) {
			if (!offBeat) onBeat = true
		}
		if (!onBeat && !offBeat) return []

		if (getEffectiveBpm({ ms, bpmForMs }) > 150) {
			if (onBeat && beatNumber !== 0) return ret
		}

		if (onBeat) {
			for (const note of notes) {
				const [, color, length] = note.split(' ')
				if (color === '0' && beatNumber === 0) {
					ret.push(`N ${color} ${length}`)
					break
				}
			}
			if (ret.length === 0) {
				for (const note of notes) {
					const [, color, length] = note.split(' ')
					if (color === '4') {
						ret.push(`N 3 ${length}`)
						break
					}
				}
			}
		} else if (offBeat) {
			for (const note of notes.slice(0, 2)) {
				const [, color, length] = note.split(' ')
				if (color !== '0') {
					if (color === '4') {
						ret.push(`N 3 ${length}`)
					} else {
						ret.push(`N ${color} ${length}`)
					}
				}
			}
		}
		return ret
	}

	if (difficulty === 'hard') {
		if (msDeltaAround > resolution) {
			if (!offBeat) onBeat = true
		}

		if (onBeat) {
			for (const note of notes) {
				const [, color, length] = note.split(' ')
				if (color === '0') {
					ret.push(`N ${color} ${length}`)
					break
				}
			}
			for (const note of notes) {
				const [, color, length] = note.split(' ')
				if (color === '0') continue
				ret.push(`N ${color} ${length}`)
				break
			}
		} else if (offBeat) {
			for (const note of notes.slice(0, 2)) {
				const [, color, length] = note.split(' ')
				if (notes.length > 2 && color === '0') continue
				ret.push(`N ${color} ${length}`)
			}
		}
		return ret
	}

	return ret
}

function parseExpertPart({
	part,
	partLines,
	difficulty,
	resolution,
	bpmForMs,
	tsForMs,
}: {
	part: string
	partLines: string[]
	difficulty: Difficulty
	resolution: number
	bpmForMs: BPM[]
	tsForMs: TimeSignature[]
}
): { newParts: { [key: string]: string[] } } {
	const difficultyLines: { [key: string]: string[] } = {}
	const notesByMs: { [key: number]: string[] } = {}
	const newParts: { [key: string]: string[] } = {}

	for (const line of partLines) {
		if (!line.includes('=')) continue
		const [ms, value] = line.split('=').map(s => s.trim())
		const msNum = parseInt(ms)
		notesByMs[msNum] = notesByMs[msNum] || []
		notesByMs[msNum].push(value)
	}

	const prevMsByDiff: { [key: string]: number } = {}

	for (const [ms, lines] of Object.entries(notesByMs)) {
		const notes = lines.filter(line => line.startsWith('N '))
		const msNum = parseInt(ms)

		prevMsByDiff[difficulty] = prevMsByDiff[difficulty] || 0
		for (const nonNoteLine of lines) {
			if (notes.includes(nonNoteLine)) continue
			difficultyLines[difficulty] = difficultyLines[difficulty] || []
			difficultyLines[difficulty].push(`${ms} = ${nonNoteLine}`)
		}

		const generatedNotes = part.includes('Drums')
			? notesToDiffDrums({ difficulty, ms: msNum, notes, resolution, msDeltaAround: msNum - prevMsByDiff[difficulty], tsForMs, bpmForMs })
			: notesToDiffSingle({ difficulty, ms: msNum, notes, resolution, msDeltaAround: msNum - prevMsByDiff[difficulty], tsForMs })

		for (const easyNote of generatedNotes) {
			prevMsByDiff[difficulty] = msNum
			difficultyLines[difficulty] = difficultyLines[difficulty] || []
			difficultyLines[difficulty].push(`${ms} = ${easyNote}`)
		}
	}

	const easyPart = part.replace('Expert', difficulty.charAt(0).toUpperCase() + difficulty.slice(1))

	newParts[easyPart] = ['{', ...(difficultyLines[difficulty] || []), '}']

	return { newParts }
}

function parseSyncTrackPart({ partLines }: { partLines: string[] }): { bpmForMs: BPM[]; tsForMs: TimeSignature[] } {
	const syncTrack = partLines
		.filter(line => line.includes('='))
		.map(line => {
			const [key, value] = line.split('=').map(s => s.trim())
			return [key, value]
		})
	return handleSyncTrack({ syncTrack })
}

function parseSongPart({ partLines }: { partLines: string[] }): { resolution: number } {
	let resolution = 0
	for (const line of partLines) {
		if (!line.includes('=')) continue
		const [key, value] = line.split('=').map(s => s.trim())
		if (key === 'Resolution') {
			resolution = parseInt(value)
		}
	}
	return { resolution }
}

function parseFile({
	content,
	// instrument,
	difficulty,
}: {
	content: string
	instrument: Instrument
	difficulty: Difficulty
}): {
	newParts: { [key: string]: string[] }
	parsedLines: string[]
} {
	const originalLines = content.split('\n').map(line => line.trim().replace('\ufeff', ''))
	const parsedLines: string[] = []

	let part: string | null = null
	let partLines: string[] = []
	let resolution = 0
	let bpmForMs: BPM[] = []
	let tsForMs: TimeSignature[] = []
	let newParts: { [key: string]: string[] } = {}

	for (const line of originalLines) {
		const trimmedLine = line.trim()
		parsedLines.push(trimmedLine)

		if (trimmedLine.includes('[Song]')) {
			part = '[Song]'
			continue
		}
		if (trimmedLine.includes('[SyncTrack]')) {
			part = '[SyncTrack]'
			continue
		}
		if (trimmedLine === '}') {
			if (part) {
				if (part === '[Song]') {
					const songPart = parseSongPart({ partLines })
					resolution = songPart.resolution
				}
				if (part === '[SyncTrack]') {
					const syncTrack = parseSyncTrackPart({ partLines })
					bpmForMs = syncTrack.bpmForMs
					tsForMs = syncTrack.tsForMs
				}
				part = null
				partLines = []
			}
		}

		if (part) partLines.push(trimmedLine)
	}

	part = null
	partLines = []

	for (const line of parsedLines) {
		const trimmedLine = line.trim()
		if (/^\[\w*\]$/.test(trimmedLine)) {
			part = trimmedLine
			continue
		}
		if (trimmedLine === '}') {
			if (part) {
				if (part.includes('[Expert')) {
					const expertPart = parseExpertPart({ part, partLines, difficulty, resolution, bpmForMs, tsForMs })
					newParts = { ...newParts, ...expertPart.newParts }
				}
				part = null
				partLines = []
			}
		}

		if (part) partLines.push(trimmedLine)
	}

	return { newParts, parsedLines }
}



function getGeneratedContent({ newParts, parsedLines }: { newParts: { [key: string]: string[] }; parsedLines: string[] }): string {
	const newLines: string[] = []
	const parts: { [key: string]: string[] } = {}
	let part: string | null = null

	for (const line of parsedLines) {
		const trimmedLine = line.trim()
		if (!line.includes('=') && /^.*\[.*\].*$/.test(trimmedLine)) {
			part = trimmedLine
			parts[part] = parts[part] || []
			parts[part].push(trimmedLine)
			continue
		} else if (!part) {
			continue
		}

		if (trimmedLine === '}') {
			if (part) {
				parts[part].push(trimmedLine)
				part = null
				continue
			}
		}

		if (part) {
			parts[part] = parts[part] || []
			parts[part].push(trimmedLine)
		}
	}

	const addedParts: string[] = []
	for (const [partName, lines] of Object.entries(parts)) {
		addedParts.push(partName)
		newLines.push(...lines)
	}

	for (const [partName, lines] of Object.entries(newParts)) {
		if (partName in parts) continue
		if (addedParts.includes(partName)) continue
		addedParts.push(partName)
		newLines.push(partName)
		newLines.push(...lines)
	}

	const linesByMode = {
		start: [] as string[],
		middle: [] as string[],
		end: [] as string[],
	}

	let mode: 'start' | 'middle' | 'end' = 'start'

	for (const line of newLines) {
		const startsWithNumber = /^\d+/.test(line.trim())
		if (startsWithNumber) {
			if (mode === 'start') mode = 'middle'
		} else {
			if (mode === 'middle') mode = 'end'
		}
		linesByMode[mode].push(line)
	}

	const sortedLines = [
		...linesByMode.start,
		...linesByMode.middle.sort((a, b) => parseInt(a.split(' ')[0]) - parseInt(b.split(' ')[0])),
		...linesByMode.end,
	]

	return sortedLines.join('\n')
}

export function generateDifficulty({
	content,
	instrument,
	difficulty,
}: {
	content: string
	instrument: Instrument
	difficulty: Difficulty
}): string {
	const { newParts, parsedLines } = parseFile({ content, difficulty, instrument })
	return getGeneratedContent({ newParts, parsedLines })
}

export const getChartMissingDifficultiesByInstrument = ({ chart }: { chart: ParsedChart }) => {
	const missingDifficultiesByInstrument = new Map<Instrument, Difficulty[]>()

	for (const track of chart.trackData) {
		missingDifficultiesByInstrument.set(
			track.instrument,
			(missingDifficultiesByInstrument.get(track.instrument) || difficulties).filter(difficulty => difficulty !== track.difficulty)
		)

		if (missingDifficultiesByInstrument.get(track.instrument)?.length === 0) {
			missingDifficultiesByInstrument.delete(track.instrument)
		}
	}

	return missingDifficultiesByInstrument
}

export const createChartBackup = async ({ chartFileType, chartFilePath }: { chartFileType: string; chartFilePath: string }) => {
	// Backup the original chart data
	if (!hasChartExtension(chartFilePath)) {
		throw new Error(`Unsupported chart type: ${chartFileType}`)
	}

	const backupPath = chartFilePath.replace(`.${chartFileType}`, `.${chartFileType}.original`)
	const backupExists = await exists(backupPath)
	if (!backupExists) {
		await move(chartFilePath, backupPath)
	}
}
