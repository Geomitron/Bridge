import { Injectable, Injector } from '@angular/core'

import { BehaviorSubject } from 'rxjs'
import { ChartData } from 'src-shared/interfaces/search.interface'

import { DownloadService } from './download.service'
import { StorageService } from './storage.service'

export const LIBRARY_TABLE_PAGESIZE = 50

@Injectable({
	providedIn: 'root',
})
export class LibraryService {
	private _tracks = new BehaviorSubject<ChartData[]>([])
	tracks$ = this._tracks.asObservable()

	private _selectedSongs = new BehaviorSubject<ChartData[]>([])
	selectedSongs$ = this._selectedSongs.asObservable()

	private _downloadService: DownloadService | null = null
	private currentPage = 1
	private isLastPage = false

	constructor(private injector: Injector, private storageService: StorageService) {
		this.storageService.getChartsBySearchTerm(undefined, 1, 50).then(library => {
			if (library) {
				this._tracks.next(library)
			}
		})
	}

	private get downloadService(): DownloadService {
		if (!this._downloadService) {
			this._downloadService = this.injector.get(DownloadService)
		}

		return this._downloadService
	}

	libraryAdd(chart: ChartData) {
		const updatedTracks = [...this._tracks.value, chart]
		this._tracks.next(updatedTracks)

		this.storageService.addChart(chart)
	}

	downloadLibrary(songs: ChartData[]) {
		songs.forEach(track => {
			this.downloadService.addDownload(track)
		})
	}

	storeLibrary() {
		const fakeLink = document.createElement('a')
		const file = new Blob([JSON.stringify(this._tracks.value)], { type: 'application/json' })

		fakeLink.href = URL.createObjectURL(file)
		fakeLink.download = 'songs.library'
		fakeLink.click()
	}

	storeSelectedSongs() {
		const fakeLink = document.createElement('a')
		const file = new Blob([JSON.stringify(this._selectedSongs.value)], { type: 'application/json' })

		fakeLink.href = URL.createObjectURL(file)
		fakeLink.download = 'selected.library'
		fakeLink.click()
	}

	addToSelectedSongs(song: ChartData) {
		if (!this._selectedSongs.value.some(selectedSong => selectedSong.md5 === song.md5)) {
			const updatedSelectedSongs = [...this._selectedSongs.value, song]
			this._selectedSongs.next(updatedSelectedSongs)
		}
	}

	removeFromSelectedSongs(song: ChartData) {
		const updatedSelectedSongs = this._selectedSongs.value.filter(selectedSong => selectedSong.md5 !== song.md5)
		this._selectedSongs.next(updatedSelectedSongs)
	}

	clearSelectedSongs() {
		this._selectedSongs.next([])
	}

	removeFromLibrary() {
		this._selectedSongs.value.forEach((selectedSong: ChartData) => {
			const updatedTracks = this._tracks.value.filter(track => track !== selectedSong) as ChartData[]
			this._tracks.next(updatedTracks)
			this.storageService.removeChart(selectedSong.md5)
		})

		this.clearSelectedSongs()
	}

	async clearLibrary() {
		this.storageService.removeAllCharts()
		this.clearSelectedSongs()

		const library = await this.storageService.getChartsBySearchTerm()
		this._tracks.next(library)
	}

	async loadMoreSongs(): Promise<void> {
		if (this.isLastPage)
			return

		this.currentPage++
		const moreSongs = await this.getChartsBySearchTerm()

		if (moreSongs.length < LIBRARY_TABLE_PAGESIZE) {
			this.isLastPage = true
		}

		const uniqueSongs = moreSongs.filter(
			song => !this._tracks.value.some(track => track.md5 === song.md5)
		)

		this._tracks.next([...this._tracks.value, ...uniqueSongs])
	}

	async getChartsBySearchTerm(searchTerm?: string): Promise<ChartData[]> {
		if (searchTerm !== undefined) {
			this.currentPage = 1
			this._tracks.next([])
			this.isLastPage = false
		}

		const library = await this.storageService.getChartsBySearchTerm(searchTerm, this.currentPage, LIBRARY_TABLE_PAGESIZE)

		this._tracks.next([...this._tracks.value, ...library])

		return library
	}
}
