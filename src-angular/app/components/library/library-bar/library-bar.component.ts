import { Component, ElementRef, ViewChild } from '@angular/core'
import { DownloadService } from '../../../core/services/download.service'
import { LibraryService } from 'src-angular/app/core/services/library.service'
import { ChartData } from 'src-shared/interfaces/search.interface'

@Component({
	selector: 'app-library-bar',
	templateUrl: './library-bar.component.html',
	standalone: false,
})
export class LibraryBarComponent {
	@ViewChild('fileInput', { static: false }) libraryfileInput: ElementRef<HTMLInputElement>

	constructor(public libraryService: LibraryService, public downloadService: DownloadService) { }

	exportLibrary() {
		this.libraryService.storeLibrary()
	}

	exportSelected() {
		this.libraryService.storeSelectedSongs()
	}

	async onFileSelected(event: Event) {
		const input = event.target as HTMLInputElement

		if (!input.files?.length)
			return

		const file = input.files[0]

		try {
			const fileContent = await file.text()
			const json = JSON.parse(fileContent)
			const chartData = json as ChartData[]
			this.libraryService.downloadLibrary(chartData)

		} catch (error) {
			console.error('Error reading or parsing the file:', error)
		}

		this.libraryfileInput.nativeElement.value = ''
	}
}
