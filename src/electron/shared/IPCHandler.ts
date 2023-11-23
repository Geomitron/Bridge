import { UpdateInfo } from 'electron-updater'

import { albumArtHandler } from '../ipc/browse/AlbumArtHandler.ipc'
import { batchSongDetailsHandler } from '../ipc/browse/BatchSongDetailsHandler.ipc'
import { searchHandler } from '../ipc/browse/SearchHandler.ipc'
import { songDetailsHandler } from '../ipc/browse/SongDetailsHandler.ipc'
import { clearCacheHandler } from '../ipc/CacheHandler.ipc'
import { downloadHandler } from '../ipc/download/DownloadHandler'
import { openURLHandler } from '../ipc/OpenURLHandler.ipc'
import { getSettingsHandler, setSettingsHandler } from '../ipc/SettingsHandler.ipc'
import { downloadUpdateHandler, getCurrentVersionHandler, getUpdateAvailableHandler, quitAndInstallHandler, updateChecker, UpdateProgress } from '../ipc/UpdateHandler.ipc'
import { Download, DownloadProgress } from './interfaces/download.interface'
import { SongResult, SongSearch } from './interfaces/search.interface'
import { AlbumArtResult, VersionResult } from './interfaces/songDetails.interface'
import { Settings } from './Settings'

/**
 * To add a new IPC listener:
 * 1.) Write input/output interfaces
 * 2.) Add the event to IPCEvents
 * 3.) Write a class that implements IPCHandler
 * 4.) Add the class to getIPCHandlers
 */

export function getIPCInvokeHandlers(): IPCInvokeHandler<keyof IPCInvokeEvents>[] {
	return [
		getSettingsHandler,
		clearCacheHandler,
		searchHandler,
		songDetailsHandler,
		batchSongDetailsHandler,
		albumArtHandler,
		getCurrentVersionHandler,
		getUpdateAvailableHandler,
	]
}

/**
 * The list of possible async IPC events that return values, mapped to their input and output types.
 */
export interface IPCInvokeEvents {
	'get-settings': {
		input: undefined
		output: Settings
	}
	'clear-cache': {
		input: undefined
		output: void
	}
	'song-search': {
		input: SongSearch
		output: SongResult[]
	}
	'album-art': {
		input: SongResult['id']
		output: AlbumArtResult
	}
	'song-details': {
		input: SongResult['id']
		output: VersionResult[]
	}
	'batch-song-details': {
		input: number[]
		output: VersionResult[]
	}
	'get-current-version': {
		input: undefined
		output: string
	}
	'get-update-available': {
		input: undefined
		output: boolean
	}
}

/**
 * Describes an object that handles the `E` async IPC event that will return a value.
 */
export interface IPCInvokeHandler<E extends keyof IPCInvokeEvents> {
	event: E
	handler(data: IPCInvokeEvents[E]['input']): Promise<IPCInvokeEvents[E]['output']> | IPCInvokeEvents[E]['output']
}


export function getIPCEmitHandlers(): IPCEmitHandler<keyof IPCEmitEvents>[] {
	return [
		downloadHandler,
		setSettingsHandler,
		downloadUpdateHandler,
		updateChecker,
		quitAndInstallHandler,
		openURLHandler,
	]
}

/**
 * The list of possible async IPC events that don't return values, mapped to their input types.
 */
export interface IPCEmitEvents {
	'log': any[]

	'download': Download
	'download-updated': DownloadProgress
	'set-settings': Settings
	'queue-updated': number[]

	'update-error': Error
	'update-available': UpdateInfo
	'update-progress': UpdateProgress
	'update-downloaded': undefined
	'download-update': undefined
	'retry-update': undefined
	'quit-and-install': undefined
	'open-url': string
}

/**
 * Describes an object that handles the `E` async IPC event that will not return a value.
 */
export interface IPCEmitHandler<E extends keyof IPCEmitEvents> {
	event: E
	handler(data: IPCEmitEvents[E]): void
}
