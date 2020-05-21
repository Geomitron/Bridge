import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { AlbumArtResult } from '../../shared/interfaces/songDetails.interface'
import * as needle from 'needle'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'album-art' event.
 */
class AlbumArtHandler implements IPCInvokeHandler<'album-art'> {
  event: 'album-art' = 'album-art'

  /**
   * @returns an `AlbumArtResult` object containing the album art for the song with `songID`.
   */
  async handler(songID: number) {
    return new Promise<AlbumArtResult>((resolve, reject) => {
      needle.request(
        'get',
        serverURL + `/api/data/albumArt`, {
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

export const albumArtHandler = new AlbumArtHandler()