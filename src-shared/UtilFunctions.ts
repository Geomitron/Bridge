import _ from 'lodash'
import sanitize from 'sanitize-filename'
import { Difficulty, Instrument } from 'scan-chart'

import { ChartData } from './interfaces/search.interface'

// WARNING: do not import anything related to Electron; the code will not compile correctly.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any) => any

/** Overwrites the type of a nested property in `T` with `U`. */
export type Overwrite<T, U> = U extends object ? (
	T extends object ? {
		[K in keyof T]: K extends keyof U ? Overwrite<T[K], U[K]> : T[K];
	} : U
) : U
export type RequireMatchingProps<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> }

/**
 * @returns `https://drive.google.com/open?id=${fileID}`
 */
export function driveLink(fileId: string) {
	return `https://drive.google.com/open?id=${fileId}`
}

/**
 * @returns `filename` with all invalid filename characters replaced.
 */
export function sanitizeFilename(filename: string): string {
	const newFilename = sanitize(filename, {
		replacement: ((invalidChar: string) => {
			switch (invalidChar) {
				case '<': return '❮'
				case '>': return '❯'
				case ':': return '꞉'
				case '"': return "'"
				case '/': return '／'
				case '\\': return '⧵'
				case '|': return '⏐'
				case '?': return '？'
				case '*': return '⁎'
				default: return '_'
			}
		}),
	})
	return (newFilename === '' ? 'TODO_MAKE_UNIQUE' : newFilename)
}

/**
 * @returns `text` converted to lower case.
 */
export function lower(text: string) {
	return text.toLowerCase()
}

/**
 * Converts `val` from the range (`fromStart`, `fromEnd`) to the range (`toStart`, `toEnd`).
 */
export function interpolate(val: number, fromStart: number, fromEnd: number, toStart: number, toEnd: number) {
	return ((val - fromStart) / (fromEnd - fromStart)) * (toEnd - toStart) + toStart
}

/**
 * @returns `objectList` split into multiple groups, where each group contains objects where every one of its values in `keys` matches.
 */
export function groupBy<T>(objectList: T[], ...keys: (keyof T)[]) {
	const results: T[][] = []
	for (const object of objectList) {
		const matchingGroup = results.find(result => keys.every(key => result[0][key] === object[key]))
		if (matchingGroup !== undefined) {
			matchingGroup.push(object)
		} else {
			results.push([object])
		}
	}

	return results
}

export const instruments = [
	'guitar', 'guitarcoop', 'rhythm', 'bass', 'drums', 'keys', 'guitarghl', 'guitarcoopghl', 'rhythmghl', 'bassghl',
] as const satisfies Readonly<Instrument[]>
export const difficulties = ['expert', 'hard', 'medium', 'easy'] as const satisfies Readonly<Difficulty[]>

export function instrumentDisplay(instrument: Instrument | null) {
	switch (instrument) {
		case 'guitar': return 'Lead Guitar'
		case 'guitarcoop': return 'Co-op Guitar'
		case 'rhythm': return 'Rhythm Guitar'
		case 'bass': return 'Bass Guitar'
		case 'drums': return 'Drums'
		case 'keys': return 'Keys'
		case 'guitarghl': return 'GHL (6-fret) Lead Guitar'
		case 'guitarcoopghl': return 'GHL (6-fret) Co-op Guitar'
		case 'rhythmghl': return 'GHL (6-fret) Rhythm Guitar'
		case 'bassghl': return 'GHL (6-fret) Bass Guitar'
		case null: return 'Any Instrument'
	}
}
export function shortInstrumentDisplay(instrument: Instrument | null) {
	switch (instrument) {
		case 'guitar': return 'Guitar'
		case 'guitarcoop': return 'Co-op'
		case 'rhythm': return 'Rhythm'
		case 'bass': return 'Bass'
		case 'drums': return 'Drums'
		case 'keys': return 'Keys'
		case 'guitarghl': return 'GHL Guitar'
		case 'guitarcoopghl': return 'GHL Co-op'
		case 'rhythmghl': return 'GHL Rhythm'
		case 'bassghl': return 'GHL Bass'
		case null: return 'Any Instrument'
	}
}
export function difficultyDisplay(difficulty: Difficulty | null) {
	switch (difficulty) {
		case 'expert': return 'Expert'
		case 'hard': return 'Hard'
		case 'medium': return 'Medium'
		case 'easy': return 'Easy'
		case null: return 'Any Difficulty'
	}
}
export function instrumentToDiff(instrument: Instrument | 'vocals') {
	switch (instrument) {
		case 'guitar': return 'diff_guitar'
		case 'guitarcoop': return 'diff_guitar_coop'
		case 'rhythm': return 'diff_rhythm'
		case 'bass': return 'diff_bass'
		case 'drums': return 'diff_drums'
		case 'keys': return 'diff_keys'
		case 'guitarghl': return 'diff_guitarghl'
		case 'guitarcoopghl': return 'diff_guitar_coop_ghl'
		case 'rhythmghl': return 'diff_rhythm_ghl'
		case 'bassghl': return 'diff_bassghl'
		case 'vocals': return 'diff_vocals'
	}
}

/**
 * @returns a string representation of `ms` that looks like HH:MM:SS
 */
export function msToRoughTime(ms: number) {
	const seconds = _.round((ms / 1000) % 60)
	const minutes = Math.floor((ms / 1000 / 60) % 60)
	const hours = Math.floor((ms / 1000 / 60 / 60) % 24)
	return `${hours ? `${hours}:` : ''}${minutes}:${_.padStart(String(seconds), 2, '0')}`
}

const allowedTags = [
	'align', 'allcaps', 'alpha', 'b', 'br', 'color', 'cspace', 'font', 'font-weight',
	'gradient', 'i', 'indent', 'line-height', 'line-indent', 'link', 'lowercase',
	'margin', 'mark', 'mspace', 'nobr', 'noparse', 'page', 'pos', 'rotate', 's',
	'size', 'smallcaps', 'space', 'sprite', 'strikethrough', 'style', 'sub', 'sup',
	'u', 'uppercase', 'voffset', 'width',
]
const tagPattern = allowedTags.map(tag => `\\b${tag}\\b`).join('|')
/**
 * @returns `text` with all style tags removed. (e.g. "<color=#AEFFFF>Aren Eternal</color> & Geo" -> "Aren Eternal & Geo")
 */
export function removeStyleTags(text: string) {
	let oldText = text
	let newText = text
	do {
		oldText = newText
		newText = newText.replace(new RegExp(`<\\s*\\/?\\s*(?:${tagPattern})[^>]*>`, 'gi'), '').trim()
	} while (newText !== oldText)
	return newText
}

export function hasIssues(chart: Pick<ChartData, 'metadataIssues' | 'folderIssues' | 'notesData'>) {
	if (chart.metadataIssues.length > 0) { return true }
	for (const folderIssue of chart.folderIssues) {
		if (!['albumArtSize', 'invalidIni', 'multipleVideo', 'badIniLine'].includes(folderIssue.folderIssue)) { return true }
	}
	for (const chartIssue of chart.notesData?.chartIssues ?? []) {
		if (chartIssue !== 'isDefaultBPM') { return true }
	}
	for (const trackIssue of chart.notesData?.trackIssues ?? []) {
		for (const ti of trackIssue.trackIssues) {
			if (ti !== 'noNotesOnNonemptyTrack') { return true }
		}
	}
	for (const noteIssue of chart.notesData?.noteIssues ?? []) {
		for (const ni of noteIssue.noteIssues) {
			if (ni.issueType !== 'babySustain') { return true }
		}
	}

	return false
}
