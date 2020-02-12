import { Component, ChangeDetectorRef } from '@angular/core'
import { DownloadProgress } from '../../../../../electron/shared/interfaces/download.interface'
import { DownloadService } from '../../../../core/services/download.service'

@Component({
  selector: 'app-downloads-modal',
  templateUrl: './downloads-modal.component.html',
  styleUrls: ['./downloads-modal.component.scss']
})
export class DownloadsModalComponent {

  downloads: DownloadProgress[] = []

  constructor(private downloadService: DownloadService, ref: ChangeDetectorRef) {
    downloadService.onDownloadUpdated(download => {
      const index = this.downloads.findIndex(thisDownload => thisDownload.versionID == download.versionID)
      if (index == -1) {
        this.downloads.push(download)
      } else if (download.type == 'cancel') {
        this.downloads.splice(index, 1)
      } else {
        this.downloads[index] = download
      }
      ref.detectChanges()
    })
  }

  trackByVersionID(_index: number, item: DownloadProgress) {
    return item.versionID
  }

  cancelDownload(versionID: number) {
    this.downloadService.cancelDownload(versionID)
  }

  retryDownload(versionID: number) {
    this.downloadService.retryDownload(versionID)
  }

  continueDownload(versionID: number) {
    // TODO: test this
    this.downloadService.continueDownload(versionID)
  }

  getBackgroundColor(download: DownloadProgress) {
    switch(download.type) {
      case 'good': return 'unset'
      case 'warning': return 'yellow'
      case 'error': return 'indianred'
    }
  }
}