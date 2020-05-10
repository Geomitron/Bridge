import { Component, Output, EventEmitter, ViewChildren, QueryList, ViewChild, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'
import { CheckboxDirective } from 'src/app/core/directives/checkbox.directive'
import { SearchService } from 'src/app/core/services/search.service'
import { SelectionService } from 'src/app/core/services/selection.service'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements OnInit {

  @Output() rowClicked = new EventEmitter<SongResult>()

  @ViewChild(CheckboxDirective, { static: true }) checkboxColumn: CheckboxDirective
  @ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

  results: SongResult[]

  constructor(private searchService: SearchService, private selectionService: SelectionService) { }

  ngOnInit() {
    this.selectionService.onSelectAllChanged((selected) => {
      this.checkboxColumn.check(selected)
    })

    this.searchService.onSearchChanged(results => {
      this.results = results
    })
  }

  onRowClicked(result: SongResult) {
    this.rowClicked.emit(result)
  }

  /**
   * Called when the user checks the `checkboxColumn`.
   */
  checkAll(isChecked: boolean) {
    if (isChecked) {
      this.selectionService.selectAll()
    } else {
      this.selectionService.deselectAll()
    }
  }
}