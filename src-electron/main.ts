import { app, BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import * as path from 'path'
import * as url from 'url'

import { getSettingsHandler } from './ipc/SettingsHandler.ipc'
import { updateChecker } from './ipc/UpdateHandler.ipc'
// IPC Handlers
import { getIPCEmitHandlers, getIPCInvokeHandlers, IPCEmitEvents } from './shared/IPCHandler'
import { dataPath } from './shared/Paths'

import unhandled = require('electron-unhandled')
unhandled({ showDialog: true })

export let mainWindow: BrowserWindow
const args = process.argv.slice(1)
const isDevBuild = args.some(val => val == '--dev')
import remote = require('@electron/remote/main')


remote.initialize()
restrictToSingleInstance()
handleOSXWindowClosed()
app.on('ready', () => {
	// Load settings from file before the window is created
	getSettingsHandler.initSettings().then(() => {
		createBridgeWindow()
		if (!isDevBuild) {
			updateChecker.checkForUpdates()
		}
	})
})

/**
 * Only allow a single Bridge window to be open at any one time.
 * If this is attempted, restore the open window instead.
 */
function restrictToSingleInstance() {
	const isFirstBridgeInstance = app.requestSingleInstanceLock()
	if (!isFirstBridgeInstance) app.quit()
	app.on('second-instance', () => {
		if (mainWindow != undefined) {
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
		if (process.platform != 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		if (mainWindow == undefined) {
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

	// IPC handlers
	getIPCInvokeHandlers().map(handler => ipcMain.handle(handler.event, (_event, ...args) => handler.handler(args[0])))
	getIPCEmitHandlers().map(handler => ipcMain.on(handler.event, (_event, ...args) => handler.handler(args[0])))

	// Load angular app
	await loadWindow()

	if (isDevBuild) {
		mainWindow.webContents.openDevTools()
	}

	mainWindow.on('closed', () => {
		mainWindow = null // Dereference mainWindow when the window is closed
	})

	// enable the remote webcontents
	remote.enable(mainWindow.webContents)
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
			// preload:
			allowRunningInsecureContent: (isDevBuild) ? true : false,
			textAreasAreResizable: false,
		},
		simpleFullscreen: true,
		fullscreenable: false,
		backgroundColor: '#121212',
	}

	if (process.platform == 'linux' && !isDevBuild) {
		options = Object.assign(options, { icon: path.join(__dirname, '..', 'assets', 'images', 'system', 'icons', 'png', '48x48.png') })
	}

	return new BrowserWindow(options)
}

async function loadWindow(retries = 0) {
	if (retries > 10) { throw new Error('Angular frontend did not load') }
	try {
		await mainWindow.loadURL(getLoadUrl())
	} catch (err) {
		await loadWindow(retries + 1)
	}
}

/**
 * Load from localhost during development; load from index.html in production
 */
function getLoadUrl() {
	return url.format({
		protocol: isDevBuild ? 'http:' : 'file:',
		pathname: isDevBuild ? '//localhost:4200/' : path.join(__dirname, '..', 'index.html'),
		slashes: true,
	})
}

export function emitIPCEvent<E extends keyof IPCEmitEvents>(event: E, data: IPCEmitEvents[E]) {
	mainWindow.webContents.send(event, data)
}
