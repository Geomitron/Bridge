import { Component, AfterViewInit, Output, EventEmitter } from '@angular/core'
import { ElectronService } from 'src/app/core/services/electron.service'
import { SearchType, SongResult } from 'src/electron/shared/interfaces/search.interface'

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements AfterViewInit {
  @Output() resultsUpdated = new EventEmitter<SongResult[]>()

  constructor(private electronService: ElectronService) { }

  ngAfterViewInit() {
    $('.ui.dropdown').dropdown()
  }

  async onSearch(query: string) {
    const results = await this.electronService.invoke('song-search', { query, type: SearchType.Any })

    this.resultsUpdated.emit(results)
  }
}