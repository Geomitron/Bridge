import { Component, ElementRef, NgZone, ViewChild } from '@angular/core'

import { SettingsService } from 'src-angular/app/core/services/settings.service'

@Component({
	selector: 'app-tools',
	templateUrl: './tools.component.html',
})
export class ToolsComponent {
	@ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef
	@ViewChild('scanErrorModal') scanErrorModal: ElementRef<HTMLDialogElement>

	public scanning = false
	public buttonText = 'Scan for issues'
	public scanErrorText = ''

	constructor(
		zone: NgZone,
		public settingsService: SettingsService,
	) {
		window.electron.on.updateIssueScan(({ status, message }) => zone.run(() => {
			if (status === 'progress') {
				this.buttonText = message
			} else if (status === 'error') {
				this.scanning = false
				this.scanErrorText = message
				this.scanErrorModal.nativeElement.showModal()
			} else if (status === 'done') {
				this.scanning = false
				this.buttonText = message + ' (click to scan again)'
			}
		}))
	}

	openIssueScanDirectory() {
		if (this.settingsService.issueScanDirectory) {
			window.electron.emit.showFolder(this.settingsService.issueScanDirectory)
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
}
