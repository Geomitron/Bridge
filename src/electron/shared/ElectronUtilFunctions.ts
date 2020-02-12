import InitSettingsHandler from '../ipc/InitSettingsHandler.ipc'
import { basename } from 'path'

/**
 * @param absoluteFilepath The absolute filepath to a folder
 * @returns The relative filepath from the scanned folder to <absoluteFilepath>
 */
export async function getRelativeFilepath(absoluteFilepath: string) {
  const settings = await InitSettingsHandler.getSettings()
  return basename(settings.libraryPath) + absoluteFilepath.substring(settings.libraryPath.length)
}