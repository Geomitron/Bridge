import { Component, ChangeDetectorRef } from '@angular/core'
import { Download } from '../../../../../electron/shared/interfaces/download.interface'
import { DownloadService } from '../../../../core/services/download.service'
import * as _ from 'underscore'

@Component({
  selector: 'app-downloads-modal',
  templateUrl: './downloads-modal.component.html',
  styleUrls: ['./downloads-modal.component.scss']
})
export class DownloadsModalComponent {

  downloads: Download[] = []

  constructor(downloadService: DownloadService, private ref: ChangeDetectorRef) {
    const detectChanges = _.throttle(() => this.ref.detectChanges(), 30)
    downloadService.onDownloadUpdated(download => {
      const index = this.downloads.findIndex(thisDownload => thisDownload.versionID == download.versionID)
      if (index == -1) {
        this.downloads.push(download)
      } else {
        this.downloads[index] = download
      }
      detectChanges()
    })
  }

  trackByVersionID(_index: number, item: Download) {
    return item.versionID
  }
}