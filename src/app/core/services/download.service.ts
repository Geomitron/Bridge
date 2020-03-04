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

  constructor(private electronService: ElectronService) {
    process.setMaxListeners(100)
  }

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
    if (!this.downloads.find(download => download.versionID == versionID)) { // Don't download something twice
      this.electronService.receiveIPC('download-updated', result => {
        // Update <this.downloads> with result
        const thisDownloadIndex = this.downloads.findIndex(download => download.versionID == result.versionID)
        if (thisDownloadIndex == -1) {
          this.downloads.push(result)
          // TODO: this.downloads.sort(downloadSorter)
        } else {
          this.downloads[thisDownloadIndex] = result
        }

        this.downloadUpdatedEmitter.emit(result)
      })
      this.electronService.sendIPC('download', { action: 'add', versionID, data: newDownload })
    }
  }

  onDownloadUpdated(callback: (download: DownloadProgress) => void) {
    const debouncedCallback = _.throttle(callback, 30)
    this.downloadUpdatedEmitter.subscribe((download: DownloadProgress) => {
      if (download.type == 'fastUpdate') { // 'good' updates can happen so frequently that the UI doesn't update correctly
        debouncedCallback(download)
      } else {
        callback(download)
      }
    })
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