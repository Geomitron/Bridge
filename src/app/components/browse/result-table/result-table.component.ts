import { Component, Output, EventEmitter, ViewChildren, QueryList, ViewChild, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'
import { CheckboxDirective } from '../../../core/directives/checkbox.directive'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { SettingsService } from 'src/app/core/services/settings.service'

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
  activeRowID: number = null

  constructor(
    private searchService: SearchService,
    private selectionService: SelectionService,
    public settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.selectionService.onSelectAllChanged((selected) => {
      this.checkboxColumn.check(selected)
    })

    this.searchService.onSearchChanged(results => {
      this.activeRowID = null
      this.results = results
    })
  }

  onRowClicked(result: SongResult) {
    this.activeRowID = result.id
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