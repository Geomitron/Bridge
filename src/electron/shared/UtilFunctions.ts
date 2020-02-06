import { basename } from 'path'
import { Settings } from './Settings'

const settings = Settings.getInstance()

/**
 * @param absoluteFilepath The absolute filepath to a folder
 * @returns The relative filepath from the scanned folder to <absoluteFilepath>
 */
export function getRelativeFilepath(absoluteFilepath: string) {
  // TODO: figure out how these functions should use <settings> (like an async initialization script that
  //          loads everything and connects to the database, etc...)
  // return basename(scanSettings.songsFolderPath) + absoluteFilepath.substring(scanSettings.songsFolderPath.length)
  return absoluteFilepath
}