import { enableProdMode, LOCALE_ID, provideZoneChangeDetection } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module.js'
import { environment } from './environments/environment.js'

window.electron.on.errorLog(data => console.error(data))

if (environment.production) {
	enableProdMode()
}

platformBrowserDynamic()
	.bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], providers: [object Map], })
	.catch(err => console.error(err))
