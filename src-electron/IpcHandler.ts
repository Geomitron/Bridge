import { IpcInvokeHandlers, IpcToMainEmitHandlers } from '../src-shared/interfaces/ipc.interface'
import { download } from './ipc/download/DownloadHandler'
import { getSettings, setSettings } from './ipc/SettingsHandler.ipc'
import { downloadUpdate, getCurrentVersion, getUpdateAvailable, quitAndInstall, retryUpdate } from './ipc/UpdateHandler.ipc'
import { isMaximized, maximize, minimize, openUrl, quit, restore, showFile, showFolder, showOpenDialog, toggleDevTools } from './ipc/UtilHandlers.ipc'

export function getIpcInvokeHandlers(): IpcInvokeHandlers {
	return {
		getSettings,
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
