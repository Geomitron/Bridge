import { Component, ElementRef, ViewChild } from '@angular/core'
import { DownloadService } from '../../../core/services/download.service'
import { LibraryService } from 'src-angular/app/core/services/library.service'

@Component({
	selector: 'app-library-bar',
	templateUrl: './library-bar.component.html',
	standalone: false,
})
export class LibraryBarComponent {
	@ViewChild('fileInput', { static: false }) libraryfileInput: ElementRef<HTMLInputElement>

	constructor(public libraryService: LibraryService, public downloadService: DownloadService) { }

	exportPlaylist() {
		this.libraryService.storeLibrary()
	}

	exportSelected() {
		this.libraryService.storeSelectedSongs()
	}

	importPlaylist() {
		this.libraryfileInput.nativeElement.click()
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
						this.libraryService.downloadLibrary(importedTracks)
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
