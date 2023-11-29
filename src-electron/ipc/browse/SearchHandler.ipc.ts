import { SongSearch } from '../../../src-shared/interfaces/search.interface'
import { serverURL } from '../../../src-shared/Paths'

export async function songSearch(search: SongSearch) {
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
