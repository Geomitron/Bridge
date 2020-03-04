import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { VersionResult } from '../shared/interfaces/songDetails.interface'

/**
 * Handles the 'batch-song-details' event.
 */
export default class BatchSongDetailsHandler implements IPCInvokeHandler<'batch-song-details'> {
  event: 'batch-song-details' = 'batch-song-details'

  /**
   * @returns an array of all the chart versions with a songID found in `songIDs`.
   */
  async handler(songIDs: number[]) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getVersionQuery(songIDs)) as Promise<VersionResult[]>
  }

  /**
   * @returns a database query that returns all the chart versions with a songID found in `songIDs`.
   */
  private getVersionQuery(songIDs: number[]) {
    return `
      SELECT *
      FROM VersionMetaFull
      WHERE songID IN (${songIDs.join(',')});
    `
  }
}