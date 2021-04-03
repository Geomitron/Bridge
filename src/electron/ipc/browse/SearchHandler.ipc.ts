import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { SongSearch, SongResult } from '../../shared/interfaces/search.interface'
import * as needle from 'needle'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'song-search' event.
 */
class SearchHandler implements IPCInvokeHandler<'song-search'> {
  event: 'song-search' = 'song-search'

  /**
   * @returns the top 50 songs that match `search`.
   */
  async handler(search: SongSearch) {
    return new Promise<SongResult[]>((resolve, reject) => {
      needle.request(
        'get',
        serverURL + `/api/search`, search, (err, response) => {
          if (err) {
            reject(err.message)
          } else {
            if (response.body.errors) {
              console.log(response.body)
              resolve([])
            } else {
              resolve(response.body)
            }
          }
        })
    })
  }
}

export const searchHandler = new SearchHandler()