import { Component, ChangeDetectorRef } from '@angular/core'
import { Download } from '../../../../../electron/shared/interfaces/download.interface'
import { DownloadService } from '../../../../core/services/download.service'

@Component({
  selector: 'app-downloads-modal',
  templateUrl: './downloads-modal.component.html',
  styleUrls: ['./downloads-modal.component.scss']
})
export class DownloadsModalComponent {

  downloads: Download[] = []

  constructor(downloadService: DownloadService, ref: ChangeDetectorRef) {
    downloadService.onDownloadUpdated(download => {
      const index = this.downloads.findIndex(thisDownload => thisDownload.versionID == download.versionID)
      if (index == -1) {
        this.downloads.push(download)
      } else {
        this.downloads[index] = download
      }
      ref.detectChanges()
    })
  }

  trackByVersionID(_index: number, item: Download) {
    return item.versionID
  }
}