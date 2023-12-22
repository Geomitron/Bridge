import { Difficulty, Instrument } from 'scan-chart'

export const themes = [
	'business',
	'dark',
	'halloween',
	'night',
	'synthwave',
	'aqua',
	'emerald',
	'lemonade',
	'valentine',
	'winter',
	'aren',
	'froogs',
] as const

/**
 * Represents Bridge's user settings.
 */
export interface Settings {
	downloadVideos: boolean         // If background videos should be downloaded
	theme: typeof themes[number]    // The name of the currently enabled UI theme
	libraryPath: string | undefined // The path to the user's library
	isSng: boolean                  // If the chart should be downloaded as a .sng file or as a chart folder
	instrument: Instrument | null   // The instrument selected by default, or `null` for "Any Instrument"
	difficulty: Difficulty | null   // The difficulty selected by default, or `null` for "Any Difficulty"
}

/**
 * Bridge's default user settings.
 */
export const defaultSettings: Settings = {
	downloadVideos: true,
	theme: 'dark',
	libraryPath: undefined,
	isSng: false,
	instrument: 'guitar',
	difficulty: null,
}
