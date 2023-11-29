import { serverURL } from '../../../src-shared/Paths'

export async function getBatchSongDetails(songIds: number[]) {
	const response = await fetch(`https://${serverURL}/api/data/song-versions/${songIds.join(',')}`)
	return await response.json()
}
