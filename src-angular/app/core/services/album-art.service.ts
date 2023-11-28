import { Injectable } from '@angular/core'

import { ElectronService } from './electron.service'

@Injectable({
	providedIn: 'root',
})
export class AlbumArtService {

	private imageCache: { [songID: number]: string } = {}

	constructor(private electronService: ElectronService) { }

	async getImage(songID: number): Promise<string | null> {
		if (this.imageCache[songID] == undefined) {
			const albumArtResult = await this.electronService.invoke('album-art', songID)
			if (albumArtResult) {
				this.imageCache[songID] = albumArtResult.base64Art
			} else {
				this.imageCache[songID] = null
			}
		}

		return this.imageCache[songID]
	}
}
