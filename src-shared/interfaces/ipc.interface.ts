import { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { UpdateInfo } from 'electron-updater'

import { Settings } from '../Settings'
import { Download, DownloadProgress } from './download.interface'
import { SongResult, SongSearch } from './search.interface'
import { VersionResult } from './songDetails.interface'
import { UpdateProgress } from './update.interface'

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
	songSearch: {
		input: SongSearch
		output: SongResult[]
	}
	getSongDetails: {
		input: SongResult['id']
		output: VersionResult[]
	}
	getBatchSongDetails: {
		input: number[]
		output: VersionResult[]
	}
	getCurrentVersion: {
		input: void
		output: string
	}
	getUpdateAvailable: {
		input: void
		output: boolean | null
	}
	isMaximized: {
		input: void
		output: boolean
	}
	showOpenDialog: {
		input: OpenDialogOptions
		output: OpenDialogReturnValue
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
	downloadUpdated: DownloadProgress
	queueUpdated: number[]
	maximized: void
	minimized: void
}

export type IpcFromMainEmitHandlers = {
	[K in keyof IpcFromMainEmitEvents]: (listener: (data: IpcFromMainEmitEvents[K]) => void) => void
}
