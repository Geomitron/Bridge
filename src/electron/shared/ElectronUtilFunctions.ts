import { basename } from 'path'
import { getSettingsHandler } from '../ipc/SettingsHandler.ipc'

/**
 * @returns The relative filepath from the library folder to `absoluteFilepath`.
 */
export function getRelativeFilepath(absoluteFilepath: string) {
  const settings = getSettingsHandler.getSettings()
  return basename(settings.libraryPath) + absoluteFilepath.substring(settings.libraryPath.length)
}