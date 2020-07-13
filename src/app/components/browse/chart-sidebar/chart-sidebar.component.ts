import { Component, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ElectronService } from '../../../core/services/electron.service'
import { VersionResult } from '../../../../electron/shared/interfaces/songDetails.interface'
import { AlbumArtService } from '../../../core/services/album-art.service'
import { DownloadService } from '../../../core/services/download.service'
import { groupBy } from 'src/electron/shared/UtilFunctions'
import { SearchService } from 'src/app/core/services/search.service'
import { DomSanitizer, SafeUrl } from '@angular/platform-browser'

@Component({
  selector: 'app-chart-sidebar',
  templateUrl: './chart-sidebar.component.html',
  styleUrls: ['./chart-sidebar.component.scss']
})
export class ChartSidebarComponent implements OnInit {

  songResult: SongResult
  selectedVersion: VersionResult
  charts: VersionResult[][]

  constructor(
    private electronService: ElectronService,
    private albumArtService: AlbumArtService,
    private downloadService: DownloadService,
    private searchService: SearchService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.searchService.onNewSearch(() => {
      this.selectVersion(undefined)
      this.songResult = undefined
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
      this.sortCharts()
      await this.selectChart(0)
      this.initChartDropdown()

      this.updateAlbumArtSrc(await albumArt)
    }
  }

  /**
   * Sorts `this.charts` and its subarrays in the correct order.
   * The chart dropdown should display in a random order, but verified charters are prioritized.
   * The version dropdown should be ordered by lastModified date.
   * (but prefer the non-pack version if it's only a few days older)
   */
  private sortCharts() {
    for (const chart of this.charts) {
      // TODO: sort by verified charter
      this.searchService.sortChart(chart)
    }
  }

  albumArtSrc: SafeUrl = ''
  /**
   * Updates the sidebar to display the album art.
   */
  updateAlbumArtSrc(albumArtBase64String?: string) {
    if (albumArtBase64String) {
      this.albumArtSrc = this.sanitizer.bypassSecurityTrustUrl('data:image/jpg;base64,' + albumArtBase64String)
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
   * Converts `this.selectedVersion.chartMetadata.length` into a readable duration.
   */
  updateSongLength() {
    let seconds = this.selectedVersion.chartMetadata.length
    if (seconds < 60) { this.songLength = `${seconds} second${seconds == 1 ? '' : 's'}`; return }
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
    this.downloadButtonText = 'Download'
    if (this.selectedVersion.driveData.inChartPack) {
      this.downloadButtonText += ' Chart Pack'
    } else {
      this.downloadButtonText += (this.selectedVersion.driveData.isArchive ? ' Archive' : ' Files')
    }

    if (this.getSelectedChartVersions().length > 1) {
      if (this.selectedVersion.versionID == this.selectedVersion.latestVersionID) {
        this.downloadButtonText += ' (Latest)'
      } else {
        this.downloadButtonText += ` (${this.getLastModifiedText(this.selectedVersion.lastModified)})`
      }
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
      text: 'Uploaded ' + this.getLastModifiedText(version.lastModified),
      name: 'Uploaded ' + this.getLastModifiedText(version.lastModified)
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
  private getLastModifiedText(lastModified: string) {
    const date = new Date(lastModified)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString().substr(-2)
    return `${month}/${day}/${year}`
  }

  /**
   * Adds the selected version to the download queue.
   */
  onDownloadClicked() {
    this.downloadService.addDownload(
      this.selectedVersion.versionID, {
        avTagName: this.selectedVersion.avTagName,
        artist: this.songResult.artist,
        charter: this.selectedVersion.charters,
        driveData: this.selectedVersion.driveData
      })
  }
}