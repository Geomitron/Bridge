import { Injectable } from '@angular/core'
import { ElectronService } from './electron.service'

@Injectable({
  providedIn: 'root'
})
export class AlbumArtService {

  constructor(private electronService: ElectronService) { }

  private imageCache: { [songID: number]: Buffer } = {}

  async getImage(songID: number): Promise<Buffer | null> {
    if (this.imageCache[songID] == undefined) {
      const albumArtResult = await this.electronService.invoke('album-art', songID)
      if (albumArtResult) {
        this.imageCache[songID] = albumArtResult.art
      } else {
        this.imageCache[songID] = null
      }
    }

    return this.imageCache[songID]
  }
}