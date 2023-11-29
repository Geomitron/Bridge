import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'
import { environment } from './environments/environment'

window.electron.on.errorLog(data => console.error(data))

if (environment.production) {
	enableProdMode()
}

platformBrowserDynamic().bootstrapModule(AppModule)
	.catch(err => console.error(err))
