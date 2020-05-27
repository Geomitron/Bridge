import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core'
import { ElectronService } from 'src/app/core/services/electron.service'
import { SettingsService } from 'src/app/core/services/settings.service'

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, AfterViewInit {
  // @ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef

  cacheSize = 'Calculating...'
  updateAvailable = false
  downloadUpdateText = 'Update available'
  updateDownloading = false
  updateDownloaded = false
  currentVersion = ''

  constructor(public settingsService: SettingsService, private electronService: ElectronService, private ref: ChangeDetectorRef) { }

  async ngOnInit() {
    const cacheSize = await this.settingsService.getCacheSize()
    this.cacheSize = Math.round(cacheSize / 1000000) + ' MB'
    this.electronService.receiveIPC('update-available', (result) => {
      this.updateAvailable = true
      this.downloadUpdateText = `Update available (${result.version})`
      this.ref.detectChanges()
    })
    this.electronService.invoke('get-current-version', undefined).then(version => {
      this.currentVersion = `v${version}`
      this.ref.detectChanges()
    })
    this.electronService.invoke('get-update-available', undefined).then(isAvailable => {
      this.updateAvailable = isAvailable
      this.ref.detectChanges()
    })
  }

  ngAfterViewInit() {
    // $(this.themeDropdown.nativeElement).dropdown({
    //   onChange: (_value: string, text: string) => {
    //     this.settingsService.theme = text
    //   }
    // })
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

  downloadUpdate() {
    if (this.updateDownloaded) {
      this.electronService.sendIPC('quit-and-install', undefined)
    } else if (!this.updateDownloading) {
      this.updateDownloading = true
      this.electronService.sendIPC('download-update', undefined)
      this.downloadUpdateText = 'Downloading... (0%)'
      this.electronService.receiveIPC('update-progress', (result) => {
        this.downloadUpdateText = `Downloading... (${result.percent.toFixed(0)}%)`
        this.ref.detectChanges()
      })
      this.electronService.receiveIPC('update-downloaded', () => {
        this.downloadUpdateText = 'Quit and install update'
        this.updateDownloaded = true
        this.ref.detectChanges()
      })
    }
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