import { enableProdMode, LOCALE_ID } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module.js'
import { environment } from './environments/environment.js'

window.electron.on.errorLog(data => console.error(data))

if (environment.production) {
	enableProdMode()
}

platformBrowserDynamic()
	.bootstrapModule(AppModule, {
		providers: [{ provide: LOCALE_ID, useValue: document.documentElement.lang || 'en-US' }],
	})
	.catch(err => console.error(err))
