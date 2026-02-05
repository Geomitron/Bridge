import { enableProdMode, provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { provideRouter, RouteReuseStrategy } from '@angular/router'
import { provideHttpClient } from '@angular/common/http'

import { AppComponent } from './app/app.component.js'
import { routes } from './app/app.routes.js'
import { TabPersistStrategy } from './app/core/tab-persist.strategy.js'
import { environment } from './environments/environment.js'

console.log('[DEBUG] main.ts loaded, window.electron:', typeof window.electron, window.electron ? Object.keys(window.electron) : 'undefined')

window.electron.on.errorLog(data => console.error(data))

if (environment.production) {
	enableProdMode()
}

bootstrapApplication(AppComponent, {
	providers: [
		provideZonelessChangeDetection(),
		provideRouter(routes),
		provideHttpClient(),
		{ provide: RouteReuseStrategy, useClass: TabPersistStrategy },
	],
}).catch(err => console.error(err))
