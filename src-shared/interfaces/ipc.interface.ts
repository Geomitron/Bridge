import { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { UpdateInfo } from 'electron-updater'

import { Settings } from '../Settings.js'
import { CatalogFilter, CatalogStats, ChartRecord, ScanProgress, ScanResult } from './catalog.interface.js'
import { VideoDownloadOptions, VideoDownloadProgress, YouTubeSearchResult } from './video-sync.interface.js'
import { AlbumArtResult, ArtDownloadOptions, ArtDownloadProgress, BackgroundGenerateOptions, ChartArtMatch } from './art-studio.interface.js'
import { LyricsSearchResult, ChartLyricsMatch, LyricsDownloadProgress } from './lyrics.interface.js'
import { Download, DownloadProgress } from './download.interface.js'
import { ThemeColors } from './theme.interface.js'
import { UpdateProgress } from './update.interface.js'

export interface ContextBridgeApi {
	invoke: IpcInvokeHandlers
	emit: IpcToMainEmitHandlers
	on: IpcFromMainEmitHandlers
}

/**
 * The list of possible async IPC events that return values.
 */
export interface IpcInvokeEvents {
	getSettings: {
		input: void
		output: Settings
	}
	getCurrentVersion: {
		input: void
		output: string
	}
	getPlatform: {
		input: void
		output: NodeJS.Platform
	}
	getUpdateAvailable: {
		input: void
		output: 'yes' | 'no' | 'error'
	}
	isMaximized: {
		input: void
		output: boolean
	}
	showOpenDialog: {
		input: OpenDialogOptions
		output: OpenDialogReturnValue
	}
	getThemeColors: {
		input: string
		output: ThemeColors | null
	}
	// Catalog Manager
	catalogGetLibraryPaths: {
		input: void
		output: string[]
	}
	catalogAddLibraryPath: {
		input: void
		output: string | null
	}
	catalogRemoveLibraryPath: {
		input: number
		output: void
	}
	catalogScan: {
		input: void
		output: ScanResult
	}
	catalogGetCharts: {
		input: CatalogFilter
		output: ChartRecord[]
	}
	catalogGetChart: {
		input: number
		output: ChartRecord | null
	}
	catalogGetStats: {
		input: void
		output: CatalogStats
	}
	catalogUpdateChart: {
		input: { id: number; updates: Partial<ChartRecord> }
		output: ChartRecord | null
	}
	catalogGetDistinct: {
		input: 'artist' | 'charter' | 'genre' | 'album'
		output: string[]
	}
	catalogCheckChartsExist: {
		input: Array<{ artist: string; name: string; charter: string }>
		output: Record<string, boolean>
	}
	// Video Sync
	videoSearchYouTube: {
		input: string
		output: YouTubeSearchResult[]
	}
	videoSearch: {
		input: [string, string]  // [query, source]
		output: YouTubeSearchResult[]
	}
	videoGetInfo: {
		input: string
		output: YouTubeSearchResult | null
	}
	videoDownload: {
		input: VideoDownloadOptions
		output: string
	}
	videoDownloadFromUrl: {
		input: { chartId: number; url: string; outputPath: string }
		output: string
	}
	videoSelectLocalFile: {
		input: void
		output: string | null
	}
	videoImportLocal: {
		input: { chartId: number; sourcePath: string; outputPath: string }
		output: string
	}
	videoCancelDownload: {
		input: string
		output: boolean
	}
	videoCheckTools: {
		input: void
		output: { ytDlp: boolean; ffmpeg: boolean }
	}
	videoGetChartsMissingVideo: {
		input: number
		output: Array<{
			id: number
			name: string
			artist: string
			path: string
			songLength: number | null
			suggestedQuery: string
		}>
	}
	videoBuildSearchQuery: {
		input: number
		output: string
	}
	// Art Studio
	artSearchAlbumArt: {
		input: { artist: string; album: string }
		output: AlbumArtResult[]
	}
	artDownloadImage: {
		input: ArtDownloadOptions
		output: string
	}
	artGenerateBackground: {
		input: BackgroundGenerateOptions
		output: string
	}
	artGetChartsMissingAlbumArt: {
		input: number
		output: ChartArtMatch[]
	}
	artGetChartsMissingBackground: {
		input: number
		output: ChartArtMatch[]
	}
	artCheckChartAssets: {
		input: number
		output: { hasAlbumArt: boolean; hasBackground: boolean; albumArtPath?: string; backgroundPath?: string }
	}
	artBatchFetchAlbumArt: {
		input: number[]
		output: { success: number; failed: number; skipped: number }
	}
	artBatchGenerateBackgrounds: {
		input: number[]
		output: { success: number; failed: number; skipped: number }
	}
	artDeleteBackground: {
		input: number
		output: { success: boolean; error?: string }
	}
	artDeleteAlbumArt: {
		input: number
		output: { success: boolean; error?: string }
	}
	artGetAlbumArtDataUrl: {
		input: { chartPath: string; maxSize?: number }
		output: string | null
	}
	artGetBackgroundDataUrl: {
		input: { chartPath: string; maxSize?: number }
		output: string | null
	}
	artBatchDeleteBackgrounds: {
		input: number[]
		output: { success: number; failed: number }
	}
	artBatchRegenerateBackgrounds: {
		input: { chartIds: number[]; blurAmount: number }
		output: { success: number; failed: number; skipped: number }
	}
	// Video batch and delete
	videoBatchDownload: {
		input: number[]
		output: { success: number; failed: number; skipped: number; errors: Array<{ chartId: number; error: string }> }
	}
	videoDeleteFromChart: {
		input: number
		output: { success: boolean; error?: string }
	}
	// Catalog Settings & Removal
	catalogGetRemovalFolder: {
		input: void
		output: string | null
	}
	catalogSetRemovalFolder: {
		input: void
		output: string | null
	}
	catalogClearRemovalFolder: {
		input: void
		output: void
	}
	catalogRemoveChart: {
		input: number
		output: { success: boolean; error?: string }
	}
	catalogRemoveCharts: {
		input: number[]
		output: { success: number; failed: number; errors: string[] }
	}
	// Lyrics
	lyricsSearch: {
		input: { artist: string; title: string }
		output: LyricsSearchResult[]
	}
	lyricsGet: {
		input: { artist: string; title: string; album?: string; duration?: number }
		output: LyricsSearchResult | null
	}
	lyricsGetById: {
		input: number
		output: LyricsSearchResult | null
	}
	lyricsDownload: {
		input: { chartId: number; lyricsId: number; outputPath: string; chartType: 'mid' | 'chart' | 'sng' | null; offsetMs?: number }
		output: { success: boolean; error?: string }
	}
	lyricsGetChartsMissing: {
		input: number
		output: ChartLyricsMatch[]
	}
	lyricsBatchDownload: {
		input: number[]
		output: { success: number; failed: number; skipped: number }
	}
	lyricsCheckChart: {
		input: number
		output: { hasLyrics: boolean }
	}
	lyricsDelete: {
		input: number
		output: { success: boolean; error?: string }
	}
	lyricsGetAudioPath: {
		input: string
		output: { dataUrl: string; vocalStartMs: number | null; hasVocalsTrack: boolean } | null
	}
}

export type IpcInvokeHandlers = {
	[K in keyof IpcInvokeEvents]:
	(input: IpcInvokeEvents[K]['input']) => Promise<IpcInvokeEvents[K]['output']>
}

/**
 * The list of possible async IPC events sent to the main process that don't return values.
 */
export interface IpcToMainEmitEvents {
	download: Download
	setSettings: Settings
	downloadUpdate: void
	retryUpdate: void
	quitAndInstall: void
	openUrl: string
	toggleDevTools: void
	maximize: void
	minimize: void
	restore: void
	quit: void
	showFolder: string
	showFile: string
	scanIssues: void
	// Catalog Manager
	catalogOpenFolder: number
}

export type IpcToMainEmitHandlers = {
	[K in keyof IpcToMainEmitEvents]: (input: IpcToMainEmitEvents[K]) => void
}

/**
 * The list of possible async IPC events sent from the main process that don't return values.
 */
export interface IpcFromMainEmitEvents {
	errorLog: string
	updateError: string
	updateAvailable: UpdateInfo | null
	updateProgress: UpdateProgress
	updateDownloaded: void
	downloadQueueUpdate: DownloadProgress
	queueUpdated: number[]
	maximized: void
	minimized: void
	updateIssueScan: { status: 'progress' | 'error' | 'done'; message: string }
	// Catalog Manager
	catalogScanProgress: ScanProgress
	// Video Sync
	videoDownloadProgress: VideoDownloadProgress
	// Art Studio
	artDownloadProgress: ArtDownloadProgress
	// Lyrics
	lyricsProgress: LyricsDownloadProgress
}

export type IpcFromMainEmitHandlers = {
	[K in keyof IpcFromMainEmitEvents]: (listener: (data: IpcFromMainEmitEvents[K]) => void) => void
}
