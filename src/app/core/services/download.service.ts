import { Injectable, EventEmitter } from '@angular/core'
import { ElectronService } from './electron.service'
import { Download, NewDownload } from '../../../electron/shared/interfaces/download.interface'
import * as _ from 'underscore'

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  private downloadUpdatedEmitter = new EventEmitter<Download>()
  private downloads: Download[] = []

  constructor(private electronService: ElectronService) { }

  addDownload(newDownload: NewDownload) {
    this.electronService.receiveIPC('download-updated', result => {
      this.downloadUpdatedEmitter.emit(result)

      // Update <this.downloads> with result
      const thisDownloadIndex = this.downloads.findIndex(download => download.versionID == result.versionID)
      if (thisDownloadIndex == -1) {
        this.downloads.push(result)
      } else {
        this.downloads[thisDownloadIndex] = result
      }
    })
    this.electronService.sendIPC('add-download', newDownload)
  }

  onDownloadUpdated(callback: (download: Download) => void) {
    this.downloadUpdatedEmitter.subscribe(_.throttle(callback, 30))
  }

  get downloadCount() {
    return this.downloads.length
  }

  removeDownload(versionID: number) {
    const removedDownload = this.downloads.find(download => download.versionID == versionID)
    this.downloads = this.downloads.filter(download => download.versionID != versionID)
    this.downloadUpdatedEmitter.emit(removedDownload)
  }

  get totalPercent() {
    let total = 0
    for (const download of this.downloads) {
      total += download.percent
    }
    return total / this.downloads.length
  }
}