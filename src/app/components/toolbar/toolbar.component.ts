import { Component } from '@angular/core'
import { ElectronService } from 'src/app/core/services/electron.service'

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

  constructor(private electronService: ElectronService) { }

  minimize() {
    this.electronService.remote.getCurrentWindow().minimize()
  }

  maximize() {
    this.electronService.remote.getCurrentWindow().maximize()
  }

  close() {
    this.electronService.remote.app.quit()
  }
}