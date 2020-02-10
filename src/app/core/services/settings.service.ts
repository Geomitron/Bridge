import { Injectable } from '@angular/core'
import { ElectronService } from './electron.service'
import { Settings } from 'src/electron/shared/Settings'

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private settings: Settings

  constructor(private electronService: ElectronService) { }

  async getSettings() {
    if (this.settings == undefined) {
      this.settings = await this.electronService.invoke('init-settings', undefined)
    }
    return this.settings
  }
}