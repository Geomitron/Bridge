import { Component, OnInit } from '@angular/core'
import { SettingsService } from './core/services/settings.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent implements OnInit {

  constructor(private settingsService: SettingsService) { }

  ngOnInit() {
    // Load settings
    this.settingsService.getSettings()
  }
}