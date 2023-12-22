import { DOCUMENT } from '@angular/common'
import { Inject, Injectable } from '@angular/core'

import { Difficulty, Instrument } from 'scan-chart'

import { Settings, themes } from '../../../../src-shared/Settings'

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
		if (!themes.includes(this.settings.theme)) {
			this.changeTheme('dark')
		} else {
			this.changeTheme(this.settings.theme)
		}
	}

	saveSettings() {
		window.electron.emit.setSettings(this.settings)
	}

	changeTheme(theme: typeof themes[number]) {
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

	// Individual getters/setters
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
	set theme(newValue: typeof themes[number]) {
		this.settings.theme = newValue
		this.changeTheme(newValue)
		this.saveSettings()
	}

	get isSng() {
		return this.settings.isSng
	}
	set isSng(value: boolean) {
		this.settings.isSng = value
		this.saveSettings()
	}
}
