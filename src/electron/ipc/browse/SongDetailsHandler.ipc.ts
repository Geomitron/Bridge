import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { VersionResult } from '../../shared/interfaces/songDetails.interface'
import * as needle from 'needle'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'song-details' event.
 */
class SongDetailsHandler implements IPCInvokeHandler<'song-details'> {
  event: 'song-details' = 'song-details'

  /**
   * @returns the chart versions with `songID`.
   */
  async handler(songID: number) {
    return new Promise<VersionResult[]>((resolve, reject) => {
      needle.request(
        'get',
        serverURL + `/api/data/songVersions`, {
          songID: songID
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

export const songDetailsHandler = new SongDetailsHandler()