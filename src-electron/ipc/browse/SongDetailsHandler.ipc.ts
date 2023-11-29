import { serverURL } from '../../../src-shared/Paths'

export async function getSongDetails(songId: number) {
	const response = await fetch(`https://${serverURL}/api/data/song-versions/${songId}`)
	return await response.json()
}
