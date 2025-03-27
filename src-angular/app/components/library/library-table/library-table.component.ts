import { Component, OnInit, OnDestroy } from '@angular/core'
import { SelectionService } from 'src-angular/app/core/services/selection.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { SettingsService } from '../../../core/services/settings.service'
import { Subscription } from 'rxjs'
import { LibraryService } from 'src-angular/app/core/services/library.service'

type SortColumn = 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null

@Component({
	selector: 'app-library-table',
	templateUrl: './library-table.component.html',
	standalone: false,
})
export class LibraryTableComponent implements OnInit, OnDestroy {
	songs: ChartData[] = []
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: SortColumn = null
	filteredSongs: ChartData[] = []
	searchTerm: string = ''
	allRowsSelected: boolean = false
	subscriptions: Subscription[] = []
	selectedSongs: ChartData[] = []

	constructor(
		public libraryService: LibraryService,
		public settingsService: SettingsService,
		private selectionService: SelectionService
	) { }

	get allSelected() {
		return this.selectionService.isAllSelected()
	}

	set allSelected(value: boolean) {
		if (value) {
			this.selectionService.selectAll()
		} else {
			this.selectionService.deselectAll()
		}
	}

	ngOnInit(): void {
		this.subscriptions.push(
			this.libraryService.tracks$
				.subscribe(tracks => {
					this.songs = tracks
					this.filterSongs()
				})
		)
		this.filteredSongs = [...this.songs]
		this.subscriptions.push(
			this.libraryService.selectedSongs$
				.subscribe(songs =>
					this.selectedSongs = songs
				)
		)
	}

	filterSongs(): void {
		const term = this.searchTerm.toLowerCase()
		this.filteredSongs = this.songs.filter(
			song =>
				song.name?.toLowerCase().includes(term) ||
				song.artist?.toLowerCase().includes(term) ||
				song.album?.toLowerCase().includes(term) ||
				song.genre?.toLowerCase().includes(term) ||
				song.year?.toLowerCase().includes(term) ||
				song.charter?.toLowerCase().includes(term)
		)
	}

	onColClicked(column: SortColumn) {
		if (this.filteredSongs.length === 0) { return }

		if (this.sortColumn !== column) {
			this.sortColumn = column
			this.sortDirection = 'asc'
		} else if (this.sortDirection === 'asc') {
			this.sortDirection = 'desc'
		} else {
			this.sortDirection = 'asc'
			this.sortColumn = null
		}

		if (this.sortColumn) {
			this.filteredSongs.sort((a, b) => {
				const valueA = a[this.sortColumn! as keyof ChartData]
				const valueB = b[this.sortColumn! as keyof ChartData]

				if (valueA == null && valueB == null) return 0
				if (valueA == null) return this.sortDirection === 'asc' ? -1 : 1
				if (valueB == null) return this.sortDirection === 'asc' ? 1 : -1

				if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1
				if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1
				return 0
			})
		}
	}

	onCheckboxChange(song: ChartData, target?: EventTarget): void {
		const input = target as HTMLInputElement
		if (input.checked) {
			this.libraryService.addToSelectedSongs(song)
		} else {
			this.libraryService.removeFromSelectedSongs(song)
		}
	}

	trackByFn(index: number): number {
		return index
	}

	toggleSelectAll(): void {
		this.allRowsSelected = !this.allRowsSelected

		if (this.allRowsSelected) {
			this.filteredSongs.forEach(song => this.libraryService.addToSelectedSongs(song))
		} else {
			this.libraryService.clearSelectedSongs()
		}
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(subscription => subscription.unsubscribe())
	}
}
