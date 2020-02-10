import { Component, AfterViewInit, Input, Output, EventEmitter } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements AfterViewInit {
  @Input() results: SongResult[]

  @Output() rowClicked = new EventEmitter<SongResult>()

  constructor() { }
  
  ngAfterViewInit() {
    $('.ui.checkbox').checkbox()
  }

  onRowClicked(result: SongResult) {
    this.rowClicked.emit(result)
  }
}