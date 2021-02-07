import { basename } from 'path'
import { getSettingsHandler } from '../ipc/SettingsHandler.ipc'
import { emitIPCEvent } from '../main'

/**
 * @returns The relative filepath from the library folder to `absoluteFilepath`.
 */
export function getRelativeFilepath(absoluteFilepath: string) {
  const settings = getSettingsHandler.getSettings()
  return basename(settings.libraryPath) + absoluteFilepath.substring(settings.libraryPath.length)
}

/**
 * Log a message in the main BrowserWindow's console.
 */
export function devLog(...messages: any[]) {
  emitIPCEvent('log', messages)
}