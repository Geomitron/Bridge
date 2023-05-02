import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core'
import { CheckboxDirective } from 'src/app/core/directives/checkbox.directive'
import { ElectronService } from 'src/app/core/services/electron.service'
import { SettingsService } from 'src/app/core/services/settings.service'

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, AfterViewInit {
  @ViewChild('themeDropdown', { static: true }) themeDropdown: ElementRef
  @ViewChild(CheckboxDirective, { static: true }) videoCheckbox: CheckboxDirective

  cacheSize = 'Calculating...'
  updateAvailable = false
  loginClicked = false
  downloadUpdateText = 'Update available'
  retryUpdateText = 'Failed to check for update'
  updateDownloading = false
  updateDownloaded = false
  updateRetrying = false
  currentVersion = ''

  constructor(
    public settingsService: SettingsService,
    private electronService: ElectronService,
    private ref: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.electronService.receiveIPC('update-available', (result) => {
      this.updateAvailable = result != null
      this.updateRetrying = false
      if (this.updateAvailable) {
        this.downloadUpdateText = `Update available (${result.version})`
      }
      this.ref.detectChanges()
    })
    this.electronService.receiveIPC('update-error', (err: Error) => {
      console.log(err)
      this.updateAvailable = null
      this.updateRetrying = false
      this.retryUpdateText = `Failed to check for update: ${err.message}`
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

    const cacheSize = await this.settingsService.getCacheSize()
    this.cacheSize = Math.round(cacheSize / 1000000) + ' MB'
  }

  ngAfterViewInit() {
    $(this.themeDropdown.nativeElement).dropdown({
      onChange: (_value: string, text: string) => {
        this.settingsService.theme = text
      }
    })

    this.videoCheckbox.check(this.settingsService.downloadVideos)
  }

  async clearCache() {
    this.cacheSize = 'Please wait...'
    await this.settingsService.clearCache()
    this.cacheSize = 'Cleared!'
  }

  async downloadVideos(isChecked: boolean) {
    this.settingsService.downloadVideos = isChecked
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

  retryUpdate() {
    if (this.updateRetrying == false) {
      this.updateRetrying = true
      this.retryUpdateText = 'Retrying...'
      this.ref.detectChanges()
      this.electronService.sendIPC('retry-update', undefined)
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