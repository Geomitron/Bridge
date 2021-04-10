import { basename, parse } from 'path'
import { getSettingsHandler } from '../ipc/SettingsHandler.ipc'
import { emitIPCEvent } from '../main'
import { lower } from './UtilFunctions'

/**
 * @returns The relative filepath from the library folder to `absoluteFilepath`.
 */
export function getRelativeFilepath(absoluteFilepath: string) {
  const settings = getSettingsHandler.getSettings()
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
export function devLog(...messages: any[]) {
  emitIPCEvent('log', messages)
}