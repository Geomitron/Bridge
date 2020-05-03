import { IPCInvokeHandler } from '../shared/IPCHandler'
import { SongSearch, SearchType, SongResult } from '../shared/interfaces/search.interface'
import * as needle from 'needle'
import { serverURL } from '../shared/Paths'
/**
 * Handles the 'song-search' event.
 */
class SearchHandler implements IPCInvokeHandler<'song-search'> {
  event: 'song-search' = 'song-search'

  /**
   * @returns the top 20 songs that match `search`.
   */
  async handler(search: SongSearch) {
    return new Promise<SongResult[]>((resolve, reject) => {
      needle.request(
        'get',
        serverURL + `/api/search/${this.getSearchType(search)}`, {
          query: search.query,
          limit: search.length,
          offset: search.offset
        }, (err, response) => {
          if (err) {
            reject(err)
          } else {
            resolve(response.body)
          }
        })
    })
  }

  /**
   * @returns the search api type that corresponds with `search.type`.
   */
  private getSearchType(search: SongSearch) {
    switch (search.type) {
      case SearchType.Any: return 'general'
      default: return '<<<ERROR>>>' // TODO: add more search types
    }
  }
}

export const searchHandler = new SearchHandler()