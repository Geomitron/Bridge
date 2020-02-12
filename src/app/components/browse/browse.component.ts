import { Component, ViewChild } from '@angular/core'
import { ChartSidebarComponent } from './chart-sidebar/chart-sidebar.component'
import { StatusBarComponent } from './status-bar/status-bar.component'
import { SongResult } from 'src/electron/shared/interfaces/search.interface'
import { ResultTableComponent } from './result-table/result-table.component'

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss']
})
export class BrowseComponent {

  @ViewChild('resultTable', { static: true }) resultTable: ResultTableComponent
  @ViewChild('chartSidebar', { static: true }) chartSidebar: ChartSidebarComponent
  @ViewChild('statusBar', { static: true }) statusBar: StatusBarComponent

  constructor() { }

  onResultsUpdated(results: SongResult[]) {
    this.resultTable.results = results
    this.resultTable.onNewSearch()
    this.resultTable.checkAll
    this.chartSidebar.selectedVersion = undefined
    this.statusBar.resultCount = results.length
    this.statusBar.selectedResults = []
  }
}