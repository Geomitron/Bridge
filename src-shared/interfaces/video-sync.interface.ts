/**
 * Bridge Video Sync Module - Shared Interfaces
 */

export interface YouTubeSearchResult {
	videoId: string
	title: string
	channel: string
	duration: string      // ISO 8601 duration or formatted string
	durationSeconds: number
	thumbnailUrl: string
	publishedAt: string
	viewCount?: number
	url?: string          // Full URL for non-YouTube sources
}

export interface VideoDownloadProgress {
	phase: 'searching' | 'downloading' | 'converting' | 'complete' | 'error'
	percent: number
	message: string
	videoId?: string
	chartId?: number
}

export interface VideoDownloadOptions {
	chartId: number
	videoId: string
	outputPath: string      // Chart folder path
	trimStart?: number      // Seconds to trim from start
	trimEnd?: number        // Seconds to trim from end
	targetFormat?: 'mp4' | 'webm' | 'avi'
}

export interface VideoSyncJob {
	id: string
	chartId: number
	chartName: string
	chartArtist: string
	videoId: string
	videoTitle: string
	status: 'queued' | 'downloading' | 'converting' | 'complete' | 'error'
	progress: number
	error?: string
	createdAt: string
}

export interface VideoSearchRequest {
	query: string
	maxResults?: number
}

export interface ChartVideoMatch {
	chartId: number
	chartName: string
	chartArtist: string
	chartPath: string
	songLength: number | null
	suggestedQuery: string
	searchResults?: YouTubeSearchResult[]
}
