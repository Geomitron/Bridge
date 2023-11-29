import { app, dialog, OpenDialogOptions, shell } from 'electron'

import { mainWindow } from '../main'

/**
 * Opens `url` in the default browser.
 */
export function openUrl(url: string) {
	shell.openExternal(url)
}

export function toggleDevTools() {
	mainWindow.webContents.toggleDevTools()
}

export async function isMaximized() {
	return mainWindow.isMaximized()
}

export function maximize() {
	mainWindow.maximize()
}

export function minimize() {
	mainWindow.minimize()
}

export function restore() {
	mainWindow.restore()
}

export function quit() {
	app.quit()
}

export function showOpenDialog(options: OpenDialogOptions) {
	return dialog.showOpenDialog(mainWindow, options)
}

export function showFolder(folderPath: string) {
	shell.openPath(folderPath)
}

export function showFile(filePath: string) {
	shell.showItemInFolder(filePath)
}
