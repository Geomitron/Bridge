import { SongResult, SongSearch } from '../../shared/interfaces/search.interface'
import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { serverURL } from '../../shared/Paths'

/**
 * Handles the 'song-search' event.
 */
class SearchHandler implements IPCInvokeHandler<'song-search'> {
	event = 'song-search' as const

	/**
	 * @returns the top 50 songs that match `search`.
	 */
	async handler(search: SongSearch): Promise<SongResult[]> {
		const response = await fetch(`https://${serverURL}/api/search`, {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(search),
		})

		return await response.json()
	}
}

export const searchHandler = new SearchHandler()
