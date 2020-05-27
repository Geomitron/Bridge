import { Component, AfterViewInit } from '@angular/core'
import { SearchService } from 'src/app/core/services/search.service'

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements AfterViewInit {

  constructor(public searchService: SearchService) { }

  ngAfterViewInit() {
    $('.ui.dropdown').dropdown()
  }

  onSearch(query: string) {
    this.searchService.newSearch(query)
  }
}