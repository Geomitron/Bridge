import sanitize from 'sanitize-filename'
import { Difficulty, Instrument } from 'scan-chart'

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
