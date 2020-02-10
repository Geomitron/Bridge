import { app, BrowserWindow, screen, ipcMain } from 'electron'
import * as path from 'path'
import * as url from 'url'

// IPC Handlers
import { getIPCInvokeHandlers, getIPCEmitHandlers, IPCEmitEvents } from './shared/IPCHandler'
import Database from './shared/Database'

let mainWindow: BrowserWindow
const args = process.argv.slice(1)
const isDevBuild = args.some(val => val == '--dev')

restrictToSingleInstance()
handleOSXWindowClosed()
app.on('ready', createBridgeWindow)

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
function createBridgeWindow() {

  // Create the browser window
  mainWindow = createBrowserWindow()

  mainWindow.maximize()

  // Don't use a system menu
  mainWindow.setMenu(null)

  // IPC handlers
  getIPCInvokeHandlers().map(handler => ipcMain.handle(handler.event, (_event, ...args) => handler.handler(args[0])))
  getIPCEmitHandlers().map(handler => ipcMain.on(handler.event, (_event, ...args) => handler.handler(args[0])))

  // Load angular app
  mainWindow.loadURL(getLoadUrl())

  if (isDevBuild) {
    setUpDevTools()
  }

  mainWindow.on('closed', () => {
    Database.closeConnection()
    mainWindow = null // Dereference mainWindow when the window is closed
  })
}

/**
 * Initialize a BrowserWindow object with initial parameters
 */
function createBrowserWindow() {
  const targetWindowSize = screen.getPrimaryDisplay().workAreaSize

  return new BrowserWindow({
    x: 0,
    y: 0,
    width: targetWindowSize.width,
    height: targetWindowSize.height,
    frame: false,
    title: 'Bridge',
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (isDevBuild) ? true : false,
      textAreasAreResizable: false
    },
    simpleFullscreen: true,
    fullscreenable: false
  })
}

/**
 * Load from localhost during development; load from index.html in production
 */
function getLoadUrl() {
  return url.format({
    protocol: isDevBuild ? 'http:' : 'file:',
    pathname: isDevBuild ? '//localhost:4200/' : path.join(__dirname, '..', 'index.html'),
    slashes: true
  })
}

/**
 * Automatically reload the electron process on changes, and open the dev tools
 */
function setUpDevTools() {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/../../node_modules/electron`)
  })

  mainWindow.webContents.openDevTools()
}

export function emitIPCEvent<E extends keyof IPCEmitEvents>(event: E, data: IPCEmitEvents[E]) {
  mainWindow.webContents.send(event, data)
}