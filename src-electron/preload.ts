// eslint-disable-next-line @typescript-eslint/no-var-requires
const electron = require('electron')
import type { IpcRendererEvent } from 'electron'
import { ContextBridgeApi, IpcFromMainEmitEvents, IpcInvokeEvents, IpcToMainEmitEvents } from '../src-shared/interfaces/ipc.interface.js'

function getInvoker<K extends keyof IpcInvokeEvents>(key: K) {
	return (data: IpcInvokeEvents[K]['input']) => electron.ipcRenderer.invoke(key, data) as Promise<IpcInvokeEvents[K]['output']>
}

function getEmitter<K extends keyof IpcToMainEmitEvents>(key: K) {
	return (data: IpcToMainEmitEvents[K]) => electron.ipcRenderer.send(key, data)
}

function getListenerAdder<K extends keyof IpcFromMainEmitEvents>(key: K) {
	return (listener: (data: IpcFromMainEmitEvents[K]) => void) => {
		electron.ipcRenderer.on(key, (_event: IpcRendererEvent, ...results: IpcFromMainEmitEvents[K][]) => listener(results[0]))
	}
}

const electronApi: ContextBridgeApi = {
	invoke: {
		getSettings: getInvoker('getSettings'),
		getCurrentVersion: getInvoker('getCurrentVersion'),
		getPlatform: getInvoker('getPlatform'),
		getUpdateAvailable: getInvoker('getUpdateAvailable'),
		isMaximized: getInvoker('isMaximized'),
		showOpenDialog: getInvoker('showOpenDialog'),
		getThemeColors: getInvoker('getThemeColors'),
		// Catalog Manager
		catalogGetLibraryPaths: getInvoker('catalogGetLibraryPaths'),
		catalogAddLibraryPath: getInvoker('catalogAddLibraryPath'),
		catalogRemoveLibraryPath: getInvoker('catalogRemoveLibraryPath'),
		catalogScan: getInvoker('catalogScan'),
		catalogGetCharts: getInvoker('catalogGetCharts'),
		catalogGetChart: getInvoker('catalogGetChart'),
		catalogGetStats: getInvoker('catalogGetStats'),
		catalogUpdateChart: getInvoker('catalogUpdateChart'),
		catalogGetDistinct: getInvoker('catalogGetDistinct'),
		catalogCheckChartsExist: getInvoker('catalogCheckChartsExist'),
		catalogGetRemovalFolder: getInvoker('catalogGetRemovalFolder'),
		catalogSetRemovalFolder: getInvoker('catalogSetRemovalFolder'),
		catalogClearRemovalFolder: getInvoker('catalogClearRemovalFolder'),
		catalogRemoveChart: getInvoker('catalogRemoveChart'),
		catalogRemoveCharts: getInvoker('catalogRemoveCharts'),
		// Video Sync
		videoSearchYouTube: getInvoker('videoSearchYouTube'),
		videoSearch: getInvoker('videoSearch'),
		videoGetInfo: getInvoker('videoGetInfo'),
		videoDownload: getInvoker('videoDownload'),
		videoDownloadFromUrl: getInvoker('videoDownloadFromUrl'),
		videoSelectLocalFile: getInvoker('videoSelectLocalFile'),
		videoImportLocal: getInvoker('videoImportLocal'),
		videoCancelDownload: getInvoker('videoCancelDownload'),
		videoCheckTools: getInvoker('videoCheckTools'),
		videoGetChartsMissingVideo: getInvoker('videoGetChartsMissingVideo'),
		videoBuildSearchQuery: getInvoker('videoBuildSearchQuery'),
		// Art Studio
		artSearchAlbumArt: getInvoker('artSearchAlbumArt'),
		artDownloadImage: getInvoker('artDownloadImage'),
		artGenerateBackground: getInvoker('artGenerateBackground'),
		artGetChartsMissingAlbumArt: getInvoker('artGetChartsMissingAlbumArt'),
		artGetChartsMissingBackground: getInvoker('artGetChartsMissingBackground'),
		artCheckChartAssets: getInvoker('artCheckChartAssets'),
		artBatchFetchAlbumArt: getInvoker('artBatchFetchAlbumArt'),
		artBatchGenerateBackgrounds: getInvoker('artBatchGenerateBackgrounds'),
		artDeleteBackground: getInvoker('artDeleteBackground'),
		artDeleteAlbumArt: getInvoker('artDeleteAlbumArt'),
		artGetAlbumArtDataUrl: getInvoker('artGetAlbumArtDataUrl'),
		artGetBackgroundDataUrl: getInvoker('artGetBackgroundDataUrl'),
		artBatchDeleteBackgrounds: getInvoker('artBatchDeleteBackgrounds'),
		artBatchRegenerateBackgrounds: getInvoker('artBatchRegenerateBackgrounds'),
		// Video batch and delete
		videoBatchDownload: getInvoker('videoBatchDownload'),
		videoDeleteFromChart: getInvoker('videoDeleteFromChart'),
		// Lyrics
		lyricsSearch: getInvoker('lyricsSearch'),
		lyricsGet: getInvoker('lyricsGet'),
		lyricsGetById: getInvoker('lyricsGetById'),
		lyricsDownload: getInvoker('lyricsDownload'),
		lyricsGetChartsMissing: getInvoker('lyricsGetChartsMissing'),
		lyricsBatchDownload: getInvoker('lyricsBatchDownload'),
		lyricsCheckChart: getInvoker('lyricsCheckChart'),
		lyricsDelete: getInvoker('lyricsDelete'),
		lyricsGetAudioPath: getInvoker('lyricsGetAudioPath'),
	},
	emit: {
		download: getEmitter('download'),
		setSettings: getEmitter('setSettings'),
		downloadUpdate: getEmitter('downloadUpdate'),
		retryUpdate: getEmitter('retryUpdate'),
		quitAndInstall: getEmitter('quitAndInstall'),
		openUrl: getEmitter('openUrl'),
		toggleDevTools: getEmitter('toggleDevTools'),
		maximize: getEmitter('maximize'),
		minimize: getEmitter('minimize'),
		restore: getEmitter('restore'),
		quit: getEmitter('quit'),
		showFolder: getEmitter('showFolder'),
		showFile: getEmitter('showFile'),
		scanIssues: getEmitter('scanIssues'),
		// Catalog Manager
		catalogOpenFolder: getEmitter('catalogOpenFolder'),
	},
	on: {
		errorLog: getListenerAdder('errorLog'),
		updateError: getListenerAdder('updateError'),
		updateAvailable: getListenerAdder('updateAvailable'),
		updateProgress: getListenerAdder('updateProgress'),
		updateDownloaded: getListenerAdder('updateDownloaded'),
		downloadQueueUpdate: getListenerAdder('downloadQueueUpdate'),
		queueUpdated: getListenerAdder('queueUpdated'),
		maximized: getListenerAdder('maximized'),
		minimized: getListenerAdder('minimized'),
		updateIssueScan: getListenerAdder('updateIssueScan'),
		// Catalog Manager
		catalogScanProgress: getListenerAdder('catalogScanProgress'),
		// Video Sync
		videoDownloadProgress: getListenerAdder('videoDownloadProgress'),
		// Art Studio
		artDownloadProgress: getListenerAdder('artDownloadProgress'),
		// Lyrics
		lyricsProgress: getListenerAdder('lyricsProgress'),
	},
}

console.log('[DEBUG] preload.ts: exposing electron API to renderer')
electron.contextBridge.exposeInMainWorld('electron', electronApi)
console.log('[DEBUG] preload.ts: electron API exposed successfully')
