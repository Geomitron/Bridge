import { IpcInvokeHandlers, IpcToMainEmitHandlers } from '../src-shared/interfaces/ipc.interface'
import { getBatchSongDetails } from './ipc/browse/BatchSongDetailsHandler.ipc'
import { songSearch } from './ipc/browse/SearchHandler.ipc'
import { getSongDetails } from './ipc/browse/SongDetailsHandler.ipc'
import { download } from './ipc/download/DownloadHandler'
import { getSettings, setSettings } from './ipc/SettingsHandler.ipc'
import { downloadUpdate, getCurrentVersion, getUpdateAvailable, quitAndInstall, retryUpdate } from './ipc/UpdateHandler.ipc'
import { isMaximized, maximize, minimize, openUrl, quit, restore, showFile, showFolder, showOpenDialog, toggleDevTools } from './ipc/UtilHandlers.ipc'

export function getIpcInvokeHandlers(): IpcInvokeHandlers {
	return {
		getSettings,
		songSearch,
		getSongDetails,
		getBatchSongDetails,
		getCurrentVersion,
		getUpdateAvailable,
		isMaximized,
		showOpenDialog,
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
	}
}
