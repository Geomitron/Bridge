import { contextBridge, ipcRenderer } from 'electron'

import { ContextBridgeApi, IpcFromMainEmitEvents, IpcInvokeEvents, IpcToMainEmitEvents } from '../src-shared/interfaces/ipc.interface'

function getInvoker<K extends keyof IpcInvokeEvents>(key: K) {
	return (data: IpcInvokeEvents[K]['input']) => ipcRenderer.invoke(key, data) as Promise<IpcInvokeEvents[K]['output']>
}

function getEmitter<K extends keyof IpcToMainEmitEvents>(key: K) {
	return (data: IpcToMainEmitEvents[K]) => ipcRenderer.send(key, data)
}

function getListenerAdder<K extends keyof IpcFromMainEmitEvents>(key: K) {
	return (listener: (data: IpcFromMainEmitEvents[K]) => void) => {
		ipcRenderer.on(key, (_event, ...results) => listener(results[0]))
	}
}

const electronApi: ContextBridgeApi = {
	invoke: {
		getSettings: getInvoker('getSettings'),
		songSearch: getInvoker('songSearch'),
		getSongDetails: getInvoker('getSongDetails'),
		getBatchSongDetails: getInvoker('getBatchSongDetails'),
		getCurrentVersion: getInvoker('getCurrentVersion'),
		getUpdateAvailable: getInvoker('getUpdateAvailable'),
		isMaximized: getInvoker('isMaximized'),
		showOpenDialog: getInvoker('showOpenDialog'),
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
	},
	on: {
		errorLog: getListenerAdder('errorLog'),
		updateError: getListenerAdder('updateError'),
		updateAvailable: getListenerAdder('updateAvailable'),
		updateProgress: getListenerAdder('updateProgress'),
		updateDownloaded: getListenerAdder('updateDownloaded'),
		downloadUpdated: getListenerAdder('downloadUpdated'),
		queueUpdated: getListenerAdder('queueUpdated'),
		maximized: getListenerAdder('maximized'),
		minimized: getListenerAdder('minimized'),
	},
}

contextBridge.exposeInMainWorld('electron', electronApi)
