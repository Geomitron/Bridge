import { Component, OnInit, OnDestroy } from '@angular/core'
import { PlaylistService } from 'src-angular/app/core/services/playlist.service'
import { SelectionService } from 'src-angular/app/core/services/selection.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { SettingsService } from '../../../core/services/settings.service'
import { Subscription } from 'rxjs'

type SortColumn = 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null

@Component({
	selector: 'app-playlist-table',
	templateUrl: './playlist-table.component.html',
	standalone: false,
})
export class PlaylistTableComponent implements OnInit, OnDestroy {
	songs: ChartData[] = []
	sortDirection: 'asc' | 'desc' = 'asc'
	sortColumn: SortColumn = null
	filteredSongs: ChartData[] = []
	searchTerm: string = ''
	allRowsSelected: boolean = false
	subscriptions: Subscription[] = []
	selectedSongs: ChartData[] = []

	constructor(
		public playlistService: PlaylistService,
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
			this.playlistService.tracks$
				.subscribe(tracks => {
					this.songs = tracks
					this.filterSongs()
				})
		)
		this.filteredSongs = [...this.songs]
		this.subscriptions.push(
			this.playlistService.selectedSongs$.subscribe(songs =>
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

	trackByFn(index: number): number {
		return index
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
			this.playlistService.addToSelectedSongs(song)
		} else {
			this.playlistService.removeFromSelectedSongs(song)
		}
	}

	toggleSelectAll(): void {
		this.allRowsSelected = !this.allRowsSelected

		if (this.allRowsSelected) {
			this.filteredSongs.forEach(song => this.playlistService.addToSelectedSongs(song))
		} else {
			this.playlistService.clearSelectedSongs()
		}
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(subscription => subscription.unsubscribe())
	}
}
