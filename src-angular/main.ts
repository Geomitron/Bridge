import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module.js'
import { environment } from './environments/environment.js'

console.log('[DEBUG] main.ts loaded, window.electron:', typeof window.electron, window.electron ? Object.keys(window.electron) : 'undefined')

window.electron.on.errorLog(data => console.error(data))

if (environment.production) {
	enableProdMode()
}

platformBrowserDynamic()
	.bootstrapModule(AppModule)
	.catch(err => console.error(err))
