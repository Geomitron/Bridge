import { Component, ElementRef, NgZone, ViewChild } from '@angular/core'

import { SettingsService } from 'src-angular/app/core/services/settings.service'

@Component({
	selector: 'app-tools',
	templateUrl: './tools.component.html',
	standalone: false,
})
export class ToolsComponent {
	@ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef
	@ViewChild('scanErrorModal') scanErrorModal: ElementRef<HTMLDialogElement>
	@ViewChild('chartsDifficultyGenerationErrorModal') chartsDifficultyGenerationErrorModal: ElementRef<HTMLDialogElement>

	public scanning = false
	public issueScanButtonText = 'Scan for issues'
	public scanErrorText = ''

	public generatingDifficulties = false
	public chartsDifficultyGenerationButtonText = 'Generate difficulties'
	public chartsDifficultyGenerationErrorText = ''

	constructor(
		zone: NgZone,
		public settingsService: SettingsService,
	) {
		window.electron.on.updateIssueScan(({ status, message }) => zone.run(() => {
			if (status === 'progress') {
				this.issueScanButtonText = message
			} else if (status === 'error') {
				this.scanning = false
				this.scanErrorText = message
				this.scanErrorModal.nativeElement.showModal()
			} else if (status === 'done') {
				this.scanning = false
				this.issueScanButtonText = message + ' (click to scan again)'
			}
		}))

		window.electron.on.updateChartsDifficultyGeneration(({ status, message }) => zone.run(() => {
			if (status === 'progress') {
				this.chartsDifficultyGenerationButtonText = message
			} else if (status === 'error') {
				this.generatingDifficulties = false
				this.chartsDifficultyGenerationErrorText = message
				this.chartsDifficultyGenerationErrorModal.nativeElement.showModal()
			} else if (status === 'done') {
				this.generatingDifficulties = false
				this.chartsDifficultyGenerationButtonText = message + ' (click to generate again)'
			}
		}))
	}

	openIssueScanDirectory() {
		if (this.settingsService.issueScanDirectory) {
			window.electron.emit.showFolder(this.settingsService.issueScanDirectory)
		}
	}

	setChartsDifficultyGenerationDirectoryToLibrary() {
		this.settingsService.chartsDifficultyGenerationDirectory = this.settingsService.libraryDirectory
	}

	openChartsDifficultyGenerationDirectory() {
		if (this.settingsService.chartsDifficultyGenerationDirectory) {
			window.electron.emit.showFolder(this.settingsService.chartsDifficultyGenerationDirectory)
		}
	}

	async getChartsDifficultyGenerationDirectory() {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Choose charts difficulty generation folder',
			defaultPath: this.settingsService.chartsDifficultyGenerationDirectory || '',
			properties: ['openDirectory'],
		})

		if (result.canceled === false) {
			this.settingsService.chartsDifficultyGenerationDirectory = result.filePaths[0]
		}
	}

	async getIssueScanDirectory() {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Choose issue scan folder',
			defaultPath: this.settingsService.issueScanDirectory || '',
			properties: ['openDirectory'],
		})

		if (result.canceled === false) {
			this.settingsService.issueScanDirectory = result.filePaths[0]
		}
	}

	openSpreadsheetOutputDirectory() {
		if (this.settingsService.spreadsheetOutputDirectory) {
			window.electron.emit.showFolder(this.settingsService.spreadsheetOutputDirectory)
		}
	}

	async getSpreadsheetOutputDirectory() {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Choose spreadsheet output folder',
			defaultPath: this.settingsService.spreadsheetOutputDirectory || '',
			properties: ['openDirectory'],
		})

		if (result.canceled === false) {
			this.settingsService.spreadsheetOutputDirectory = result.filePaths[0]
		}
	}

	async scanIssues() {
		if (this.settingsService.issueScanDirectory && this.settingsService.spreadsheetOutputDirectory) {
			this.scanning = true
			window.electron.emit.scanIssues()
		}
	}

	async generateMissingDifficulties() {
		if (this.settingsService.chartsDifficultyGenerationDirectory) {
			this.generatingDifficulties = true
			window.electron.emit.generateMissingDifficulties()
		}
	}
}
