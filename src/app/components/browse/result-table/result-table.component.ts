import { Component, Output, EventEmitter, ViewChildren, QueryList, ViewChild, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'
import { CheckboxDirective } from 'src/app/core/directives/checkbox.directive'
import { SearchService } from 'src/app/core/services/search.service'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements OnInit {
  
  @Output() rowClicked = new EventEmitter<SongResult>()
  @Output() songChecked = new EventEmitter<SongResult>()
  @Output() songUnchecked = new EventEmitter<SongResult>()
  
  @ViewChild(CheckboxDirective, { static: true }) checkboxColumn: CheckboxDirective
  @ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>
  
  results: SongResult[]

  constructor(private searchService: SearchService) { }

  ngOnInit() {
    this.searchService.onNewSearch(() => {
      this.checkboxColumn.check(false)
      this.checkAll(false)
    })

    this.searchService.onSearchChanged(results => {
      this.results = results
      if (this.checkboxColumn.isChecked) {
        this.checkAll(true)
      }
    })
  }

  onRowClicked(result: SongResult) {
    this.rowClicked.emit(result)
  }

  onSongChecked(result: SongResult) {
    this.songChecked.emit(result)
  }

  onSongUnchecked(result: SongResult) {
    this.songUnchecked.emit(result)
  }

  checkAll(isChecked: boolean) {
    this.tableRows.forEach(row => row.check(isChecked))
  }

  onSongsDeselected(songs: SongResult['id'][]) {
    this.tableRows.forEach(row => row.check(!songs.includes(row.songID)))
  }
}