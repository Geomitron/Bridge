/**
 * Bridge Art Studio Module - Shared Interfaces
 */

export interface ImageSearchResult {
	url: string
	thumbnailUrl: string
	width: number
	height: number
	source: string
	title?: string
}

export interface AlbumArtResult {
	url: string
	size: 'small' | 'medium' | 'large' | 'extralarge'
	source: 'lastfm' | 'musicbrainz' | 'itunes' | 'spotify'
}

export interface ArtDownloadProgress {
	phase: 'searching' | 'downloading' | 'processing' | 'complete' | 'error'
	percent: number
	message: string
	chartId?: number
}

export interface ArtDownloadOptions {
	chartId: number
	imageUrl: string
	outputPath: string
	type: 'background' | 'album'
	resize?: {
		width: number
		height: number
	}
}

export interface ChartArtMatch {
	chartId: number
	chartName: string
	chartArtist: string
	chartAlbum: string
	chartPath: string
	hasBackground: boolean
	hasAlbumArt: boolean
	suggestedQuery: string
}

export interface BackgroundGenerateOptions {
	chartId: number
	outputPath: string
	style: 'gradient' | 'blur' | 'pattern' | 'solid'
	baseColor?: string
	albumArtPath?: string
	blurAmount?: number  // Blur sigma value, default 50
}

export interface BatchArtJob {
	chartId: number
	chartName: string
	chartArtist: string
	status: 'pending' | 'searching' | 'downloading' | 'complete' | 'error' | 'skipped'
	type: 'background' | 'album'
	error?: string
}
