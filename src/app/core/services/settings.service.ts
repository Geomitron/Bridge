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

  constructor(private electronService: ElectronService) {
    this.getSettings()
  }

  async getSettings() {
    if (this.settings == undefined) {
      this.settings = await this.electronService.invoke('get-settings', undefined)
    }
    return this.settings
  }

  saveSettings() {
    if (this.settings != undefined) {
      this.electronService.sendIPC('set-settings', this.settings)
    }
  }

  // TODO: research how to make theme changes with fomantic UI
  changeTheme(theme: string) {
    if (this.currentThemeLink != undefined) this.currentThemeLink.remove()
    if (theme == 'Default') { return }

    const link = document.createElement('link')
    link.type = 'text/css'
    link.rel = 'stylesheet'
    link.href = `assets/themes/${theme}.css`
    this.currentThemeLink = document.head.appendChild(link)
  }

  async getCacheSize() {
    return this.electronService.defaultSession.getCacheSize()
  }

  async clearCache() {
    this.saveSettings()
    return this.electronService.defaultSession.clearCache()
  }

  // Individual getters/setters
  get libraryDirectory() {
    return this.settings == undefined ? '' : this.settings.libraryPath
  }
  set libraryDirectory(newValue: string) {
    this.settings.libraryPath = newValue
    this.saveSettings()
  }

  get theme() {
    return this.settings == undefined ? '' : this.settings.theme
  }
  set theme(newValue: string) {
    this.settings.theme = newValue
    this.changeTheme(newValue)
    this.saveSettings()
  }

  get rateLimitDelay() {
    return this.settings == undefined ? NaN : this.settings.rateLimitDelay
  }
  set rateLimitDelay(delay: number) {
    this.settings.rateLimitDelay = delay
    this.saveSettings()
  }
}