import { Component, OnInit, ChangeDetectorRef } from '@angular/core'
import { ElectronService } from '../../core/services/electron.service'

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

  isMaximized: boolean
  updateAvailable = false

  constructor(private electronService: ElectronService, private ref: ChangeDetectorRef) { }

  async ngOnInit() {
    this.isMaximized = this.electronService.currentWindow.isMaximized()
    this.electronService.currentWindow.on('unmaximize', () => {
      this.isMaximized = false
      this.ref.detectChanges()
    })
    this.electronService.currentWindow.on('maximize', () => {
      this.isMaximized = true
      this.ref.detectChanges()
    })

    this.electronService.receiveIPC('update-available', () => {
      this.updateAvailable = true
    })
    this.updateAvailable = await this.electronService.invoke('get-update-available', undefined)
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