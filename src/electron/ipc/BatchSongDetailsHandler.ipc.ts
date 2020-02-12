import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { VersionResult } from '../shared/interfaces/songDetails.interface'

export default class BatchSongDetailsHandler implements IPCInvokeHandler<'batch-song-details'> {
  event: 'batch-song-details' = 'batch-song-details'
  // TODO: add method documentation

  async handler(songIDs: number[]) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getVersionQuery(songIDs)) as Promise<VersionResult[]>
  }

  private getVersionQuery(songIDs: number[]) {
    return `
      SELECT *
      FROM VersionMetaFull
      WHERE songID IN (${songIDs.join(',')});
    `
  }
}