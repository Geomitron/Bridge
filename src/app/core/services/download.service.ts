import { Injectable, EventEmitter } from '@angular/core'
import { ElectronService } from './electron.service'
import { Download, NewDownload } from '../../../electron/shared/interfaces/download.interface'

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  private downloadUpdatedEmitter = new EventEmitter<Download>()

  constructor(private electronService: ElectronService) { }

  addDownload(newDownload: NewDownload) {
    this.electronService.receiveIPC('download-updated', result => {
      this.downloadUpdatedEmitter.emit(result)
    })
    this.electronService.sendIPC('add-download', newDownload)
  }

  onDownloadUpdated(callback: (download: Download) => void) {
    this.downloadUpdatedEmitter.subscribe(callback)
  }
}