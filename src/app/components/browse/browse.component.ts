import { Component, OnInit } from '@angular/core'

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss']
})
export class BrowseComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    console.log('Browse component loaded.')
  }
}