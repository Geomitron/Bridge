import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core'
import { SearchService } from 'src/app/core/services/search.service'
import { getDefaultSearch, SongSearch } from 'src/electron/shared/interfaces/search.interface'

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements AfterViewInit {

  @ViewChild('searchIcon', { static: true }) searchIcon: ElementRef
  @ViewChild('quantityDropdown', { static: true }) quantityDropdown: ElementRef
  @ViewChild('similarityDropdown', { static: true }) similarityDropdown: ElementRef
  @ViewChild('diffSlider', { static: true }) diffSlider: ElementRef

  isError = false
  showAdvanced = false
  searchSettings = getDefaultSearch()
  private sliderInitialized = false

  constructor(public searchService: SearchService) { }

  ngAfterViewInit() {
    $(this.searchIcon.nativeElement).popup({
      onShow: () => this.isError // Only show the popup if there is an error
    })
    this.searchService.onSearchErrorStateUpdate((isError) => {
      this.isError = isError
    })
    $(this.quantityDropdown.nativeElement).dropdown({
      onChange: (value: string) => {
        this.searchSettings.quantity = value as 'all' | 'any'
      }
    })
    $(this.similarityDropdown.nativeElement).dropdown({
      onChange: (value: string) => {
        this.searchSettings.similarity = value as 'similar' | 'exact'
      }
    })
  }

  onSearch(query: string) {
    this.searchSettings.query = query
    this.searchSettings.limit = 50 + 1
    this.searchSettings.offset = 0
    this.searchService.newSearch(this.searchSettings)
  }

  onAdvancedSearchClick() {
    this.showAdvanced = !this.showAdvanced

    if (!this.sliderInitialized) {
      setTimeout(() => { // Initialization requires this element to not be collapsed
        $(this.diffSlider.nativeElement).slider({
          min: 0,
          max: 6,
          start: 0,
          end: 6,
          step: 1,
          onChange: (_length: number, min: number, max: number) => {
            this.searchSettings.minDiff = min
            this.searchSettings.maxDiff = max
          }
        })
      }, 50)
      this.sliderInitialized = true
    }
  }

  isLoading() {
    return this.searchService.isLoading()
  }
}