import { Injectable, EventEmitter } from '@angular/core'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'
import { SearchService } from './search.service'

// Note: this class prevents event cycles by only emitting events if the checkbox changes

interface SelectionEvent {
  songID: number
  selected: boolean
}

@Injectable({
  providedIn: 'root'
})
export class SelectionService {

  private searchResults: SongResult[] = []

  private selectAllChangedEmitter = new EventEmitter<boolean>()
  private selectionChangedEmitter = new EventEmitter<SelectionEvent>()

  private allSelected = false
  private selections: { [songID: number]: boolean | undefined } = {}

  constructor(searchService: SearchService) {
    searchService.onSearchChanged((results) => {
      this.searchResults = results
      if (this.allSelected) {
        this.selectAll() // Select newly added rows if allSelected
      }
    })

    searchService.onNewSearch((results) => {
      this.searchResults = results
      this.deselectAll()
    })
  }

  getSelectedResults() {
    return this.searchResults.filter(result => this.selections[result.id] == true)
  }

  onSelectAllChanged(callback: (selected: boolean) => void) {
    this.selectAllChangedEmitter.subscribe(callback)
  }

  /**
   * Emits an event when the selection for `songID` needs to change.
   * (note: only one emitter can be registered per `songID`)
   */
  onSelectionChanged(songID: number, callback: (selection: boolean) => void) {
    this.selectionChangedEmitter.subscribe((selection: SelectionEvent) => {
      if (selection.songID == songID) {
        callback(selection.selected)
      }
    })
  }


  deselectAll() {
    if (this.allSelected) {
      this.allSelected = false
      this.selectAllChangedEmitter.emit(false)
    }

    setTimeout(() => this.searchResults.forEach(result => this.deselectSong(result.id)), 0)
  }

  selectAll() {
    if (!this.allSelected) {
      this.allSelected = true
      this.selectAllChangedEmitter.emit(true)
    }

    setTimeout(() => this.searchResults.forEach(result => this.selectSong(result.id)), 0)
  }

  deselectSong(songID: number) {
    if (this.selections[songID]) {
      this.selections[songID] = false
      this.selectionChangedEmitter.emit({ songID, selected: false })
    }
  }

  selectSong(songID: number) {
    if (!this.selections[songID]) {
      this.selections[songID] = true
      this.selectionChangedEmitter.emit({ songID, selected: true })
    }
  }
}