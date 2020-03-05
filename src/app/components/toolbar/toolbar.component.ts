import { Component, OnInit } from '@angular/core'
import { ElectronService } from '../../core/services/electron.service'

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

  isMaximized: boolean

  constructor(private electronService: ElectronService) { }

  ngOnInit() {
    this.isMaximized = this.electronService.currentWindow.isMaximized()
  }

  minimize() {
    this.electronService.currentWindow.minimize()
  }

  maximize() {
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