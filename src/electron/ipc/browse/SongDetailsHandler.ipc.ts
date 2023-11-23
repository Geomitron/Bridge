import { VersionResult } from '../../shared/interfaces/songDetails.interface'
import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'song-details' event.
 */
class SongDetailsHandler implements IPCInvokeHandler<'song-details'> {
	event = 'song-details' as const

	/**
	 * @returns the chart versions with `songID`.
	 */
	async handler(songID: number): Promise<VersionResult[]> {
		const response = await fetch(`https://${serverURL}/api/data/song-versions/${songID}`)
		return await response.json()
	}
}

export const songDetailsHandler = new SongDetailsHandler()
