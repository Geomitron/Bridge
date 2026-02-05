/**
 * Bridge Catalog Manager - Shared Interfaces
 * Types used by both Electron (main) and Angular (renderer) processes
 */

export interface ChartRecord {
	id: number
	path: string

	// Metadata from song.ini
	name: string
	artist: string
	album: string
	genre: string
	year: number | null
	charter: string

	// Difficulty ratings (0-6 scale typical for CH, -1 or null = not charted)
	diff_guitar: number | null
	diff_bass: number | null
	diff_drums: number | null
	diff_keys: number | null
	diff_vocals: number | null
	diff_rhythm: number | null
	diff_guitarghl: number | null
	diff_bassghl: number | null

	// Instruments available (true if difficulty >= 0)
	hasGuitar: boolean
	hasBass: boolean
	hasDrums: boolean
	hasKeys: boolean
	hasVocals: boolean
	hasRhythm: boolean
	hasGHL: boolean

	// Difficulty levels available per instrument (parsed from chart file)
	// Format: comma-separated string like "e,m,h,x" for easy,medium,hard,expert
	guitarDiffs: string
	bassDiffs: string
	drumsDiffs: string
	keysDiffs: string
	vocalsDiffs: string
	rhythmDiffs: string
	ghlGuitarDiffs: string
	ghlBassDiffs: string

	// Chart file type
	chartType: 'mid' | 'chart' | 'sng' | null

	// Asset status
	hasVideo: boolean
	hasBackground: boolean
	hasAlbumArt: boolean
	hasStems: boolean
	hasLyrics: boolean

	// Audio info
	songLength: number | null  // milliseconds
	previewStart: number | null

	// Tracking
	chorusId: string | null  // Link to Chorus Encore if known
	folderHash: string       // For change detection
	lastScanned: string      // ISO date string
}

export interface SongIniData {
	name?: string
	artist?: string
	album?: string
	genre?: string
	year?: string | number
	charter?: string
	frets?: string  // Alternative to charter

	diff_guitar?: number
	diff_bass?: number
	diff_rhythm?: number
	diff_drums?: number
	diff_drums_real?: number
	diff_keys?: number
	diff_guitarghl?: number
	diff_bassghl?: number
	diff_vocals?: number

	song_length?: number
	preview_start_time?: number

	icon?: string
	loading_phrase?: string
	multiplier_note?: number  // GH3-style charts use this

	// Any other fields
	[key: string]: string | number | undefined
}

export interface ChartAssets {
	// Video files
	video: string | null           // video.mp4, video.avi, video.webm, etc.

	// Background images
	background: string | null      // background.png, background.jpg, etc.

	// Album art
	albumArt: string | null        // album.png, album.jpg, etc.

	// Audio stems (for stem separation)
	stems: {
		guitar?: string
		bass?: string
		drums?: string
		vocals?: string
		keys?: string
		backing?: string
	}

	// Main audio
	audio: string | null           // song.ogg, song.mp3, guitar.ogg, etc.

	// Chart files
	chart: string | null           // notes.chart or notes.mid
}

export interface ScanProgress {
	phase: 'starting' | 'discovering' | 'scanning' | 'complete' | 'error'
	current: number
	total: number
	currentPath?: string
	message?: string
}

export interface ScanResult {
	added: number
	updated: number
	removed: number
	errors: Array<{ path: string; error: string }>
	duration: number  // ms
}

export interface CatalogFilter {
	search?: string           // Full-text search
	artist?: string
	charter?: string
	genre?: string
	album?: string

	// Asset filters
	hasVideo?: boolean
	hasBackground?: boolean
	hasAlbumArt?: boolean
	hasLyrics?: boolean

	// Chart type filter
	chartType?: 'mid' | 'chart'

	// Instrument filters
	hasGuitar?: boolean
	hasBass?: boolean
	hasDrums?: boolean
	hasKeys?: boolean
	hasVocals?: boolean

	// Difficulty level filters (e=easy, m=medium, h=hard, x=expert)
	guitarDiff?: 'e' | 'm' | 'h' | 'x'
	bassDiff?: 'e' | 'm' | 'h' | 'x'
	drumsDiff?: 'e' | 'm' | 'h' | 'x'
	keysDiff?: 'e' | 'm' | 'h' | 'x'

	minDifficulty?: number
	maxDifficulty?: number
	instrument?: 'guitar' | 'bass' | 'drums' | 'keys' | 'vocals'

	sortBy?: 'name' | 'artist' | 'album' | 'charter' | 'year' | 'lastScanned' | 'chartType'
	sortDirection?: 'asc' | 'desc'

	limit?: number
	offset?: number
}

export interface CatalogStats {
	totalCharts: number
	withVideo: number
	withBackground: number
	withAlbumArt: number
	withLyrics: number
	uniqueArtists: number
	uniqueCharters: number
}
