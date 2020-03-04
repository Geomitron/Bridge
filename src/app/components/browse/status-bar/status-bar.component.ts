import { Component, ChangeDetectorRef, Output, EventEmitter } from '@angular/core'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'
import { DownloadService } from 'src/app/core/services/download.service'
import { ElectronService } from 'src/app/core/services/electron.service'
import { groupBy } from 'src/electron/shared/UtilFunctions'
import { VersionResult } from 'src/electron/shared/interfaces/songDetails.interface'

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

  @Output() deselectSongs = new EventEmitter<SongResult['id'][]>()

  resultCount = 0
  downloading = false
  percent = 0
  selectedResults: SongResult[] = []
  batchResults: VersionResult[]
  chartGroups: VersionResult[][]

  constructor(private electronService: ElectronService, private downloadService: DownloadService, ref: ChangeDetectorRef) {
    downloadService.onDownloadUpdated(() => {
      this.downloading = downloadService.downloadCount > 0
      this.percent = downloadService.totalPercent
      ref.detectChanges()
    })
  }

  showDownloads() {
    $('#downloadsModal').modal('show')
  }

  onSongChecked(result: SongResult) {
    if (this.selectedResults.findIndex(oldResult => oldResult.id == result.id) == -1) {
      this.selectedResults.push(result)
    }
  }

  onSongUnchecked(result: SongResult) {
    this.selectedResults = this.selectedResults.filter(oldResult => oldResult.id != result.id)
  }

  async downloadSelected() {
    this.chartGroups = []
    this.batchResults = await this.electronService.invoke('batch-song-details', this.selectedResults.map(result => result.id))
    const versionGroups = groupBy(this.batchResults, 'songID')
    for (const versionGroup of versionGroups) {
      if (versionGroup.findIndex(version => version.chartID != versionGroup[0].chartID) != -1) {
        // Must have multiple charts of this song
        this.chartGroups.push(versionGroup.filter(version => version.versionID == version.latestVersionID))
      }
    }

    if (this.chartGroups.length == 0) {
      for (const versions of versionGroups) {
        const downloadVersion = versions.find(version => version.versionID == version.latestVersionID)
        const downloadSong = this.selectedResults.find(song => song.id == downloadVersion.songID)
        this.downloadService.addDownload(
          downloadVersion.versionID, {
            avTagName: downloadVersion.avTagName,
            artist: downloadSong.artist,
            charter: downloadVersion.charters,
            links: JSON.parse(downloadVersion.downloadLink)
          })
      }
    } else {
      $('#selectedModal').modal('show')
      // [download all charts for each song] [deselect these songs] [X]
    }
  }

  downloadAllCharts() {
    for (const version of this.batchResults) {
      if (version.versionID != version.latestVersionID) { continue }
      const downloadSong = this.selectedResults.find(song => song.id == version.songID)
      this.downloadService.addDownload(
        version.versionID, {
          avTagName: version.avTagName,
          artist: downloadSong.artist,
          charter: version.charters,
          links: JSON.parse(version.downloadLink)
        })
    }
  }

  deselectSongsWithMultipleCharts() {
    this.deselectSongs.emit(this.chartGroups.map(group => group[0].songID))
  }
}