import { app, BrowserWindow, ipcMain } from 'electron'
import electronUnhandled from 'electron-unhandled'
import windowStateKeeper from 'electron-window-state'
import * as path from 'path'
import * as url from 'url'

import { IpcFromMainEmitEvents } from '../src-shared/interfaces/ipc.interface'
import { dataPath } from '../src-shared/Paths'
import { retryUpdate } from './ipc/UpdateHandler.ipc'
import { getIpcInvokeHandlers, getIpcToMainEmitHandlers } from './IpcHandler'

electronUnhandled({ showDialog: true, logger: err => console.log('Error: Unhandled Rejection:', err) })

export let mainWindow: BrowserWindow
const args = process.argv.slice(1)
const isDevBuild = args.some(val => val === '--dev')

restrictToSingleInstance()
handleOSXWindowClosed()
app.on('ready', async () => {
	createBridgeWindow()
	if (!isDevBuild) {
		retryUpdate()
	}
})

/**
 * Only allow a single Bridge window to be open at any one time.
 * If this is attempted, restore the open window instead.
 */
function restrictToSingleInstance() {
	const isFirstBridgeInstance = app.requestSingleInstanceLock()
	if (!isFirstBridgeInstance) app.quit()
	app.on('second-instance', () => {
		if (mainWindow !== undefined) {
			if (mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.focus()
		}
	})
}

/**
 * Standard OSX window functionality is to
 * minimize when closed and maximize when opened.
 */
function handleOSXWindowClosed() {
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		if (mainWindow === undefined) {
			createBridgeWindow()
		}
	})
}

/**
 * Launches and initializes Bridge's main window.
 */
async function createBridgeWindow() {

	// Load window size and maximized/restored state from previous session
	const windowState = windowStateKeeper({
		defaultWidth: 1000,
		defaultHeight: 800,
		path: dataPath,
	})

	// Create the browser window
	mainWindow = createBrowserWindow(windowState)

	// Store window size and maximized/restored state for next session
	windowState.manage(mainWindow)

	// Don't use a system menu
	mainWindow.setMenu(null)

	mainWindow.webContents.on('before-input-event', (event, input) => {
		if (input.control && (input.key === '+' || input.key === '-' || input.key === '=')) {
			event.preventDefault()
			const zoomFactor = mainWindow.webContents.getZoomFactor()
			const newZoomFactor = input.key === '+' || input.key === '=' ? zoomFactor + 0.1 : zoomFactor - 0.1
			mainWindow.webContents.setZoomFactor(newZoomFactor)
		}
	})

	// IPC handlers
	for (const [key, handler] of Object.entries(getIpcInvokeHandlers())) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ipcMain.handle(key, (_event, ...args) => (handler as any)(args[0]))
	}
	for (const [key, handler] of Object.entries(getIpcToMainEmitHandlers())) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ipcMain.on(key, (_event, ...args) => (handler as any)(args[0]))
	}
	mainWindow.on('unmaximize', () => emitIpcEvent('minimized', undefined))
	mainWindow.on('maximize', () => emitIpcEvent('maximized', undefined))

	// Load angular app
	await loadWindow()

	if (isDevBuild) {
		mainWindow.webContents.openDevTools()
	}
}

/**
 * Initialize a BrowserWindow object with initial parameters
 */
function createBrowserWindow(windowState: windowStateKeeper.State) {
	let options: Electron.BrowserWindowConstructorOptions = {
		x: windowState.x,
		y: windowState.y,
		width: windowState.width,
		height: windowState.height,
		frame: false,
		title: 'Bridge',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			allowRunningInsecureContent: (isDevBuild) ? true : false,
			textAreasAreResizable: false,
		},
		simpleFullscreen: true,
		fullscreenable: false,
		backgroundColor: '#121212',
	}

	if (process.platform === 'linux' && !isDevBuild) {
		options = Object.assign(options, { icon: path.join(__dirname, '..', 'assets', 'images', 'system', 'icons', 'png', '48x48.png') })
	}

	return new BrowserWindow(options)
}

async function loadWindow(retries = 0) {
	if (retries > 10) { throw new Error(`Angular frontend did not load.\nLoad URL: ${getLoadUrl()}`) }
	try {
		await mainWindow.loadURL(getLoadUrl())
	} catch (err) {
		await new Promise<void>(resolve => setTimeout(resolve, 1000))
		await loadWindow(retries + 1)
	}
}

/**
 * Load from localhost during development; load from index.html in production
 */
function getLoadUrl() {
	return url.format({
		protocol: isDevBuild ? 'http:' : 'file:',
		pathname: isDevBuild ? '//localhost:4200/' : path.join(__dirname, '..', '..', 'angular', 'index.html'),
		slashes: true,
	})
}

export function emitIpcEvent<E extends keyof IpcFromMainEmitEvents>(event: E, data: IpcFromMainEmitEvents[E]) {
	mainWindow.webContents.send(event, data)
}
