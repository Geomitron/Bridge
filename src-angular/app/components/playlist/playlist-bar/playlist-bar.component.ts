import { Component, ElementRef, ViewChild } from '@angular/core'
import { PlaylistService } from 'src-angular/app/core/services/playlist.service'
import { DownloadService } from '../../../core/services/download.service'

@Component({
	selector: 'app-playlist-bar',
	templateUrl: './playlist-bar.component.html',
	standalone: false,
})
export class PlaylistBarComponent {
	@ViewChild('fileInput', { static: false }) fileInput: ElementRef<HTMLInputElement>

	constructor(public playlistService: PlaylistService, public downloadService: DownloadService) { }

	exportPlaylist() {
		this.playlistService.storePlaylist()
	}

	exportSelected() {
		this.playlistService.storeSelectedSongs()
	}

	importPlaylist() {
		this.fileInput.nativeElement.click()
	}

	onFileSelected(event: Event) {
		const input = event.target as HTMLInputElement

		if (input.files && input.files.length > 0) {
			const file = input.files[0]
			const reader = new FileReader()
			reader.onload = () => {
				try {
					const importedTracks = JSON.parse(reader.result as string)
					if (Array.isArray(importedTracks)) {
						this.playlistService.downloadPlaylist(importedTracks)
					} else {
						console.error('Invalid file format')
					}
				} catch (error) {
					console.error('Error parsing file:', error)
				}
			}
			reader.readAsText(file)
		}
	}
}
