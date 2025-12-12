import { IpcInvokeHandlers, IpcToMainEmitHandlers } from '../src-shared/interfaces/ipc.interface.js'
import { download } from './ipc/DownloadHandler.ipc.js'
import { scanIssues } from './ipc/issue-scan/IssueScanHandler.ipc.js'
import { getSettings, setSettings } from './ipc/SettingsHandler.ipc.js'
import { downloadUpdate, getCurrentVersion, getUpdateAvailable, quitAndInstall, retryUpdate } from './ipc/UpdateHandler.ipc.js'
import { getPlatform, getThemeColors, isMaximized, maximize, minimize, openUrl, quit, restore, showFile, showFolder, showOpenDialog, toggleDevTools, readDirectory } from './ipc/UtilHandlers.ipc.js'

export function getIpcInvokeHandlers(): IpcInvokeHandlers {
	return {
		getSettings,
		getCurrentVersion,
		getPlatform,
		getUpdateAvailable,
		isMaximized,
		showOpenDialog,
		getThemeColors,
		readDirectory
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
		scanIssues
	}
}
