import _ from 'lodash'
import { Difficulty, Instrument } from 'scan-chart'

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

function generateSectionFromExpert({
	instrument,
	difficulty,
	expertSectionLines,
	resolution,
	bpmForMs,
	tsForMs,
}: {
	instrument: Instrument
	difficulty: Difficulty
	expertSectionLines: string[]
	resolution: number
	bpmForMs: BPM[]
	tsForMs: TimeSignature[]
}
): string[] {
	const generatedLines: string[] = []
	const notesByMs = new Map<number, string[]>()

	for (const line of expertSectionLines) {
		if (!line.includes('=')) continue
		const [ms, value] = line.split('=').map(s => s.trim())
		const msNum = parseInt(ms)
		notesByMs.set(msNum, [...(notesByMs.get(msNum) || []), value])
	}

	let prevMs = 0

	for (const [ms, lines] of notesByMs) {
		const notes = lines.filter(line => line.startsWith('N '))

		for (const nonNoteLine of lines) {
			if (notes.includes(nonNoteLine)) continue
			generatedLines.push(`${ms} = ${nonNoteLine}`)
		}

		const generatedNotes = instrument === 'drums'
			? notesToDiffDrums({ difficulty, ms, notes, resolution, msDeltaAround: ms - prevMs, tsForMs, bpmForMs })
			: notesToDiffSingle({ difficulty, ms, notes, resolution, msDeltaAround: ms - prevMs, tsForMs })

		for (const generatedNote of generatedNotes) {
			prevMs = ms
			generatedLines.push(`${ms} = ${generatedNote}`)
		}
	}

	return generatedLines
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

function generateSection({
	sections,
	instrument,
	difficulty,
}: {
	sections: { [key: string]: string[] }
	instrument: Instrument
	difficulty: Difficulty
}): {
	newSection: { [key: string]: string[] }
} {
	const { resolution } = parseSongPart({ partLines: sections['Song'] })
	const { bpmForMs, tsForMs } = parseSyncTrackPart({ partLines: sections['SyncTrack'] })

	const expertSection = sections[instrumentToSectionName({ instrument, difficulty: 'expert' })]

	const newSection = {
		[instrumentToSectionName({ instrument, difficulty })]: generateSectionFromExpert({
			instrument,
			difficulty,
			expertSectionLines: expertSection,
			resolution,
			bpmForMs,
			tsForMs,
		}),
	}

	return { newSection }
}

function instrumentToSectionName({ instrument, difficulty }: { instrument: Instrument; difficulty: Difficulty }): string {
	switch (instrument) {
		case 'guitar':
			return `${_.capitalize(difficulty)}Single`
		case 'guitarcoop':
			return `${_.capitalize(difficulty)}DoubleGuitar`
		case 'rhythm':
			return `${_.capitalize(difficulty)}DoubleRhythm`
		case 'bass':
			return `${_.capitalize(difficulty)}DoubleBass`
		case 'drums':
			return `${_.capitalize(difficulty)}Drums`
		case 'keys':
			return `${_.capitalize(difficulty)}Keyboard`
		case 'guitarghl':
			return `${_.capitalize(difficulty)}GHLGuitar`
		case 'guitarcoopghl':
			return `${_.capitalize(difficulty)}GHLCoop`
		case 'rhythmghl':
			return `${_.capitalize(difficulty)}GHLRhythm`
		case 'bassghl':
			return `${_.capitalize(difficulty)}GHLBass`
		default:
			throw new Error(`Unknown instrument: ${instrument}`)
	}
}

function serializeSections({ sections }: { sections: { [key: string]: string[] } }): string {
	return Object.entries(sections).flatMap(([key, lines]) => {
		return [
			`[${key}]`,
			'{',
			...lines.map(line => `  ${line}`),
			'}',
		].join('\n')
	}).join('\n')
}

function getChartSections(chartText: string) {
	const sections: { [sectionName: string]: string[] } = {}
	let skipLine = false
	let readStartIndex = 0
	let readingSection = false
	let thisSection: string | null = null
	for (let i = 0; i < chartText.length; i++) {
		if (readingSection) {
			if (chartText[i] === ']') {
				readingSection = false
				thisSection = chartText.slice(readStartIndex, i)
			}
			if (chartText[i] === '\n') {
				throw `Invalid .chart file: unexpected new line when parsing section at index ${i}`
			}
			continue // Keep reading section until it ends
		}

		if (chartText[i] === '=') {
			skipLine = true
		} // Skip all user-entered values
		if (chartText[i] === '\n') {
			skipLine = false
		}
		if (skipLine) {
			continue
		} // Keep skipping until '\n' is found

		if (chartText[i] === '{') {
			skipLine = true
			readStartIndex = i + 1
		} else if (chartText[i] === '}') {
			if (!thisSection) {
				throw `Invalid .chart file: end of section reached before a section name was found at index ${i}`
			}
			// Trim each line because of Windows \r\n shenanigans
			sections[thisSection] = chartText
				.slice(readStartIndex, i)
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.length)
		} else if (chartText[i] === '[') {
			readStartIndex = i + 1
			readingSection = true
		}
	}

	return { sections }
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
	const { sections } = getChartSections(content)
	const { newSection } = generateSection({ sections, difficulty, instrument })
	return serializeSections({ sections: { ...sections, ...newSection } })
}

