import { Directive, ElementRef, Input } from '@angular/core'
import * as _ from 'underscore'

@Directive({
  selector: '[appProgressBar]'
})
export class ProgressBarDirective {

  progress: (percent: number) => void

  @Input() set percent(percent: number) {
    this.progress(percent)
  }

  constructor(element: ElementRef) {
    const $progressBar = $(element.nativeElement)
    this.progress = _.throttle((percent: number) => $progressBar.progress({ percent }), 100)
    this.percent = 0
  }
}