import { AfterViewInit, Directive, ElementRef, EventEmitter, Output } from '@angular/core'

@Directive({
	selector: '[appCheckbox]',
})
export class CheckboxDirective implements AfterViewInit {
	@Output() checked = new EventEmitter<boolean>()

	_isChecked = false

	constructor(private checkbox: ElementRef) { }

	ngAfterViewInit() {
		$(this.checkbox.nativeElement).checkbox({
			onChecked: () => {
				this.checked.emit(true)
				this._isChecked = true
			},
			onUnchecked: () => {
				this.checked.emit(false)
				this._isChecked = false
			},
		})
	}

	check(isChecked: boolean) {
		this._isChecked = isChecked
		if (isChecked) {
			$(this.checkbox.nativeElement).checkbox('check')
		} else {
			$(this.checkbox.nativeElement).checkbox('uncheck')
		}
	}

	get isChecked() {
		return this._isChecked
	}
}
