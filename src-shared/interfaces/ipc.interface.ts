import { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { UpdateInfo } from 'electron-updater'

import { Settings } from '../Settings.js'
import { Download, DownloadProgress } from './download.interface.js'
import { ChartData, LibrarySearch } from './search.interface.js'
import { ThemeColors } from './theme.interface.js'
import { UpdateProgress } from './update.interface.js'

export interface ContextBridgeApi {
	invoke: IpcInvokeHandlers
	emit: IpcToMainEmitHandlers
	on: IpcFromMainEmitHandlers
}

/**
 * To add a new IPC listener:
 * 1.) Add listener to this interface.
 * 2.) Fix compile errors in `ipcHandler.ts` and `preload.ts`.
 */

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
	addChart: {
		input: ChartData
		output: ChartData
	}
	removeChart: {
		input: string
		output: void
	}
	removeCharts: {
		input: ChartData[]
		output: void
	}
	getChartsBySearchTerm: {
		input?: LibrarySearch
		output: ChartData[]
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
	removeAllCharts: void
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
}

export type IpcFromMainEmitHandlers = {
	[K in keyof IpcFromMainEmitEvents]: (listener: (data: IpcFromMainEmitEvents[K]) => void) => void
}
