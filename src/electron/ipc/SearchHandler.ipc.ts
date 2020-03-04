import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { SongSearch, SearchType, SongResult } from '../shared/interfaces/search.interface'
import { escape } from 'mysql'

/**
 * Handles the 'song-search' event.
 */
export default class SearchHandler implements IPCInvokeHandler<'song-search'> {
  event: 'song-search' = 'song-search'

  /**
   * @returns the top 20 songs that match `search`.
   */
  async handler(search: SongSearch) {
    const db = await Database.getInstance()

    return db.sendQuery(this.getSearchQuery(search)) as Promise<SongResult[]>
  }

  /**
   * @returns a database query that returns the type of results expected by `search.type`.
   */
  private getSearchQuery(search: SongSearch) {
    switch (search.type) {
      case SearchType.Any: return this.getGeneralSearchQuery(search.query)
      default: return '<<<ERROR>>>' // TODO: add more search types
    }
  }

  /**
   * @returns a database query that returns the top 20 songs that match `search`.
   */
  private getGeneralSearchQuery(searchString: string) {
    return `
      SELECT id, name, artist, album, genre, year
      FROM Song
      WHERE MATCH (name,artist,album,genre) AGAINST (${escape(searchString)}) > 0
      LIMIT ${20} OFFSET ${0};
    ` // TODO: add parameters for the limit and offset
  }
}