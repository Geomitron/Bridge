import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { AlbumArtResult } from '../../shared/interfaces/songDetails.interface'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'album-art' event.
 */
class AlbumArtHandler implements IPCInvokeHandler<'album-art'> {
  event: 'album-art' = 'album-art'

  /**
   * @returns an `AlbumArtResult` object containing the album art for the song with `songID`.
   */
  async handler(songID: number): Promise<AlbumArtResult> {
    const response = await fetch(`https://${serverURL}/api/data/album-art/${songID}`)
    return await response.json()
  }
}

export const albumArtHandler = new AlbumArtHandler()