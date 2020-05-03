import { IPCInvokeHandler } from '../shared/IPCHandler'
import { VersionResult } from '../shared/interfaces/songDetails.interface'
import { serverURL } from '../shared/Paths'
import * as needle from 'needle'

/**
 * Handles the 'batch-song-details' event.
 */
class BatchSongDetailsHandler implements IPCInvokeHandler<'batch-song-details'> {
  event: 'batch-song-details' = 'batch-song-details'

  /**
   * @returns an array of all the chart versions with a songID found in `songIDs`.
   */
  async handler(songIDs: number[]) {
    return new Promise<VersionResult[]>((resolve, reject) => {
      needle.request(
        'get',
        serverURL + `/api/data/songsVersions`, {
          songIDs: songIDs
        }, (err, response) => {
          if (err) {
            reject(err)
          } else {
            resolve(response.body)
          }
        })
    })
  }
}

export const batchSongDetailsHandler = new BatchSongDetailsHandler()