import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { VersionResult } from '../shared/interfaces/songDetails.interface'

/**
 * Handles the 'song-details' event.
 */
class SongDetailsHandler implements IPCInvokeHandler<'song-details'> {
  event: 'song-details' = 'song-details'

  /**
   * @returns the chart versions with `songID`.
   */
  async handler(songID: number) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getVersionQuery(songID)) as Promise<VersionResult[]>
  }

  /**
   * @returns a database query that returns the chart versions with `songID`.
   */
  private getVersionQuery(songID: number) {
    return `
      SELECT *
      FROM VersionMetaFull
      WHERE songID = ${songID};
    `
  }
}

export const songDetailsHandler = new SongDetailsHandler()