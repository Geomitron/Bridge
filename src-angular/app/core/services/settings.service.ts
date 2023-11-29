import { Injectable } from '@angular/core'

import { Settings } from '../../../../src-shared/Settings'

@Injectable({
	providedIn: 'root',
})
export class SettingsService {
	readonly builtinThemes = ['Default', 'Dark']

	private settings: Settings
	private currentThemeLink: HTMLLinkElement

	async loadSettings() {
		this.settings = await window.electron.invoke.getSettings()
		if (this.settings.theme !== this.builtinThemes[0]) {
			this.changeTheme(this.settings.theme)
		}
	}

	saveSettings() {
		window.electron.emit.setSettings(this.settings)
	}

	changeTheme(theme: string) {
		if (this.currentThemeLink !== undefined) this.currentThemeLink.remove()
		if (theme === 'Default') { return }

		const link = document.createElement('link')
		link.type = 'text/css'
		link.rel = 'stylesheet'
		link.href = `./assets/themes/${theme.toLowerCase()}.css`
		this.currentThemeLink = document.head.appendChild(link)
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
	set theme(newValue: string) {
		this.settings.theme = newValue
		this.changeTheme(newValue)
		this.saveSettings()
	}

	get rateLimitDelay() {
		return this.settings.rateLimitDelay
	}
	set rateLimitDelay(delay: number) {
		this.settings.rateLimitDelay = delay
		this.saveSettings()
	}
}
