import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core'
import { ElectronService } from 'src/app/core/services/electron.service'
import { SettingsService } from 'src/app/core/services/settings.service'

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, AfterViewInit {
  @ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef

  cacheSize = 'Calculating...'

  constructor(public settingsService: SettingsService, private electronService: ElectronService) { }

  async ngOnInit() {
    const cacheSize = await this.settingsService.getCacheSize()
    this.cacheSize = Math.round(cacheSize / 1000000) + ' MB'
  }

  ngAfterViewInit() {
    $(this.themeDropdown.nativeElement).dropdown({
      onChange: (_value: string, text: string) => {
        this.settingsService.theme = text
      }
    })
  }

  async clearCache() {
    this.cacheSize = 'Please wait...'
    await this.settingsService.clearCache()
    this.cacheSize = 'Cleared!'
  }

  async getLibraryDirectory() {
    const result = await this.electronService.showOpenDialog({
      title: 'Choose library folder',
      buttonLabel: 'This is where my charts are!',
      defaultPath: this.settingsService.libraryDirectory || '',
      properties: ['openDirectory']
    })

    if (result.canceled == false) {
      this.settingsService.libraryDirectory = result.filePaths[0]
    }
  }

  openLibraryDirectory() {
    this.electronService.openFolder(this.settingsService.libraryDirectory)
  }

  changeRateLimit(event: Event) {
    const inputElement = event.srcElement as HTMLInputElement
    this.settingsService.rateLimitDelay = Number(inputElement.value)
  }

  toggleDevTools() {
    const toolsOpened = this.electronService.currentWindow.webContents.isDevToolsOpened()

    if (toolsOpened) {
      this.electronService.currentWindow.webContents.closeDevTools()
    } else {
      this.electronService.currentWindow.webContents.openDevTools()
    }
  }
}