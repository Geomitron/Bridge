import { Injectable, Injector } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { DownloadService } from './download.service'

@Injectable({
	providedIn: 'root',
})
export class PlaylistService {
	private _tracks = new BehaviorSubject<ChartData[]>([])
	tracks$ = this._tracks.asObservable()

	private _selectedSongs = new BehaviorSubject<ChartData[]>([])
	selectedSongs$ = this._selectedSongs.asObservable()

	private _downloadService: DownloadService | null = null

	constructor(private injector: Injector) {
		const playlist = localStorage.getItem('playlist')
		if (playlist) {
			this._tracks.next(JSON.parse(playlist))
		}
	}

	private get downloadService(): DownloadService {
		if (!this._downloadService) {
			this._downloadService = this.injector.get(DownloadService)
		}
		return this._downloadService
	}

	getPlaylist() {
		return this._tracks.value
	}

	playlistAdd(chart: ChartData) {
		const updatedTracks = [...this._tracks.value, chart]
		this._tracks.next(updatedTracks)
		localStorage.setItem('playlist', JSON.stringify(updatedTracks))
	}

	downloadPlaylist(songs: ChartData[]) {
		songs.forEach(track => {
			if (!this._tracks.value.includes(track)) {
				this.downloadService.addDownload(track)
			}
		})
	}

	storePlaylist() {
		const fakeLink = document.createElement('a')
		const file = new Blob([JSON.stringify(this._tracks.value)], { type: 'application/json' })
		fakeLink.href = URL.createObjectURL(file)
		fakeLink.download = 'songs.setlist'
		fakeLink.click()
	}

	storeSelectedSongs() {
		const fakeLink = document.createElement('a')
		const file = new Blob([JSON.stringify(this._selectedSongs.value)], { type: 'application/json' })
		fakeLink.href = URL.createObjectURL(file)
		fakeLink.download = 'selected.setlist'
		fakeLink.click()
	}

	addToSelectedSongs(song: ChartData) {
		const updatedSelectedSongs = [...this._selectedSongs.value, song]
		this._selectedSongs.next(updatedSelectedSongs)
	}

	removeFromSelectedSongs(song: ChartData) {
		const updatedSelectedSongs = this._selectedSongs.value.filter(selectedSong => selectedSong !== song)
		this._selectedSongs.next(updatedSelectedSongs)
	}

	clearSelectedSongs() {
		this._selectedSongs.next([])
	}

	removeFromPlaylist() {
		this._selectedSongs.value.forEach(selectedSong => {
			const updatedTracks = this._tracks.value.filter(track => track !== selectedSong)
			this._tracks.next(updatedTracks)
			localStorage.setItem('playlist', JSON.stringify(updatedTracks))
		})
	}

	clearPlaylist() {
		this._tracks.next([])
		localStorage.removeItem('playlist')
	}
}
