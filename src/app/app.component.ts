import { Component } from '@angular/core'
import { SettingsService } from './core/services/settings.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {

  constructor(private settingsService: SettingsService) { }
}