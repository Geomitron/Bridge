import { interpolate as culoriInterpolate, oklch, wcagContrast } from 'culori'
import _ from 'lodash'
import sanitize from 'sanitize-filename'
import { Difficulty, Instrument } from 'scan-chart'

import { ChartData } from './interfaces/search.interface'
import { ThemeColors } from './interfaces/theme.interface'

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
export const drumTypeNames = ['fourLane', 'fourLanePro', 'fiveLane'] as const
export type DrumTypeName = typeof drumTypeNames[number]

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
export function drumTypeDisplay(drumType: DrumTypeName | null) {
	switch (drumType) {
		case 'fourLane': return 'Four Lane'
		case 'fourLanePro': return 'Four Lane Pro'
		case 'fiveLane': return 'Five Lane'
		case null: return 'Any Drum Type'
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
	const seconds = _.floor((ms / 1000) % 60)
	const minutes = _.floor((ms / 1000 / 60) % 60)
	const hours = _.floor((ms / 1000 / 60 / 60) % 24)
	return `${hours ? `${hours}:` : ''}${minutes}:${_.padStart(String(seconds), 2, '0')}`
}

const allowedTags = [
	'align', 'allcaps', 'alpha', 'b', 'br', 'color', 'cspace', 'font', 'font-weight',
	'gradient', 'i', 'indent', 'line-height', 'line-indent', 'link', 'lowercase',
	'margin', 'mark', 'mspace', 'nobr', 'noparse', 'page', 'pos', 'rotate', 's',
	'size', 'smallcaps', 'space', 'sprite', 'strikethrough', 'style', 'sub', 'sup',
	'u', 'uppercase', 'voffset', 'width', '#',
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
	for (const metadataIssue of chart.metadataIssues) {
		if (!['extraValue'].includes(metadataIssue.metadataIssue)) {
			return true
		}
	}
	for (const folderIssue of chart.folderIssues) {
		if (!['albumArtSize', 'invalidIni', 'multipleVideo', 'badIniLine'].includes(folderIssue.folderIssue)) {
			return true
		}
	}
	for (const chartIssue of chart.notesData?.chartIssues ?? []) {
		if (!['isDefaultBPM', 'badEndEvent', 'emptyStarPower', 'emptySoloSection', 'emptyFlexLane', 'babySustain']
			.includes(chartIssue.noteIssue)) {
			return true
		}
	}

	return false
}

/**
 * @returns extension of a file, excluding the dot. (e.g. "song.ogg" -> "ogg")
 */
export function getExtension(fileName: string) {
	return _.last(fileName.split('.')) ?? ''
}

/**
 * @returns basename of a file, excluding the dot. (e.g. "song.ogg" -> "song")
 */
export function getBasename(fileName: string) {
	const parts = fileName.split('.')
	return parts.length > 1 ? parts.slice(0, -1).join('.') : fileName
}
/**
 * @returns `true` if `fileName` is a valid video fileName.
 */
export function hasVideoName(fileName: string) {
	return getBasename(fileName) === 'video' && ['mp4', 'avi', 'webm', 'vp8', 'ogv', 'mpeg'].includes(getExtension(fileName))
}

/**
 * @returns `true` if `fileName` has a valid chart file extension.
 */
export function hasChartExtension(fileName: string) {
	return ['chart', 'mid'].includes(getExtension(fileName).toLowerCase())
}

/**
 * @returns `true` if `fileName` is a valid chart fileName.
 */
export function hasChartName(fileName: string) {
	return ['notes.chart', 'notes.mid'].includes(fileName)
}

/**
 * @returns `true` if `fileName` has a valid chart audio file extension.
 */
export function hasAudioExtension(fileName: string) {
	return ['ogg', 'mp3', 'wav', 'opus'].includes(getExtension(fileName).toLowerCase())
}

/**
 * @returns `true` if `fileName` has a valid chart audio fileName.
 */
export function hasAudioName(fileName: string) {
	return (
		[
			'song',
			'guitar',
			'bass',
			'rhythm',
			'keys',
			'vocals',
			'vocals_1',
			'vocals_2',
			'drums',
			'drums_1',
			'drums_2',
			'drums_3',
			'drums_4',
			'crowd',
			'preview',
		].includes(getBasename(fileName)) && ['ogg', 'mp3', 'wav', 'opus'].includes(getExtension(fileName))
	)
}

export function resolveChartFolderName(
	chartFolderName: string,
	chart: { name: string; artist: string; album: string; genre: string; year: string; charter: string },
) {
	if (_.sumBy(chartFolderName.split('/'), n => n.length) === 0) {
		chartFolderName = '{artist} - {name} ({charter})'
	}
	const pathParts = chartFolderName.split('/')
	const resolvedPathParts: string[] = []
	for (const pathPart of pathParts) {
		const resolvedPath = sanitizeNonemptyFilename(pathPart
			.replace(/\{name\}/g, chart.name)
			.replace(/\{artist\}/g, chart.artist)
			.replace(/\{album\}/g, chart.album)
			.replace(/\{genre\}/g, chart.genre)
			.replace(/\{year\}/g, chart.year)
			.replace(/\{charter\}/g, chart.charter))

		if (resolvedPath.length > 0) {
			resolvedPathParts.push(resolvedPath)
		}
	}
	return resolvedPathParts.join('/')
}

/**
 * @returns `filename` with all invalid filename characters replaced. Assumes `filename` has at least one valid filename character already.
 */
export function sanitizeNonemptyFilename(filename: string) {
	return sanitize(filename, {
		replacement: (invalidChar: string) => {
			switch (invalidChar) {
				case '<':
					return '❮'
				case '>':
					return '❯'
				case ':':
					return '꞉'
				case '"':
					return "'"
				case '/':
					return '／'
				case '\\':
					return '⧵'
				case '|':
					return '⏐'
				case '?':
					return '？'
				case '*':
					return '⁎'
				default:
					return '_'
			}
		},
	})
}

/* eslint-disable @typescript-eslint/naming-convention */
export const colorNames = {
	"primary": "--p",
	"primary-content": "--pc",

	"secondary": "--s",
	"secondary-content": "--sc",

	"accent": "--a",
	"accent-content": "--ac",

	"neutral": "--n",
	"neutral-content": "--nc",

	"base-100": "--b1",
	"base-200": "--b2",
	"base-300": "--b3",
	"base-content": "--bc",

	"info": "--in",
	"info-content": "--inc",

	"success": "--su",
	"success-content": "--suc",

	"warning": "--wa",
	"warning-content": "--wac",

	"error": "--er",
	"error-content": "--erc",
} as { [colorName: string]: string }
const defaultVariables = {
	"--rounded-box": "1rem",
	"--rounded-btn": "0.5rem",
	"--rounded-badge": "1.9rem",
	"--animation-btn": "0.25s",
	"--animation-input": ".2s",
	"--btn-focus-scale": "0.95",
	"--border-btn": "1px",
	"--tab-border": "1px",
	"--tab-radius": "0.5rem",
}
/* eslint-enable @typescript-eslint/naming-convention */

export function convertColorFormat(input: ThemeColors) {
	if (typeof input !== "object" || input === null) {
		return input
	}

	const resultObj: { [cssKey: string]: string } = {}

	for (const [rule, value] of Object.entries(input)) {
		if (Object.hasOwn(colorNames, rule)) {
			const colorObj = oklch(value)
			resultObj[colorNames[rule]] = colorObjToString(colorObj!)
		} else {
			resultObj[rule] = value
		}

		// auto generate base colors
		if (!Object.hasOwn(input, "base-100")) {
			resultObj["--b1"] = "100% 0 0"
		}
		if (!Object.hasOwn(input, "base-200")) {
			resultObj["--b2"] = generateDarkenColorFrom(input["base-100"], 0.07)
		}
		if (!Object.hasOwn(input, "base-300")) {
			if (Object.hasOwn(input, "base-200")) {
				resultObj["--b3"] = generateDarkenColorFrom(input["base-200"], 0.07)
			} else {
				resultObj["--b3"] = generateDarkenColorFrom(input["base-100"], 0.14)
			}
		}

		// auto generate state colors
		if (!Object.hasOwn(input, "info")) {
			resultObj["--in"] = "72.06% 0.191 231.6"
		}
		if (!Object.hasOwn(input, "success")) {
			resultObj["--su"] = "64.8% 0.150 160"
		}
		if (!Object.hasOwn(input, "warning")) {
			resultObj["--wa"] = "84.71% 0.199 83.87"
		}
		if (!Object.hasOwn(input, "error")) {
			resultObj["--er"] = "71.76% 0.221 22.18"
		}

		// auto generate content colors
		if (!Object.hasOwn(input, "base-content")) {
			resultObj["--bc"] = generateForegroundColorFrom(input["base-100"], 0.8)
		}
		if (!Object.hasOwn(input, "primary-content")) {
			resultObj["--pc"] = generateForegroundColorFrom(input.primary, 0.8)
		}
		if (!Object.hasOwn(input, "secondary-content")) {
			resultObj["--sc"] = generateForegroundColorFrom(input.secondary, 0.8)
		}
		if (!Object.hasOwn(input, "accent-content")) {
			resultObj["--ac"] = generateForegroundColorFrom(input.accent, 0.8)
		}
		if (!Object.hasOwn(input, "neutral-content")) {
			resultObj["--nc"] = generateForegroundColorFrom(input.neutral, 0.8)
		}
		if (!Object.hasOwn(input, "info-content")) {
			if (Object.hasOwn(input, "info")) {
				resultObj["--inc"] = generateForegroundColorFrom(input.info, 0.8)
			} else {
				resultObj["--inc"] = "0% 0 0"
			}
		}
		if (!Object.hasOwn(input, "success-content")) {
			if (Object.hasOwn(input, "success")) {
				resultObj["--suc"] = generateForegroundColorFrom(input.success, 0.8)
			} else {
				resultObj["--suc"] = "0% 0 0"
			}
		}
		if (!Object.hasOwn(input, "warning-content")) {
			if (Object.hasOwn(input, "warning")) {
				resultObj["--wac"] = generateForegroundColorFrom(input.warning, 0.8)
			} else {
				resultObj["--wac"] = "0% 0 0"
			}
		}
		if (!Object.hasOwn(input, "error-content")) {
			if (Object.hasOwn(input, "error")) {
				resultObj["--erc"] = generateForegroundColorFrom(input.error, 0.8)
			} else {
				resultObj["--erc"] = "0% 0 0"
			}
		}

		// add css variables if not exist
		for (const item of Object.entries(defaultVariables)) {
			const [variable, value] = item
			if (!Object.hasOwn(input, variable)) {
				resultObj[variable] = value
			}
		}

		// add other custom styles
		if (!Object.hasOwn(colorNames, rule)) {
			resultObj[rule] = value
		}
	}

	return resultObj
}

function generateForegroundColorFrom(input: string, percentage = 0.8) {
	const result = culoriInterpolate([input, isDark(input) ? "white" : "black"], "oklch")(percentage)
	return colorObjToString(result)
}

function generateDarkenColorFrom(input: string, percentage = 0.07) {
	const result = culoriInterpolate([input, "black"], "oklch")(percentage)
	return colorObjToString(result)
}

function colorObjToString(input: { l: number; c: number; h?: number }) {
	const { l, c, h } = input
	return `${Number.parseFloat((cutNumber(l) * 100).toFixed(6))}% ${cutNumber(c)} ${cutNumber(h ?? 0)}`
}

function cutNumber(number: number) {
	if (number) {
		return +number.toFixed(6)
	}
	return 0
}

function isDark(color: string) {
	return wcagContrast(color, "black") < wcagContrast(color, "white")
}
