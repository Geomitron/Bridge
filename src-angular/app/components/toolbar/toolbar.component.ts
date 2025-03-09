import { ChangeDetectorRef, Component, OnInit } from '@angular/core'

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	standalone: false,
})
export class ToolbarComponent implements OnInit {

	isMaximized: boolean
	updateAvailable: 'yes' | 'no' | 'error' = 'no'

	constructor(private ref: ChangeDetectorRef) { }

	async ngOnInit() {
		this.isMaximized = await window.electron.invoke.isMaximized()
		window.electron.on.minimized(() => {
			this.isMaximized = false
			this.ref.detectChanges()
		})
		window.electron.on.maximized(() => {
			this.isMaximized = true
			this.ref.detectChanges()
		})

		window.electron.on.updateAvailable(result => {
			this.updateAvailable = result !== null ? 'yes' : 'no'
			this.ref.detectChanges()
		})
		window.electron.on.updateError(() => {
			this.updateAvailable = 'error'
			this.ref.detectChanges()
		})
		this.updateAvailable = await window.electron.invoke.getUpdateAvailable()
		this.ref.detectChanges()
	}

	minimize() {
		window.electron.emit.minimize()
	}

	async toggleMaximized() {
		if (await window.electron.invoke.isMaximized()) {
			window.electron.emit.restore()
		} else {
			window.electron.emit.maximize()
		}
		this.isMaximized = !this.isMaximized
	}

	close() {
		window.electron.emit.quit()
	}
}
