/**
 * Represents a user's song search query.
 */
export interface SongSearch { // TODO: make limit a setting that's not always 51
	query: string
	quantity: 'all' | 'any'
	similarity: 'similar' | 'exact'
	fields: SearchFields
	tags: SearchTags
	instruments: SearchInstruments
	difficulties: SearchDifficulties
	minDiff: number
	maxDiff: number
	limit: number
	offset: number
}

export function getDefaultSearch(): SongSearch {
	return {
		query: '',
		quantity: 'all',
		similarity: 'similar',
		fields: { name: true, artist: true, album: true, genre: true, year: true, charter: true, tag: true },
		tags: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'sections': false, 'star power': false, 'forcing': false, 'taps': false, 'lyrics': false,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'video': false, 'stems': false, 'solo sections': false, 'open notes': false,
		},
		instruments: {
			guitar: false, bass: false, rhythm: false, keys: false,
			drums: false, guitarghl: false, bassghl: false, vocals: false,
		},
		difficulties: { expert: false, hard: false, medium: false, easy: false },
		minDiff: 0,
		maxDiff: 6,
		limit: 50 + 1,
		offset: 0,
	}
}

export interface SearchFields {
	name: boolean
	artist: boolean
	album: boolean
	genre: boolean
	year: boolean
	charter: boolean
	tag: boolean
}

export interface SearchTags {
	'sections': boolean    // Tag inverted
	// eslint-disable-next-line @typescript-eslint/naming-convention
	'star power': boolean  // Tag inverted
	'forcing': boolean     // Tag inverted
	'taps': boolean
	'lyrics': boolean
	'video': boolean
	'stems': boolean
	// eslint-disable-next-line @typescript-eslint/naming-convention
	'solo sections': boolean
	// eslint-disable-next-line @typescript-eslint/naming-convention
	'open notes': boolean
}

export interface SearchInstruments {
	guitar: boolean
	bass: boolean
	rhythm: boolean
	keys: boolean
	drums: boolean
	guitarghl: boolean
	bassghl: boolean
	vocals: boolean
}

export interface SearchDifficulties {
	expert: boolean
	hard: boolean
	medium: boolean
	easy: boolean
}

/**
 * Represents a single song search result.
 */
export interface SongResult {
	id: number
	chartCount: number
	name: string
	artist: string
	album: string
	genre: string
	year: string
}
