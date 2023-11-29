import { Directive, ElementRef, EventEmitter, Output } from '@angular/core'

@Directive({
	selector: '[appCheckbox]',
})
export class CheckboxDirective {
	@Output() checked = new EventEmitter<boolean>()

	_isChecked = false

	constructor(private checkbox: ElementRef) { }

	// ngAfterViewInit() {
	// TODO
	// $(this.checkbox.nativeElement).checkbox({
	// 	onChecked: () => {
	// 		this.checked.emit(true)
	// 		this._isChecked = true
	// 	},
	// 	onUnchecked: () => {
	// 		this.checked.emit(false)
	// 		this._isChecked = false
	// 	},
	// })
	// }

	check(isChecked: boolean) {
		this._isChecked = isChecked
		if (isChecked) {
			this.checkbox.nativeElement.checked = true
		} else {
			this.checkbox.nativeElement.checked = false
		}
	}

	get isChecked() {
		return this._isChecked
	}
}
