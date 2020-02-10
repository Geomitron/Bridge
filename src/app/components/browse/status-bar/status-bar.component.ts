import { Component, ChangeDetectorRef } from '@angular/core'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'
import { DownloadService } from 'src/app/core/services/download.service'

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

  resultCount = 0
  downloading = false
  percent = 0
  selectedResults: SongResult[] = []

  constructor(downloadService: DownloadService, ref: ChangeDetectorRef) {
    downloadService.onDownloadUpdated(() => {
      this.downloading = downloadService.downloadCount > 0
      this.percent = downloadService.totalPercent
      ref.detectChanges()
    })
  }

  showDownloads() {
    $('#downloadsModal').modal('show')
  }
}