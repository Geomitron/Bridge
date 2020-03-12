import { Injectable, EventEmitter } from '@angular/core'
import { ElectronService } from './electron.service'
import { SearchType, SongResult } from 'src/electron/shared/interfaces/search.interface'

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  private resultsChangedEmitter = new EventEmitter<SongResult[]>() // For when any results change
  private newResultsEmitter = new EventEmitter<SongResult[]>()     // For when a new search happens
  private results: SongResult[] = []

  constructor(private electronService: ElectronService) { }

  async newSearch(query: string) {
    this.results = await this.electronService.invoke('song-search', { query, type: SearchType.Any })
    this.newResultsEmitter.emit(this.results)
    this.resultsChangedEmitter.emit(this.results)
  }

  onSearchChanged(callback: (results: SongResult[]) => void) {
    this.resultsChangedEmitter.subscribe(callback)
  }

  onNewSearch(callback: (results: SongResult[]) => void) {
    this.newResultsEmitter.subscribe(callback)
  }

  get resultCount() {
    return this.results.length
  }
}
