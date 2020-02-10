import { Component, AfterViewInit, Input, Output, EventEmitter, ViewChildren, QueryList } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements AfterViewInit {
  @Input() results: SongResult[]

  @Output() rowClicked = new EventEmitter<SongResult>()
  @Output() songChecked = new EventEmitter<SongResult>()
  @Output() songUnchecked = new EventEmitter<SongResult>()

  @ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

  constructor() { }
  
  ngAfterViewInit() {
    $('.ui.checkbox').checkbox()
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
}