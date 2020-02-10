import { Directive, ElementRef, Output, EventEmitter } from '@angular/core'

@Directive({
  selector: '[appCheckbox]'
})
export class CheckboxDirective {
  @Output() checked = new EventEmitter<boolean>()

  private _checked = false

  constructor(element: ElementRef) {
    $(element.nativeElement).checkbox({
      onChange: () => {
        this._checked = !this._checked
        this.checked.emit(this._checked)
      }
    })
  }
}