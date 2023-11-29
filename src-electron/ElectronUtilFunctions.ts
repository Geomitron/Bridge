import { basename, parse } from 'path'
import { inspect } from 'util'

import { lower } from '../src-shared/UtilFunctions'
import { settings } from './ipc/SettingsHandler.ipc'
import { emitIpcEvent } from './main'

/**
 * @returns The relative filepath from the library folder to `absoluteFilepath`.
 */
export async function getRelativeFilepath(absoluteFilepath: string) {
	if (!settings.libraryPath) { throw 'getRelativeFilepath() failed; libraryPath is undefined' }
	return basename(settings.libraryPath) + absoluteFilepath.substring(settings.libraryPath.length)
}

/**
 * @returns `true` if `name` has a valid video file extension.
 */
export function hasVideoExtension(name: string) {
	return (['.mp4', '.avi', '.webm', '.ogv', '.mpeg'].includes(parse(lower(name)).ext))
}

/**
 * Log a message in the main BrowserWindow's console.
 */
export function devLog(message: unknown) {
	emitIpcEvent('errorLog', typeof message === 'string' ? message : inspect(message))
}
