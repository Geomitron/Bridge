import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core'

import { CheckboxDirective } from 'src-angular/app/core/directives/checkbox.directive'
import { SettingsService } from 'src-angular/app/core/services/settings.service'

@Component({
	selector: 'app-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit, AfterViewInit {
	@ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef
	@ViewChild(CheckboxDirective, { static: true }) videoCheckbox: CheckboxDirective

	updateAvailable: boolean | null = false
	loginClicked = false
	downloadUpdateText = 'Update available'
	retryUpdateText = 'Failed to check for update'
	updateDownloading = false
	updateDownloaded = false
	updateRetrying = false
	currentVersion = ''

	constructor(
		public settingsService: SettingsService,
		private ref: ChangeDetectorRef
	) { }

	async ngOnInit() {
		window.electron.on.updateAvailable(result => {
			this.updateAvailable = result !== null
			this.updateRetrying = false
			if (result !== null) {
				this.downloadUpdateText = `Update available (${result.version})`
			}
			this.ref.detectChanges()
		})
		window.electron.on.updateError(err => {
			console.log(err)
			this.updateAvailable = null
			this.updateRetrying = false
			this.retryUpdateText = `Failed to check for update: ${err}`
			this.ref.detectChanges()
		})
		window.electron.invoke.getCurrentVersion().then(version => {
			this.currentVersion = `v${version}`
			this.ref.detectChanges()
		})
		window.electron.invoke.getUpdateAvailable().then(isAvailable => {
			this.updateAvailable = isAvailable
			this.ref.detectChanges()
		})
	}

	ngAfterViewInit() {
		// TODO
		// $(this.themeDropdown.nativeElement).dropdown({
		// 	onChange: (_value: string, text: string) => {
		// 		this.settingsService.theme = text
		// 	},
		// })

		this.videoCheckbox.check(this.settingsService.downloadVideos)
	}

	async downloadVideos(isChecked: boolean) {
		this.settingsService.downloadVideos = isChecked
	}

	async getLibraryDirectory() {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Choose library folder',
			defaultPath: this.settingsService.libraryDirectory || '',
			properties: ['openDirectory'],
		})

		if (result.canceled === false) {
			this.settingsService.libraryDirectory = result.filePaths[0]
		}
	}

	openLibraryDirectory() {
		if (this.settingsService.libraryDirectory) {
			window.electron.emit.showFolder(this.settingsService.libraryDirectory)
		}
	}

	changeRateLimit(event: Event) {
		const inputElement = event.srcElement as HTMLInputElement
		this.settingsService.rateLimitDelay = Number(inputElement.value)
	}

	downloadUpdate() {
		if (this.updateDownloaded) {
			window.electron.emit.quitAndInstall()
		} else if (!this.updateDownloading) {
			this.updateDownloading = true
			window.electron.emit.downloadUpdate()
			this.downloadUpdateText = 'Downloading... (0%)'
			window.electron.on.updateProgress(result => {
				this.downloadUpdateText = `Downloading... (${result.percent.toFixed(0)}%)`
				this.ref.detectChanges()
			})
			window.electron.on.updateDownloaded(() => {
				this.downloadUpdateText = 'Quit and install update'
				this.updateDownloaded = true
				this.ref.detectChanges()
			})
		}
	}

	retryUpdate() {
		if (this.updateRetrying === false) {
			this.updateRetrying = true
			this.retryUpdateText = 'Retrying...'
			this.ref.detectChanges()
			window.electron.emit.retryUpdate()
		}
	}

	toggleDevTools() {
		window.electron.emit.toggleDevTools()
	}
}
