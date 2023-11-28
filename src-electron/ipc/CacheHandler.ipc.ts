import { Dirent, readdir as _readdir } from 'fs'
import { join } from 'path'
import { rimraf } from 'rimraf'
import { inspect, promisify } from 'util'

import { devLog } from '../shared/ElectronUtilFunctions'
import { IPCInvokeHandler } from '../shared/IPCHandler'
import { tempPath } from '../shared/Paths'

const readdir = promisify(_readdir)

/**
 * Handles the 'clear-cache' event.
 */
class ClearCacheHandler implements IPCInvokeHandler<'clear-cache'> {
	event = 'clear-cache' as const

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
