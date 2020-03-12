import { Component, ViewChild, AfterViewInit } from '@angular/core'
import { ChartSidebarComponent } from './chart-sidebar/chart-sidebar.component'
import { StatusBarComponent } from './status-bar/status-bar.component'
import { ResultTableComponent } from './result-table/result-table.component'
import { SearchService } from 'src/app/core/services/search.service'

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss']
})
export class BrowseComponent implements AfterViewInit {

  @ViewChild('resultTable', { static: true }) resultTable: ResultTableComponent
  @ViewChild('chartSidebar', { static: true }) chartSidebar: ChartSidebarComponent
  @ViewChild('statusBar', { static: true }) statusBar: StatusBarComponent

  constructor(private searchService: SearchService) { }

  ngAfterViewInit() {
    const $tableColumn = $('#table-column')
    $tableColumn.on('scroll', () => {
      let pos = $tableColumn[0].scrollTop + $tableColumn[0].offsetHeight
      let max = $tableColumn[0].scrollHeight
      if (pos >= max - 5) {
        this.searchService.updateScroll()
      }
    })
  }
}