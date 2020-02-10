import { Component, AfterViewInit, Input } from '@angular/core'
import { SongResult } from '../../../../../electron/shared/interfaces/search.interface'

@Component({
  selector: 'tr[app-result-table-row]',
  templateUrl: './result-table-row.component.html',
  styleUrls: ['./result-table-row.component.scss']
})
export class ResultTableRowComponent implements AfterViewInit {
  @Input() result: SongResult

  constructor() { }
  
  ngAfterViewInit() {
    $('.ui.checkbox').checkbox()
  }
}