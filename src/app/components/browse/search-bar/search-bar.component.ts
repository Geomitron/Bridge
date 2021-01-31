import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core'
import { SearchService } from 'src/app/core/services/search.service'

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements AfterViewInit {

  @ViewChild('searchIcon', { static: true }) searchIcon: ElementRef

  isError = false

  constructor(public searchService: SearchService) { }

  ngAfterViewInit() {
    $('.ui.dropdown').dropdown()
    $(this.searchIcon.nativeElement).popup({
      onShow: () => this.isError // Only show the popup if there is an error
    })
    this.searchService.onSearchErrorStateUpdate((isError) => {
      this.isError = isError
    })
  }

  onSearch(query: string) {
    this.searchService.newSearch(query)
  }

  isLoading() {
    return this.searchService.isLoading()
  }
}