import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { AlbumArtResult } from '../shared/interfaces/songDetails.interface'

export default class AlbumArtHandler implements IPCInvokeHandler<'album-art'> {
  event: 'album-art' = 'album-art'
  // TODO: add method documentation

  async handler(songID: number) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getAlbumArtQuery(songID), 1) as Promise<AlbumArtResult>
  }

  private getAlbumArtQuery(songID: number) {
    return `
      SELECT art
      FROM AlbumArt
      WHERE songID = ${songID};
    `
  }
}