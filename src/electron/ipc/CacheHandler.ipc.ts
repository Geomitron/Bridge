import { IPCInvokeHandler } from '../shared/IPCHandler'
import { tempPath } from '../shared/Paths'
import { rimraf } from 'rimraf'
import { Dirent, readdir as _readdir } from 'fs'
import { inspect, promisify } from 'util'
import { join } from 'path'
import { devLog } from '../shared/ElectronUtilFunctions'

const readdir = promisify(_readdir)

/**
 * Handles the 'clear-cache' event.
 */
class ClearCacheHandler implements IPCInvokeHandler<'clear-cache'> {
  event: 'clear-cache' = 'clear-cache'

  /**
   * Deletes all the files under `tempPath`
   */
  async handler() {
    let files: Dirent[]
    try {
      files = await readdir(tempPath, { withFileTypes: true })
    } catch (err) {
      devLog('Failed to read cache: ', err)
      return
    }

    for (const file of files) {
      try {
        devLog(`Deleting ${file.isFile() ? 'file' : 'folder'}: ${join(tempPath, file.name)}`)
        await rimraf(join(tempPath, file.name))
      } catch (err) {
        devLog(`Failed to delete ${file.isFile() ? 'file' : 'folder'}: `, inspect(err))
        return
      }
    }
  }
}

export const clearCacheHandler = new ClearCacheHandler()