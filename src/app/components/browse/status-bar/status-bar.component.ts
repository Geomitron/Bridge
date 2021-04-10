import { Component, ChangeDetectorRef } from '@angular/core'
import { DownloadService } from '../../../core/services/download.service'
import { ElectronService } from '../../../core/services/electron.service'
import { groupBy } from '../../../../electron/shared/UtilFunctions'
import { VersionResult } from '../../../../electron/shared/interfaces/songDetails.interface'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

  resultCount = 0
  multipleCompleted = false
  downloading = false
  error = false
  percent = 0
  batchResults: VersionResult[]
  chartGroups: VersionResult[][]

  constructor(
    private electronService: ElectronService,
    private downloadService: DownloadService,
    private searchService: SearchService,
    private selectionService: SelectionService,
    ref: ChangeDetectorRef
  ) {
    downloadService.onDownloadUpdated(() => {
      setTimeout(() => { // Make sure this is the last callback executed to get the accurate downloadCount
        this.downloading = downloadService.downloadCount > 0
        this.multipleCompleted = downloadService.completedCount > 1
        this.percent = downloadService.totalDownloadingPercent
        this.error = downloadService.anyErrorsExist
        ref.detectChanges()
      }, 0)
    })

    searchService.onSearchChanged(() => {
      this.resultCount = searchService.resultCount
    })
  }

  get allResultsVisible() {
    return this.searchService.allResultsVisible
  }

  get selectedResults() {
    return this.selectionService.getSelectedResults()
  }

  showDownloads() {
    $('#downloadsModal').modal('show')
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
        this.searchService.sortChart(versions)
        const downloadVersion = versions[0]
        const downloadSong = this.selectedResults.find(song => song.id == downloadVersion.songID)
        this.downloadService.addDownload(
          downloadVersion.versionID, {
            chartName: downloadVersion.chartName,
            artist: downloadSong.artist,
            charter: downloadVersion.charters,
            driveData: downloadVersion.driveData
          })
      }
    } else {
      $('#selectedModal').modal('show')
      // [download all charts for each song] [deselect these songs] [X]
    }
  }

  downloadAllCharts() {
    const songChartGroups = groupBy(this.batchResults, 'songID', 'chartID')
    for (const chart of songChartGroups) {
      this.searchService.sortChart(chart)
      const downloadVersion = chart[0]
      const downloadSong = this.selectedResults.find(song => song.id == downloadVersion.songID)
      this.downloadService.addDownload(
        downloadVersion.versionID, {
          chartName: downloadVersion.chartName,
          artist: downloadSong.artist,
          charter: downloadVersion.charters,
          driveData: downloadVersion.driveData
        }
      )
    }
  }

  deselectSongsWithMultipleCharts() {
    for (const chartGroup of this.chartGroups) {
      this.selectionService.deselectSong(chartGroup[0].songID)
    }
  }

  clearCompleted() {
    this.downloadService.cancelCompleted()
  }
}