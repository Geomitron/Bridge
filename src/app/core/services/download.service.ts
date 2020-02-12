import { Injectable, EventEmitter } from '@angular/core'
import { ElectronService } from './electron.service'
import { NewDownload, DownloadProgress } from '../../../electron/shared/interfaces/download.interface'
import * as _ from 'underscore'

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  private downloadUpdatedEmitter = new EventEmitter<DownloadProgress>()
  private downloads: DownloadProgress[] = []

  constructor(private electronService: ElectronService) { }

  get downloadCount() {
    return this.downloads.length
  }

  get totalPercent() {
    let total = 0
    for (const download of this.downloads) {
      total += download.percent
    }
    return total / this.downloads.length
  }

  addDownload(versionID: number, newDownload: NewDownload) {
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
    this.electronService.sendIPC('download', { action: 'add', versionID, data: newDownload })
  }

  onDownloadUpdated(callback: (download: DownloadProgress) => void) {
    this.downloadUpdatedEmitter.subscribe(_.throttle(callback, 30))
  }

  cancelDownload(versionID: number) {
    const removedDownload = this.downloads.find(download => download.versionID == versionID)
    this.downloads = this.downloads.filter(download => download.versionID != versionID)
    removedDownload.type = 'cancel'
    this.downloadUpdatedEmitter.emit(removedDownload)
    this.electronService.sendIPC('download', { action: 'cancel', versionID })
  }

  retryDownload(versionID: number) {
    this.electronService.sendIPC('download', { action: 'retry', versionID })
  }

  continueDownload(versionID: number) {
    this.electronService.sendIPC('download', { action: 'continue', versionID })
  }
}