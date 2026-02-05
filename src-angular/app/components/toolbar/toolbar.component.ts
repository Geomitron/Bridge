import { Component, OnInit, signal } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { NgClass } from '@angular/common'

@Component({
	selector: 'app-toolbar',
	standalone: true,
	imports: [RouterLink, RouterLinkActive, NgClass],
	templateUrl: './toolbar.component.html',
})
export class ToolbarComponent implements OnInit {

	isMaximized = signal(false)
	updateAvailable = signal<'yes' | 'no' | 'error'>('no')

	async ngOnInit() {
		this.isMaximized.set(await window.electron.invoke.isMaximized())
		window.electron.on.minimized(() => {
			this.isMaximized.set(false)
		})
		window.electron.on.maximized(() => {
			this.isMaximized.set(true)
		})

		window.electron.on.updateAvailable(result => {
			this.updateAvailable.set(result !== null ? 'yes' : 'no')
		})
		window.electron.on.updateError(() => {
			this.updateAvailable.set('error')
		})
		this.updateAvailable.set(await window.electron.invoke.getUpdateAvailable())
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
		this.isMaximized.set(!this.isMaximized())
	}

	close() {
		window.electron.emit.quit()
	}
}
