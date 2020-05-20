import { Component, OnInit, ChangeDetectorRef } from '@angular/core'
import { ElectronService } from '../../core/services/electron.service'
// import { autoUpdater, UpdateInfo } from 'electron-updater'
// autoUpdater.autoDownload = false
// autoUpdater.on('error', (err) => {})
// autoUpdater.on('checking-for-update', () => {})
// autoUpdater.on('update-available', (info: UpdateInfo) => {})
// autoUpdater.on('update-not-available', () => {})
// autoUpdater.on('download-progress', (progress) => {
//   console.log(progress.bytesPerSecond, progress.percent, progress.transferred, progress.total)
// })
// autoUpdater.on('update-downloaded', (info: UpdateInfo) => {})
// autoUpdater.currentVersion // TODO: display this in the corner or on the about page?
// autoUpdater.logger = null
// autoUpdater.checkForUpdates()
// autoUpdater.downloadUpdate()
// autoUpdater.quitAndInstall(false) // By default; autoUpdater installs a downloaded update on the next program restart
// TODO: check for updates on initialization; show a button indicating a new version can be downloaded


@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

  isMaximized: boolean

  constructor(private electronService: ElectronService, private ref: ChangeDetectorRef) { }

  ngOnInit() {
    this.isMaximized = this.electronService.currentWindow.isMaximized()
    this.electronService.currentWindow.on('unmaximize', () => {
      this.isMaximized = false
      this.ref.detectChanges()
    })
    this.electronService.currentWindow.on('maximize', () => {
      this.isMaximized = true
      this.ref.detectChanges()
    })
  }

  minimize() {
    this.electronService.currentWindow.minimize()
  }

  toggleMaximized() {
    if (this.isMaximized) {
      this.electronService.currentWindow.restore()
    } else {
      this.electronService.currentWindow.maximize()
    }
    this.isMaximized = !this.isMaximized
  }

  close() {
    this.electronService.quit()
  }
}