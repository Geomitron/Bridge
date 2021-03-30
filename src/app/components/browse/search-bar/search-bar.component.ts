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
  showAdvanced = false

  constructor(public searchService: SearchService) { }

  ngAfterViewInit() {
    $('.ui.dropdown').dropdown()
    $('.ui.range.slider').slider({ min: 0, max: 6, start: 0, end: 6, step: 1 })
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

  onAdvancedSearchClick() {
    this.showAdvanced = !this.showAdvanced
  }

  isLoading() {
    return this.searchService.isLoading()
  }
}