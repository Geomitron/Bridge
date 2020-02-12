import { Component } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ElectronService } from '../../../core/services/electron.service'
import { VersionResult } from '../../../../electron/shared/interfaces/songDetails.interface'
import { AlbumArtService } from '../../../core/services/album-art.service'
import { DownloadService } from '../../../core/services/download.service'

@Component({
  selector: 'app-chart-sidebar',
  templateUrl: './chart-sidebar.component.html',
  styleUrls: ['./chart-sidebar.component.scss']
})
export class ChartSidebarComponent {

  private songResult: SongResult
  selectedVersion: VersionResult
  charterPlural: string
  albumArtBuffer: Buffer

  charts: { chartID: number, versions: VersionResult[] }[]

  constructor(private electronService: ElectronService, private albumArtService: AlbumArtService, private downloadService: DownloadService) { }

  async onRowClicked(result: SongResult) {
    this.songResult = result
    const albumArt = this.albumArtService.getImage(result.id)
    const results = await this.electronService.invoke('song-details', result.id)

    // Group results by chartID
    this.charts = []
    for (const result of results) {
      const matchingChart = this.charts.find(chart => chart.chartID == result.chartID)
      if (matchingChart != undefined) {
        matchingChart.versions.push(result)
      } else {
        this.charts.push({ chartID: result.chartID, versions: [result] })
      }
    }
    this.initChartDropdown()

    this.albumArtBuffer = await albumArt
  }

  getAlbumArtSrc() {
    if (this.albumArtBuffer) {
      return 'data:image/jpg;base64,' + this.albumArtBuffer.toString('base64')
    } else {
      return ''
    }
  }

  /**
   * Initializes the chart dropdown from <this.charts> (or removes it if there's only one chart)
   */
  private async initChartDropdown() {
    this.switchChart(this.charts[0].chartID)
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0)) // Wait for *ngIf to update DOM
    const values = this.charts.map(chart => {
      const version = chart.versions[0]
      return {
        value: chart.chartID,
        text: version.avTagName,
        name: `${version.avTagName} <b>[${version.charters}]</b>`
      }
    })
    const $chartDropdown = $('#chartDropdown')
    $chartDropdown.dropdown('setup menu', { values })
    $chartDropdown.dropdown('setting', 'onChange', (chartID: number) => this.switchChart(chartID))
    $chartDropdown.dropdown('set selected', values[0].value)
  }

  /**
   * Updates the sidebar to display the metadata for the chart with <chartID>.
   * @param chartID The ID of the chart to display.
   */
  private switchChart(chartID: number) {
    const chart = this.charts.find(chart => chart.chartID == chartID)
    this.selectedVersion = chart.versions[0]
    this.charterPlural = this.selectedVersion.charterIDs.split('&').length == 1 ? 'Charter:' : 'Charters:'
    this.initVersionDropdown()
  }

  /**
   * Converts <this.selectedVersion.song_length> into a readable duration.
   */
  getSongLength() {
    if (this.selectedVersion.song_length == 0) {
      return 'Unknown'
    }
    let seconds = Math.round(this.selectedVersion.song_length / 1000)
    let minutes = Math.floor(seconds / 60)
    let hours = 0
    while (minutes > 59) {
      hours++
      minutes -= 60
    }
    seconds = Math.floor(seconds % 60)
    return `${hours == 0 ? '' : hours + ':'}${minutes == 0 ? '' : minutes + ':'}${seconds < 10 ? '0' + seconds : seconds}`
  }

  /**
   * Initializes the version dropdown from <this.selectedVersion> (or removes it if there's only one version)
   */
  private initVersionDropdown() {
    const $versionDropdown = $('#versionDropdown')
    const versions = this.getVersions()
    const values = versions.map(version => {
      return {
        value: version.versionID,
        text: this.getLastModified(version.lastModified),
        name: this.getLastModified(version.lastModified)
      }
    })
    $versionDropdown.dropdown('setup menu', { values })
    $versionDropdown.dropdown('setting', 'onChange', (versionID: number) => {
      console.log(`Selected version: ${versionID}`)
      this.selectedVersion = versions.find(version => version.versionID = versionID)
    })
    $versionDropdown.dropdown('set selected', values[0].value)
  }

  /**
   * Converts the <lastModified> value to a user-readable format.
   * @param lastModified The UNIX timestamp for the lastModified date.
   */
  private getLastModified(lastModified: number) {
    return new Date(lastModified).toLocaleDateString()
  }

  onDownloadClicked() {
    this.downloadService.addDownload(
      this.selectedVersion.versionID, {
      avTagName: this.selectedVersion.avTagName,
      artist: this.songResult.artist,
      charter: this.selectedVersion.charters,
      links: JSON.parse(this.selectedVersion.downloadLink)
    })
  }

  getVersions() {
    return this.charts.find(chart => chart.chartID == this.selectedVersion.chartID).versions
  }
}