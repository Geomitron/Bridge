import { Component } from '@angular/core'
import { ElectronService } from '../../core/services/electron.service'

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

  constructor(private electronService: ElectronService) { }

  minimize() {
    this.electronService.currentWindow.minimize()
  }

  maximize() {
    this.electronService.currentWindow.maximize()
  }

  close() {
    this.electronService.quit()
  }
}