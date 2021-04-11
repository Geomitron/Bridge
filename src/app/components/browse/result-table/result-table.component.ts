import { Component, Output, EventEmitter, ViewChildren, QueryList, ViewChild, OnInit } from '@angular/core'
import { SongResult } from '../../../../electron/shared/interfaces/search.interface'
import { ResultTableRowComponent } from './result-table-row/result-table-row.component'
import { CheckboxDirective } from '../../../core/directives/checkbox.directive'
import { SearchService } from '../../../core/services/search.service'
import { SelectionService } from '../../../core/services/selection.service'
import { SettingsService } from 'src/app/core/services/settings.service'
import Comparators from 'comparators'

@Component({
  selector: 'app-result-table',
  templateUrl: './result-table.component.html',
  styleUrls: ['./result-table.component.scss']
})
export class ResultTableComponent implements OnInit {

  @Output() rowClicked = new EventEmitter<SongResult>()

  @ViewChild(CheckboxDirective, { static: true }) checkboxColumn: CheckboxDirective
  @ViewChildren('tableRow') tableRows: QueryList<ResultTableRowComponent>

  results: SongResult[] = []
  activeRowID: number = null
  sortDirection: 'ascending' | 'descending' = 'descending'
  sortColumn: 'name' | 'artist' | 'album' | 'genre' | null = null

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
      this.updateSort()
    })

    this.searchService.onNewSearch(() => {
      this.sortColumn = null
    })
  }

  onRowClicked(result: SongResult) {
    this.activeRowID = result.id
    this.rowClicked.emit(result)
  }

  onColClicked(column: 'name' | 'artist' | 'album' | 'genre') {
    if (this.results.length == 0) { return }
    if (this.sortColumn != column) {
      this.sortColumn = column
      this.sortDirection = 'descending'
    } else if (this.sortDirection == 'descending') {
      this.sortDirection = 'ascending'
    } else {
      this.sortDirection = 'descending'
    }
    this.updateSort()
  }

  private updateSort() {
    if (this.sortColumn != null) {
      this.results.sort(Comparators.comparing(this.sortColumn, { reversed: this.sortDirection == 'ascending' }))
    }
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