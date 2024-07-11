// eslint-disable-next-line @typescript-eslint/no-var-requires
const electron = require('electron')
import { ContextBridgeApi, IpcFromMainEmitEvents, IpcInvokeEvents, IpcToMainEmitEvents } from '../src-shared/interfaces/ipc.interface.js'

function getInvoker<K extends keyof IpcInvokeEvents>(key: K) {
	return (data: IpcInvokeEvents[K]['input']) => electron.ipcRenderer.invoke(key, data) as Promise<IpcInvokeEvents[K]['output']>
}

function getEmitter<K extends keyof IpcToMainEmitEvents>(key: K) {
	return (data: IpcToMainEmitEvents[K]) => electron.ipcRenderer.send(key, data)
}

function getListenerAdder<K extends keyof IpcFromMainEmitEvents>(key: K) {
	return (listener: (data: IpcFromMainEmitEvents[K]) => void) => {
		electron.ipcRenderer.on(key, (_event, ...results) => listener(results[0]))
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
		downloadQueueUpdate: getListenerAdder('downloadQueueUpdate'),
		queueUpdated: getListenerAdder('queueUpdated'),
		maximized: getListenerAdder('maximized'),
		minimized: getListenerAdder('minimized'),
	},
}

electron.contextBridge.exposeInMainWorld('electron', electronApi)
