import { Component, AfterViewInit, Input, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core'
import { SongResult } from '../../../../../electron/shared/interfaces/search.interface'

@Component({
  selector: 'tr[app-result-table-row]',
  templateUrl: './result-table-row.component.html',
  styleUrls: ['./result-table-row.component.scss']
})
export class ResultTableRowComponent implements AfterViewInit {
  @Input() result: SongResult
  @Output() songChecked = new EventEmitter<SongResult>()
  @Output() songUnchecked = new EventEmitter<SongResult>()

  @ViewChild('checkbox', { static: true }) checkbox: ElementRef

  constructor() { }

  ngAfterViewInit() {
    $(this.checkbox.nativeElement).checkbox({
      onChecked: () => {
        this.songChecked.emit(this.result)
      },
      onUnchecked: () => {
        this.songUnchecked.emit(this.result)
      }
    })
  }

  check(isChecked: boolean) {
    if (isChecked) {
      $(this.checkbox.nativeElement).checkbox('check')
      this.songChecked.emit(this.result)
    } else {
      $(this.checkbox.nativeElement).checkbox('uncheck')
      this.songUnchecked.emit(this.result)
    }
  }
}