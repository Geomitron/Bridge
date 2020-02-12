import { Component, Input, Output, EventEmitter, ViewChildren, QueryList, ViewChild } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'
import { CheckboxDirective } from 'src/app/core/directives/checkbox.directive'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent {
  @Input() results: SongResult[]

  @Output() rowClicked = new EventEmitter<SongResult>()
  @Output() songChecked = new EventEmitter<SongResult>()
  @Output() songUnchecked = new EventEmitter<SongResult>()

  @ViewChild(CheckboxDirective, { static: true }) checkboxColumn: CheckboxDirective
  @ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

  constructor() { }

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

  onNewSearch() {
    this.checkboxColumn.check(false)
  }
}