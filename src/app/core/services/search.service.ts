import { Injectable, EventEmitter } from '@angular/core'
import { ElectronService } from './electron.service'
import { SearchType, SongResult, SongSearch } from 'src/electron/shared/interfaces/search.interface'
import { VersionResult } from 'src/electron/shared/interfaces/songDetails.interface'

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  private resultsChangedEmitter = new EventEmitter<SongResult[]>() // For when any results change
  private newResultsEmitter = new EventEmitter<SongResult[]>()     // For when a new search happens
  private results: SongResult[] = []
  private awaitingResults = false
  private currentQuery: SongSearch
  private _allResultsVisible = true

  constructor(private electronService: ElectronService) { }

  async newSearch(query: string) {
    if (this.awaitingResults) { return }
    this.awaitingResults = true
    this.currentQuery = { query, type: SearchType.Any, offset: 0, length: 50 + 1 } // TODO: make length a setting
    try {
      this.results = this.trimLastChart(await this.electronService.invoke('song-search', this.currentQuery))
    } catch (err) {
      this.results = []
      this.resultsChangedEmitter.error(undefined)
    }
    this.awaitingResults = false

    this.resultsChangedEmitter.emit(this.results)
    this.newResultsEmitter.emit(this.results)
  }

  isLoading() {
    return this.awaitingResults
  }

  /**
   * Event emitted when new search results are returned
   * or when more results are added to an existing search.
   * (emitted before `onNewSearch`)
   */
  onSearchChanged(callback: (results: SongResult[]) => void) {
    this.resultsChangedEmitter.subscribe(callback)
  }

  /**
   * Event emitted when a new search query is typed in.
   * (emitted after `onSearchChanged`)
   */
  onNewSearch(callback: (results: SongResult[]) => void) {
    this.newResultsEmitter.subscribe(callback)
  }

  /**
   * Event emitted when a search fails.
   * (emitted before `onSearchChanged`)
   */
  onSearchError(callback: () => void) {
    this.resultsChangedEmitter.subscribe(() => { /** Do nothing */ }, callback)
  }

  get resultCount() {
    return this.results.length
  }

  async updateScroll() {
    if (!this.awaitingResults && !this._allResultsVisible) {
      this.awaitingResults = true
      this.currentQuery.offset += 20
      this.results.push(...this.trimLastChart(await this.electronService.invoke('song-search', this.currentQuery)))
      this.awaitingResults = false

      this.resultsChangedEmitter.emit(this.results)
    }
  }

  trimLastChart(results: SongResult[]) {
    if (results.length > 20) {
      results.splice(20, 1)
      this._allResultsVisible = false
    } else {
      this._allResultsVisible = true
    }

    return results
  }

  get allResultsVisible() {
    return this._allResultsVisible
  }

  /**
   * Orders `versionResults` by lastModified date, but prefer the
   * non-pack version if it's only a few days older.
   */
  sortChart(versionResults: VersionResult[]) {
    const dates: { [versionID: number]: number } = {}
    versionResults.forEach(version => dates[version.versionID] = new Date(version.lastModified).getTime())
    versionResults.sort((v1, v2) => {
      const diff = dates[v2.versionID] - dates[v1.versionID]
      if (Math.abs(diff) < 6.048e+8 && v1.driveData.inChartPack != v2.driveData.inChartPack) {
        if (v1.driveData.inChartPack) {
          return 1 // prioritize v2
        } else {
          return -1 // prioritize v1
        }
      } else {
        return diff
      }
    })
  }
}