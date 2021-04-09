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

  constructor(private element: ElementRef) {
    this.progress = _.throttle((percent: number) => this.$progressBar.progress('set').percent(percent), 100)
  }

  private get $progressBar() {
    if (!this._$progressBar) {
      this._$progressBar = $(this.element.nativeElement)
    }
    return this._$progressBar
  }
  private _$progressBar: any
}