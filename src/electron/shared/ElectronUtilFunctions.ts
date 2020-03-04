import { basename } from 'path'
import { GetSettingsHandler } from '../ipc/SettingsHandler.ipc'

/**
 * @returns The relative filepath from the library folder to `absoluteFilepath`.
 */
export function getRelativeFilepath(absoluteFilepath: string) {
  const settings = GetSettingsHandler.getSettings()
  return basename(settings.libraryPath) + absoluteFilepath.substring(settings.libraryPath.length)
}