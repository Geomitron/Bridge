import { Component, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ElectronService } from '../../../core/services/electron.service'
import { VersionResult } from '../../../../electron/shared/interfaces/songDetails.interface'
import { AlbumArtService } from '../../../core/services/album-art.service'
import { DownloadService } from '../../../core/services/download.service'
import { groupBy } from 'src/electron/shared/UtilFunctions'
import { SearchService } from 'src/app/core/services/search.service'

@Component({
  selector: 'app-chart-sidebar',
  templateUrl: './chart-sidebar.component.html',
  styleUrls: ['./chart-sidebar.component.scss']
})
export class ChartSidebarComponent implements OnInit {

  private songResult: SongResult
  selectedVersion: VersionResult
  charts: VersionResult[][]

  constructor(
    private electronService: ElectronService,
    private albumArtService: AlbumArtService,
    private downloadService: DownloadService,
    private searchService: SearchService
  ) { }

  ngOnInit() {
    this.searchService.onNewSearch(() => {
      this.selectVersion(undefined)
    })
  }

  /**
   * Displays the information for the selected song.
   */
  async onRowClicked(result: SongResult) {
    if (this.songResult == undefined || result.id != this.songResult.id) { // Clicking the same row again will not reload
      this.songResult = result
      const albumArt = this.albumArtService.getImage(result.id)
      const results = await this.electronService.invoke('song-details', result.id)
      this.charts = groupBy(results, 'chartID').sort((v1, v2) => v1[0].avTagName.length - v2[0].avTagName.length)
      this.charts.forEach(chart => chart.sort((v1, v2) => v2.lastModified - v1.lastModified))
      await this.selectChart(0)
      this.initChartDropdown()

      this.updateAlbumArtSrc(await albumArt)
    }
  }

  albumArtSrc = ''
  /**
   * Updates the sidebar to display the album art.
   */
  updateAlbumArtSrc(albumArtBuffer?: Buffer) {
    if (albumArtBuffer) {
      this.albumArtSrc = 'data:image/jpg;base64,' + albumArtBuffer.toString('base64')
    } else {
      this.albumArtSrc = ''
    }
  }

  /**
   * Initializes the chart dropdown from `this.charts` (or removes it if there's only one chart).
   */
  private initChartDropdown() {
    const values = this.charts.map(chart => {
      const version = chart[0]
      return {
        value: version.chartID,
        text: version.avTagName,
        name: `${version.avTagName} <b>[${version.charters}]</b>`
      }
    })
    const $chartDropdown = $('#chartDropdown')
    $chartDropdown.dropdown('setup menu', { values })
    $chartDropdown.dropdown('setting', 'onChange', (chartID: number) => this.selectChart(chartID))
    $chartDropdown.dropdown('set selected', values[0].value)
  }

  private async selectChart(chartID: number) {
    const chart = this.charts.find(chart => chart[0].chartID == chartID)
    await this.selectVersion(chart[0])
    this.initVersionDropdown()
  }

  /**
   * Updates the sidebar to display the metadata for `selectedVersion`.
   */
  async selectVersion(selectedVersion: VersionResult) {
    this.selectedVersion = selectedVersion
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0)) // Wait for *ngIf to update DOM

    if (this.selectedVersion != undefined) {
      this.updateCharterPlural()
      this.updateSongLength()
      this.updateDownloadButtonText()
    }
  }

  charterPlural: string
  /**
   * Chooses to display 'Charter:' or 'Charters:'.
   */
  updateCharterPlural() {
    this.charterPlural = this.selectedVersion.charterIDs.split('&').length == 1 ? 'Charter:' : 'Charters:'
  }

  songLength: string
  /**
   * Converts <this.selectedVersion.song_length> into a readable duration.
   */
  updateSongLength() {
    if (this.selectedVersion.song_length == 0) {
      this.songLength = 'Unknown'
    }
    let seconds = Math.round(this.selectedVersion.song_length / 1000)
    if (seconds < 60) {
      this.songLength = `${seconds} second${seconds == 1 ? '' : 's'}`
    }
    let minutes = Math.floor(seconds / 60)
    let hours = 0
    while (minutes > 59) {
      hours++
      minutes -= 60
    }
    seconds = Math.floor(seconds % 60)
    this.songLength = `${hours == 0 ? '' : hours + ':'}${minutes == 0 ? '' : minutes + ':'}${seconds < 10 ? '0' + seconds : seconds}`
  }

  downloadButtonText: string
  /**
   * Chooses the text to display on the download button.
   */
  updateDownloadButtonText() {
    if (this.getSelectedChartVersions().length <= 1) {
      this.downloadButtonText = 'Download'
    } else if (this.selectedVersion.versionID == this.selectedVersion.latestVersionID) {
      this.downloadButtonText = 'Download Latest'
    } else {
      this.downloadButtonText = `Download (${this.getLastModifiedText(this.selectedVersion.lastModified)})`
    }
  }

  /**
   * Initializes the version dropdown from `this.selectedVersion` (or removes it if there's only one version).
   */
  private initVersionDropdown() {
    const $versionDropdown = $('#versionDropdown')
    const versions = this.getSelectedChartVersions()
    const values = versions.map(version => ({
      value: version.versionID,
      text: this.getLastModifiedText(version.lastModified),
      name: this.getLastModifiedText(version.lastModified)
    }))

    $versionDropdown.dropdown('setup menu', { values })
    $versionDropdown.dropdown('setting', 'onChange', (versionID: number) => {
      this.selectVersion(versions.find(version => version.versionID == versionID))
    })
    $versionDropdown.dropdown('set selected', values[0].value)
  }

  /**
   * Returns the list of versions for the selected chart, sorted by `lastModified`.
   */
  getSelectedChartVersions() {
    return this.charts.find(chart => chart[0].chartID == this.selectedVersion.chartID)
  }

  /**
   * Converts the <lastModified> value to a user-readable format.
   * @param lastModified The UNIX timestamp for the lastModified date.
   */
  private getLastModifiedText(lastModified: number) {
    return new Date(lastModified).toLocaleDateString()
  }

  /**
   * Adds the selected version to the download queue.
   */
  onDownloadClicked() {
    this.downloadService.addDownload(
      this.selectedVersion.versionID, {
      avTagName: this.selectedVersion.avTagName,
      artist: this.songResult.artist,
      charter: this.selectedVersion.charters, //TODO: get the charter name associated with this particular version
      links: JSON.parse(this.selectedVersion.downloadLink)
    })
  }
}