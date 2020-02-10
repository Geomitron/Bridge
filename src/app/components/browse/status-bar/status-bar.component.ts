import { Component } from '@angular/core'

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

  downloading = false

  constructor() { }

  showDownloads() {
    $('#downloadsModal').modal('show')
  }
}