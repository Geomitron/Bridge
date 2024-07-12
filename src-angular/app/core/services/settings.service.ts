import { DOCUMENT } from '@angular/common'
import { Inject, Injectable } from '@angular/core'

import _ from 'lodash'
import { Difficulty, Instrument } from 'scan-chart'

import { ThemeColors } from '../../../../src-shared/interfaces/theme.interface.js'
import { Settings, themes } from '../../../../src-shared/Settings.js'
import { colorNames, convertColorFormat } from '../../../../src-shared/UtilFunctions.js'

@Injectable({
	providedIn: 'root',
})
export class SettingsService {

	private settings: Settings

	constructor(
		@Inject(DOCUMENT) private document: Document,
	) { }

	async loadSettings() {
		this.settings = await window.electron.invoke.getSettings()
		if (this.settings.customTheme) {
			setThemeColors(this.settings.customTheme)
		} else if (!themes.includes(this.settings.theme)) {
			this.changeTheme('dark')
		} else {
			this.changeTheme(this.settings.theme)
		}
	}

	private saveSettings() {
		window.electron.emit.setSettings(this.settings)
	}

	private changeTheme(theme: typeof themes[number]) {
		this.document.documentElement.setAttribute('data-theme', theme)
	}

	get instrument() {
		return this.settings.instrument
	}
	set instrument(newValue: Instrument | null) {
		this.settings.instrument = newValue
		this.saveSettings()
	}

	get difficulty() {
		return this.settings.difficulty
	}
	set difficulty(newValue: Difficulty | null) {
		this.settings.difficulty = newValue
		this.saveSettings()
	}

	get libraryDirectory() {
		return this.settings.libraryPath
	}
	set libraryDirectory(newValue: string | undefined) {
		this.settings.libraryPath = newValue
		this.saveSettings()
	}

	get downloadVideos() {
		return this.settings.downloadVideos
	}
	set downloadVideos(isChecked) {
		this.settings.downloadVideos = isChecked
		this.saveSettings()
	}

	get theme() {
		return this.settings.theme
	}
	set theme(value: typeof themes[number]) {
		this.settings.theme = value
		if (!this.settings.customTheme) {
			this.changeTheme(value)
		}
		this.saveSettings()
	}
	get customTheme() {
		return this.settings.customTheme
	}
	set customTheme(value: ThemeColors | null) {
		if (value) {
			const failed = setThemeColors(value)
			if (failed) { return }
		} else {
			for (const themeColor in colorNames) {
				document.documentElement.style.removeProperty(colorNames[themeColor])
			}
			this.changeTheme(this.settings.theme)
		}
		this.settings.customTheme = value
		this.saveSettings()
	}
	get customThemePath() {
		return this.settings.customThemePath
	}
	set customThemePath(value: string | null) {
		this.settings.customThemePath = value
		this.saveSettings()
	}

	get isSng() {
		return this.settings.isSng
	}
	set isSng(value: boolean) {
		this.settings.isSng = value
		this.saveSettings()
	}

	get isCompactTable() {
		return this.settings.isCompactTable
	}
	set isCompactTable(value: boolean) {
		this.settings.isCompactTable = value
		this.saveSettings()
	}
	get visibleColumns() {
		return this.settings.visibleColumns
	}
	addVisibleColumn(column: string) {
		this.settings.visibleColumns.push(column)
		this.saveSettings()
	}
	removeVisibleColumn(column: string) {
		this.settings.visibleColumns = this.settings.visibleColumns.filter(c => c !== column)
		this.saveSettings()
	}

	get zoomFactor() {
		return this.settings.zoomFactor
	}
	set zoomFactor(value: number) {
		this.settings.zoomFactor = value
		this.saveSettings()
	}
	zoomIn() {
		this.zoomFactor = _.round(this.zoomFactor + 0.1, 3)
	}
	zoomOut() {
		if (_.round(this.zoomFactor - 0.1, 3) > 0) {
			this.zoomFactor = _.round(this.zoomFactor - 0.1, 3)
		}
	}
}

function setThemeColors(themeColors: ThemeColors) {
	try {
		const result = convertColorFormat(themeColors)
		for (const cssKey in result) {
			document.documentElement.style.setProperty(cssKey, result[cssKey])
		}
		return false
	} catch (err) {
		alert(`ERROR: the provided color theme is improperly formatted.`)
		return true
	}
}
