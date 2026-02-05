/**
 * Bridge Lyrics Module - Shared Interfaces
 */

export interface LyricLine {
	time: number      // Time in milliseconds
	text: string      // Lyric text
}

export interface LyricsSearchResult {
	id: number
	name: string
	trackName: string
	artistName: string
	albumName: string
	duration: number
	instrumental: boolean
	plainLyrics: string | null
	syncedLyrics: string | null  // LRC format
}

export interface ChartLyricsMatch {
	chartId: number
	chartName: string
	chartArtist: string
	chartAlbum: string
	chartPath: string
	chartType: 'mid' | 'chart' | 'sng' | null
	songLength: number | null
	suggestedQuery: string
}

export interface LyricsDownloadProgress {
	phase: 'searching' | 'downloading' | 'converting' | 'writing' | 'complete' | 'error'
	percent: number
	message: string
	chartId: number
}

export interface LyricsDownloadOptions {
	chartId: number
	lyricsId: number
	outputPath: string
	chartType: 'mid' | 'chart' | 'sng' | null
	offsetMs?: number  // Timing offset in milliseconds (positive = delay lyrics, negative = advance)
}
