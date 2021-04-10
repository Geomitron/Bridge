import { Injectable } from '@angular/core'
import { ElectronService } from './electron.service'
import { Settings } from 'src/electron/shared/Settings'

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  readonly builtinThemes = ['Default', 'Dark']

  private settings: Settings
  private currentThemeLink: HTMLLinkElement

  constructor(private electronService: ElectronService) { }

  async loadSettings() {
    this.settings = await this.electronService.invoke('get-settings', undefined)
    if (this.settings.theme != this.builtinThemes[0]) {
      this.changeTheme(this.settings.theme)
    }
  }

  saveSettings() {
    this.electronService.sendIPC('set-settings', this.settings)
  }

  changeTheme(theme: string) {
    if (this.currentThemeLink != undefined) this.currentThemeLink.remove()
    if (theme == 'Default') { return }

    const link = document.createElement('link')
    link.type = 'text/css'
    link.rel = 'stylesheet'
    link.href = `./assets/themes/${theme.toLowerCase()}.css`
    this.currentThemeLink = document.head.appendChild(link)
  }

  async getCacheSize() {
    return this.electronService.defaultSession.getCacheSize()
  }

  async clearCache() {
    this.saveSettings()
    await this.electronService.defaultSession.clearCache()
    await this.electronService.invoke('clear-cache', undefined)
  }

  // Individual getters/setters
  get libraryDirectory() {
    return this.settings.libraryPath
  }
  set libraryDirectory(newValue: string) {
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