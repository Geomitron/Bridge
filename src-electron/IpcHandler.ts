import { IpcInvokeHandlers, IpcToMainEmitHandlers } from '../src-shared/interfaces/ipc.interface.js'
import { catalogGetCharts, catalogGetChart, catalogGetDistinct, catalogGetStats, catalogGetChartsCount, catalogOpenFolder, catalogScan, catalogUpdateChart, catalogDeleteChart, catalogDeleteCharts, catalogCheckChartsExist } from './ipc/catalog/CatalogHandler.ipc.js'
import { videoSearchYouTube, videoSearch, videoGetInfo, videoDownload, videoDownloadFromUrl, videoSelectLocalFile, videoImportLocal, videoCancelDownload, videoCheckTools, videoGetChartsMissingVideo, videoBuildSearchQuery, videoBatchDownload, videoDeleteFromChart } from './ipc/video-sync/VideoSyncHandler.ipc.js'
import { artSearchAlbumArt, artDownloadImage, artGenerateBackground, artGetChartsMissingAlbumArt, artGetChartsMissingBackground, artCheckChartAssets, artBatchFetchAlbumArt, artBatchGenerateBackgrounds, artDeleteBackground, artDeleteAlbumArt, artBatchDeleteBackgrounds, artBatchRegenerateBackgrounds, artGetAlbumArtDataUrl, artGetBackgroundDataUrl } from './ipc/art-studio/ArtStudioHandler.ipc.js'
import { lyricsSearch, lyricsGet, lyricsGetById, lyricsDownload, lyricsGetChartsMissing, lyricsBatchDownload, lyricsCheckChart, lyricsDelete, lyricsGetAudioPath } from './ipc/lyrics/LyricsHandler.ipc.js'
import { download } from './ipc/DownloadHandler.ipc.js'
import { scanIssues } from './ipc/issue-scan/IssueScanHandler.ipc.js'
import { getSettings, setSettings } from './ipc/SettingsHandler.ipc.js'
import { downloadUpdate, getCurrentVersion, getUpdateAvailable, quitAndInstall, retryUpdate } from './ipc/UpdateHandler.ipc.js'
import { getPlatform, getThemeColors, isMaximized, maximize, minimize, openUrl, quit, restore, showFile, showFolder, showOpenDialog, toggleDevTools } from './ipc/UtilHandlers.ipc.js'

export function getIpcInvokeHandlers(): IpcInvokeHandlers {
	return {
		getSettings,
		getCurrentVersion,
		getPlatform,
		getUpdateAvailable,
		isMaximized,
		showOpenDialog,
		getThemeColors,
		// Catalog Manager
		catalogScan,
		catalogGetCharts,
		catalogGetChart,
		catalogGetStats,
		catalogGetChartsCount,
		catalogUpdateChart,
		catalogGetDistinct,
		catalogCheckChartsExist,
		catalogDeleteChart,
		catalogDeleteCharts,
		// Video Sync
		videoSearchYouTube,
		videoSearch,
		videoGetInfo,
		videoDownload,
		videoDownloadFromUrl,
		videoSelectLocalFile,
		videoImportLocal,
		videoCancelDownload,
		videoCheckTools,
		videoGetChartsMissingVideo,
		videoBuildSearchQuery,
		// Art Studio
		artSearchAlbumArt,
		artDownloadImage,
		artGenerateBackground,
		artGetChartsMissingAlbumArt,
		artGetChartsMissingBackground,
		artCheckChartAssets,
		artBatchFetchAlbumArt,
		artBatchGenerateBackgrounds,
		artDeleteBackground,
		artDeleteAlbumArt,
		artGetAlbumArtDataUrl,
		artGetBackgroundDataUrl,
		artBatchDeleteBackgrounds,
		artBatchRegenerateBackgrounds,
		// Video batch and delete
		videoBatchDownload,
		videoDeleteFromChart,
		// Lyrics
		lyricsSearch,
		lyricsGet,
		lyricsGetById,
		lyricsDownload,
		lyricsGetChartsMissing,
		lyricsBatchDownload,
		lyricsCheckChart,
		lyricsDelete,
		lyricsGetAudioPath,
	}
}

export function getIpcToMainEmitHandlers(): IpcToMainEmitHandlers {
	return {
		download,
		setSettings,
		downloadUpdate,
		retryUpdate,
		quitAndInstall,
		openUrl,
		toggleDevTools,
		maximize,
		minimize,
		restore,
		quit,
		showFile,
		showFolder,
		scanIssues,
		// Catalog Manager
		catalogOpenFolder,
	}
}
