import { Component, HostListener, OnDestroy, OnInit } from '@angular/core'

import { Subscription } from 'rxjs'
import { LibraryService } from 'src-angular/app/core/services/library.service'
import { SelectionService } from 'src-angular/app/core/services/selection.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { SettingsService } from '../../../core/services/settings.service'

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
	searchTerm: string = ''
	allRowsSelected: boolean = false
	subscriptions: Subscription[] = []
	selectedSongs: ChartData[] = []
	isLoading: boolean = false
	hasSearched: boolean = false

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
				})
		)

		this.subscriptions.push(
			this.libraryService.selectedSongs$
				.subscribe(songs =>
					this.selectedSongs = songs
				)
		)
	}

	filterSongs(): void {
		this.hasSearched = true
		this.libraryService.getChartsBySearchTerm(this.searchTerm)
	}

	onColClicked(column: SortColumn) {
		if (this.songs.length === 0) { return }

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
			this.songs.sort((a, b) => {
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

	rowIsSelected(song: ChartData): boolean {
		return this.selectedSongs.some(selectedSong => selectedSong.md5 === song.md5)
	}

	trackByFn(index: number): number {
		return index
	}

	toggleSelectAll(): void {
		this.allRowsSelected = !this.allRowsSelected

		if (this.allRowsSelected) {
			this.songs.forEach(song => this.libraryService.addToSelectedSongs(song))
		} else {
			this.libraryService.clearSelectedSongs()
		}
	}

	async loadMoreSongs(): Promise<void> {
		if (this.isLoading) return

		this.isLoading = true
		await this.libraryService.loadMoreSongs()
		this.isLoading = false
	}

	@HostListener('scroll', ['$event'])
	onScroll(event: Event): void {
		const target = event.target as HTMLElement
		if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
			this.loadMoreSongs()
		}
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(subscription => subscription.unsubscribe())
	}
}
