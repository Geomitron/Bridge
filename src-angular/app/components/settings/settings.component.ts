import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core'
import { ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms'
import { NgClass } from '@angular/common'

import _ from 'lodash'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { themes } from 'src-shared/Settings'

@Component({
	selector: 'app-settings',
	standalone: true,
	imports: [ReactiveFormsModule, FormsModule, NgClass],
	templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
	settingsService = inject(SettingsService)

	@ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef

	chartFolderName: FormControl<string>
	isSng: FormControl<boolean>
	downloadVideos: FormControl<boolean>
	isCompactTable: FormControl<boolean>

	artistColumn: FormControl<boolean>
	albumColumn: FormControl<boolean>
	genreColumn: FormControl<boolean>
	yearColumn: FormControl<boolean>
	charterColumn: FormControl<boolean>
	lengthColumn: FormControl<boolean>
	difficultyColumn: FormControl<boolean>
	uploadedColumn: FormControl<boolean>

	updateAvailable = signal<'yes' | 'no' | 'error'>('no')
	loginClicked = signal(false)
	downloadUpdateText = signal('Download Update')
	retryUpdateText = signal('Failed to check for update')
	updateDownloading = signal(false)
	updateDownloaded = signal(false)
	updateRetrying = signal(false)
	currentVersion = signal('')

	constructor() {
		const ss = this.settingsService

		this.chartFolderName = new FormControl<string>(ss.chartFolderName, { nonNullable: true })
		this.chartFolderName.valueChanges.subscribe(value => ss.chartFolderName = value)

		this.isSng = new FormControl<boolean>(ss.isSng, { nonNullable: true })
		this.isSng.valueChanges.subscribe(value => this.settingsService.isSng = value)
		this.downloadVideos = new FormControl<boolean>(ss.downloadVideos, { nonNullable: true })
		this.downloadVideos.valueChanges.subscribe(value => this.settingsService.downloadVideos = value)
		this.isCompactTable = new FormControl<boolean>(this.settingsService.isCompactTable, { nonNullable: true })
		this.isCompactTable.valueChanges.subscribe(value => ss.isCompactTable = value)

		this.artistColumn = new FormControl<boolean>(ss.visibleColumns.includes('artist'), { nonNullable: true })
		this.albumColumn = new FormControl<boolean>(ss.visibleColumns.includes('album'), { nonNullable: true })
		this.genreColumn = new FormControl<boolean>(ss.visibleColumns.includes('genre'), { nonNullable: true })
		this.yearColumn = new FormControl<boolean>(ss.visibleColumns.includes('year'), { nonNullable: true })
		this.charterColumn = new FormControl<boolean>(ss.visibleColumns.includes('charter'), { nonNullable: true })
		this.lengthColumn = new FormControl<boolean>(ss.visibleColumns.includes('length'), { nonNullable: true })
		this.difficultyColumn = new FormControl<boolean>(ss.visibleColumns.includes('difficulty'), { nonNullable: true })
		this.uploadedColumn = new FormControl<boolean>(ss.visibleColumns.includes('uploaded'), { nonNullable: true })

		this.artistColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('artist') : ss.removeVisibleColumn('artist'))
		this.albumColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('album') : ss.removeVisibleColumn('album'))
		this.genreColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('genre') : ss.removeVisibleColumn('genre'))
		this.yearColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('year') : ss.removeVisibleColumn('year'))
		this.charterColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('charter') : ss.removeVisibleColumn('charter'))
		this.lengthColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('length') : ss.removeVisibleColumn('length'))
		this.difficultyColumn.valueChanges
			.subscribe(value => value ? ss.addVisibleColumn('difficulty') : ss.removeVisibleColumn('difficulty'))
		this.uploadedColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('uploaded') : ss.removeVisibleColumn('uploaded'))
	}

	async ngOnInit() {
		window.electron.on.updateAvailable(result => {
			this.updateAvailable.set(result !== null ? 'yes' : 'no')
			this.updateRetrying.set(false)
			if (result !== null) {
				this.downloadUpdateText.set(`Download Update (${result.version})`)
			}
		})
		window.electron.on.updateError(err => {
			console.log(err)
			this.updateAvailable.set('error')
			this.updateRetrying.set(false)
			this.retryUpdateText.set('Failed to check for update')
		})
		window.electron.invoke.getCurrentVersion().then(version => {
			this.currentVersion.set(`v${version}`)
		})
		window.electron.invoke.getUpdateAvailable().then(isAvailable => {
			this.updateAvailable.set(isAvailable)
		})
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

	async getCustomTheme() {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Choose custom theme',
			defaultPath: this.settingsService.customThemePath || '',
			properties: ['openFile'],
			filters: [
				{ name: "Themes", extensions: ["json"] },
			],
		})

		if (result.canceled === false) {
			const path = result.filePaths[0].replace(/\\/g, '/')
			const newThemeColors = await window.electron.invoke.getThemeColors(path)

			if (newThemeColors) {
				this.settingsService.customTheme = newThemeColors
				this.settingsService.customThemePath = path.substring(0, path.lastIndexOf('/'))
			} else {
				alert(`ERROR: ${result.filePaths[0]} was not a valid JSON file.`)
			}
		}
	}

	clearCustomTheme() {
		this.settingsService.customTheme = null
	}

	openLibraryDirectory() {
		if (this.settingsService.libraryDirectory) {
			window.electron.emit.showFolder(this.settingsService.libraryDirectory)
		}
	}

	openUrl(url: string) {
		window.electron.emit.openUrl(url)
	}

	setTheme(theme: typeof themes[number]) {
		this.settingsService.theme = theme
	}

	capitalize(text: string) {
		return _.capitalize(text)
	}

	async downloadUpdate() {
		if (this.updateDownloaded()) {
			window.electron.emit.quitAndInstall()
		} else if (!this.updateDownloading()) {
			if (await window.electron.invoke.getPlatform() === 'darwin') { // Thanks Apple...
				this.openUrl('https://github.com/Geomitron/Bridge/releases/latest')
			} else {
				this.updateDownloading.set(true)
				window.electron.emit.downloadUpdate()
				this.downloadUpdateText.set('Downloading... (0%)')
				window.electron.on.updateProgress(result => {
					this.downloadUpdateText.set(`Downloading... (${result.percent.toFixed(0)}%)`)
				})
				window.electron.on.updateDownloaded(() => {
					this.downloadUpdateText.set('Quit and install update')
					this.updateDownloaded.set(true)
				})
			}
		}
	}

	retryUpdate() {
		if (this.updateRetrying() === false) {
			this.updateRetrying.set(true)
			this.retryUpdateText.set('Retrying...')
			window.electron.emit.retryUpdate()
		}
	}

	toggleDevTools() {
		window.electron.emit.toggleDevTools()
	}
}
