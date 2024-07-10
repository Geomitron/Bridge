import { IpcInvokeHandlers, IpcToMainEmitHandlers } from '../src-shared/interfaces/ipc.interface.js'
import { download } from './ipc/DownloadHandler.ipc.js'
import { getSettings, setSettings } from './ipc/SettingsHandler.ipc.js'
import { downloadUpdate, getCurrentVersion, getUpdateAvailable, quitAndInstall, retryUpdate } from './ipc/UpdateHandler.ipc.js'
import { isMaximized, maximize, minimize, openUrl, quit, restore, showFile, showFolder, showOpenDialog, toggleDevTools } from './ipc/UtilHandlers.ipc.js'

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
