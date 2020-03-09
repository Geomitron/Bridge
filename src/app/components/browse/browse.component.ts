import { Component, ViewChild, AfterViewInit } from '@angular/core'
import { ChartSidebarComponent } from './chart-sidebar/chart-sidebar.component'
import { StatusBarComponent } from './status-bar/status-bar.component'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'
import { ResultTableComponent } from './result-table/result-table.component'

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss']
})
export class BrowseComponent implements AfterViewInit {

  @ViewChild('resultTable', { static: true }) resultTable: ResultTableComponent
  @ViewChild('chartSidebar', { static: true }) chartSidebar: ChartSidebarComponent
  @ViewChild('statusBar', { static: true }) statusBar: StatusBarComponent

  constructor() { }

  ngAfterViewInit() {
    const $tableColumn = $('#table-column')
    $tableColumn.visibility({
      once: false,
      continuous: true,
      context: $tableColumn,
      observeChanges: true,
      onUpdate: () => {
        let pos = $tableColumn[0].scrollTop + $tableColumn[0].offsetHeight
        let max = $tableColumn[0].scrollHeight
        if (pos >= max - 5) {
          // TODO: load more results (should be debounced or something; wait until results have loaded before sending the request for more)
          console.log('UPDATE SCROLL')
        }
      }
    })
  }

  onResultsUpdated(results: SongResult[]) {
    this.resultTable.results = results
    this.resultTable.onNewSearch()
    this.resultTable.checkAll(false)
    this.chartSidebar.selectVersion(undefined)
    this.statusBar.resultCount = results.length
    this.statusBar.selectedResults = []
  }

  loadMoreResults() {
    // TODO: use the same query as the current search, but append more results if there are any more to be viewed
  }
}