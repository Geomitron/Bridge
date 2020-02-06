import { Component, AfterViewInit, Input } from '@angular/core'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements AfterViewInit {
  @Input() results: SongResult[]

  constructor() { }
  
  ngAfterViewInit() {
    $('.ui.checkbox').checkbox()
  }
}