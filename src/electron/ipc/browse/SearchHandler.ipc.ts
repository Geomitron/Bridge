import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { SongResult, SongSearch } from '../../shared/interfaces/search.interface'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'song-search' event.
 */
class SearchHandler implements IPCInvokeHandler<'song-search'> {
  event: 'song-search' = 'song-search'

  /**
   * @returns the top 50 songs that match `search`.
   */
  async handler(search: SongSearch): Promise<SongResult[]> {
    const response = await fetch(`https://${serverURL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(search)
    })

    return await response.json()
  }
}

export const searchHandler = new SearchHandler()