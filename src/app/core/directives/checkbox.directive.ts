import { Directive, ElementRef, Output, EventEmitter, AfterViewInit } from '@angular/core'

@Directive({
  selector: '[appCheckbox]'
})
export class CheckboxDirective implements AfterViewInit {
  @Output() checked = new EventEmitter<boolean>()

  constructor(private checkbox: ElementRef) { }

  ngAfterViewInit() {
    $(this.checkbox.nativeElement).checkbox({
      onChecked: () => {
        this.checked.emit(true)
      },
      onUnchecked: () => {
        this.checked.emit(false)
      }
    })
  }

  check(isChecked: boolean) {
    if (isChecked) {
      $(this.checkbox.nativeElement).checkbox('check')
    } else {
      $(this.checkbox.nativeElement).checkbox('uncheck')
    }
  }
}