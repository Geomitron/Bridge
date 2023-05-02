import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { VersionResult } from '../../shared/interfaces/songDetails.interface'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'batch-song-details' event.
 */
class BatchSongDetailsHandler implements IPCInvokeHandler<'batch-song-details'> {
  event: 'batch-song-details' = 'batch-song-details'

  /**
   * @returns an array of all the chart versions with a songID found in `songIDs`.
   */
  async handler(songIDs: number[]): Promise<VersionResult[]> {
    const response = await fetch(`https://${serverURL}/api/data/song-versions/${songIDs.join(',')}`)
    return await response.json()
  }
}

export const batchSongDetailsHandler = new BatchSongDetailsHandler()