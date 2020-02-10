import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { VersionResult } from '../shared/interfaces/songDetails.interface'

export default class SongDetailsHandler implements IPCInvokeHandler<'song-details'> {
  event: 'song-details' = 'song-details'
  // TODO: add method documentation

  async handler(songID: number) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getVersionQuery(songID)) as Promise<VersionResult[]>
  }

  private getVersionQuery(songID: number) {
    return `
      SELECT *
      FROM VersionMetaFull
      WHERE songID = ${songID};
    `
  }
}