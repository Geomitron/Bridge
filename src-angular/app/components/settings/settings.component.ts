import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { FormControl } from '@angular/forms'

import _ from 'lodash'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { themes } from 'src-shared/Settings'

@Component({
	selector: 'app-settings',
	templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
	@ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef

	public chartFolderName: FormControl<string>
	public isSng: FormControl<boolean>
	public isCompactTable: FormControl<boolean>

	public artistColumn: FormControl<boolean>
	public albumColumn: FormControl<boolean>
	public genreColumn: FormControl<boolean>
	public yearColumn: FormControl<boolean>
	public charterColumn: FormControl<boolean>
	public lengthColumn: FormControl<boolean>
	public difficultyColumn: FormControl<boolean>

	updateAvailable: 'yes' | 'no' | 'error' = 'no'
	loginClicked = false
	downloadUpdateText = 'Download Update'
	retryUpdateText = 'Failed to check for update'
	updateDownloading = false
	updateDownloaded = false
	updateRetrying = false
	currentVersion = ''

	constructor(
		public settingsService: SettingsService,
		private ref: ChangeDetectorRef
	) {
		const ss = settingsService

		this.chartFolderName = new FormControl<string>(ss.chartFolderName, { nonNullable: true })
		this.chartFolderName.valueChanges.subscribe(value => ss.chartFolderName = value)

		this.isSng = new FormControl<boolean>(ss.isSng, { nonNullable: true })
		this.isSng.valueChanges.subscribe(value => settingsService.isSng = value)
		this.isCompactTable = new FormControl<boolean>(settingsService.isCompactTable, { nonNullable: true })
		this.isCompactTable.valueChanges.subscribe(value => ss.isCompactTable = value)

		this.artistColumn = new FormControl<boolean>(ss.visibleColumns.includes('artist'), { nonNullable: true })
		this.albumColumn = new FormControl<boolean>(ss.visibleColumns.includes('album'), { nonNullable: true })
		this.genreColumn = new FormControl<boolean>(ss.visibleColumns.includes('genre'), { nonNullable: true })
		this.yearColumn = new FormControl<boolean>(ss.visibleColumns.includes('year'), { nonNullable: true })
		this.charterColumn = new FormControl<boolean>(ss.visibleColumns.includes('charter'), { nonNullable: true })
		this.lengthColumn = new FormControl<boolean>(ss.visibleColumns.includes('length'), { nonNullable: true })
		this.difficultyColumn = new FormControl<boolean>(ss.visibleColumns.includes('difficulty'), { nonNullable: true })

		this.artistColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('artist') : ss.removeVisibleColumn('artist'))
		this.albumColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('album') : ss.removeVisibleColumn('album'))
		this.genreColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('genre') : ss.removeVisibleColumn('genre'))
		this.yearColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('year') : ss.removeVisibleColumn('year'))
		this.charterColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('charter') : ss.removeVisibleColumn('charter'))
		this.lengthColumn.valueChanges.subscribe(value => value ? ss.addVisibleColumn('length') : ss.removeVisibleColumn('length'))
		this.difficultyColumn.valueChanges
			.subscribe(value => value ? ss.addVisibleColumn('difficulty') : ss.removeVisibleColumn('difficulty'))
	}

	async ngOnInit() {
		window.electron.on.updateAvailable(result => {
			this.updateAvailable = result !== null ? 'yes' : 'no'
			this.updateRetrying = false
			if (result !== null) {
				this.downloadUpdateText = `Download Update (${result.version})`
			}
			this.ref.detectChanges()
		})
		window.electron.on.updateError(err => {
			console.log(err)
			this.updateAvailable = 'error'
			this.updateRetrying = false
			this.retryUpdateText = 'Failed to check for update'
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
		if (this.updateDownloaded) {
			window.electron.emit.quitAndInstall()
		} else if (!this.updateDownloading) {
			if (await window.electron.invoke.getPlatform() === 'darwin') { // Thanks Apple...
				this.openUrl('https://github.com/Geomitron/Bridge/releases/latest')
			} else {
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
