import { Component, AfterViewInit } from '@angular/core'

@Component({
  selector: 'app-chart-sidebar',
  templateUrl: './chart-sidebar.component.html',
  styleUrls: ['./chart-sidebar.component.scss']
})
export class ChartSidebarComponent implements AfterViewInit {
  
  constructor() { }
  
  ngAfterViewInit() {
    $('.ui.dropdown').dropdown()
  }
}