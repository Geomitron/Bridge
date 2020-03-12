import { IPCInvokeHandler } from '../shared/IPCHandler'
import Database from '../shared/Database'
import { SongSearch, SearchType, SongResult } from '../shared/interfaces/search.interface'
import { escape } from 'mysql'

/**
 * Handles the 'song-search' event.
 */
class SearchHandler implements IPCInvokeHandler<'song-search'> {
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
      case SearchType.Any: return this.getGeneralSearchQuery(search)
      default: return '<<<ERROR>>>' // TODO: add more search types
    }
  }

  /**
   * @returns a database query that returns the top 20 songs that match `search`.
   */
  private getGeneralSearchQuery(search: SongSearch) {
    return `
      SELECT id, name, artist, album, genre, year
      FROM Song
      WHERE MATCH (name,artist,album,genre) AGAINST (${escape(search.query)}) > 0
      LIMIT ${search.length} OFFSET ${search.offset};
    ` // TODO: add parameters for the limit and offset
  }
}

export const searchHandler = new SearchHandler()