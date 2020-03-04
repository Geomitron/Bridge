import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { AlbumArtResult } from '../shared/interfaces/songDetails.interface'

/**
 * Handles the 'album-art' event.
 */
export default class AlbumArtHandler implements IPCInvokeHandler<'album-art'> {
  event: 'album-art' = 'album-art'

  /**
   * @returns an `AlbumArtResult` object containing the album art for the song with `songID`.
   */
  async handler(songID: number) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getAlbumArtQuery(songID), 1) as Promise<AlbumArtResult>
  }

  /**
   * @returns a database query that returns the album art for the song with `songID`.
   */
  private getAlbumArtQuery(songID: number) {
    return `
      SELECT art
      FROM AlbumArt
      WHERE songID = ${songID};
    `
  }
}