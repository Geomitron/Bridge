import { Component } from '@angular/core'
import { SettingsService } from './core/services/settings.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {

  settingsLoaded = false

  constructor(private settingsService: SettingsService) {
    // Ensure settings are loaded before rendering the application
    settingsService.loadSettings().then(() => this.settingsLoaded = true)
  }
}