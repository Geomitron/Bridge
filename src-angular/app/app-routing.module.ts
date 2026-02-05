import { NgModule } from '@angular/core'
import { RouteReuseStrategy, RouterModule, Routes } from '@angular/router'

import { BrowseComponent } from './components/browse/browse.component'
import { LibraryComponent } from './components/library/library.component'
import { VideoSyncComponent } from './components/video-sync/video-sync.component'
import { ArtStudioComponent } from './components/art-studio/art-studio.component'
import { LyricsComponent } from './components/lyrics/lyrics.component'
import { SettingsComponent } from './components/settings/settings.component'
import { ToolsComponent } from './components/tools/tools.component'
import { TabPersistStrategy } from './core/tab-persist.strategy'

const routes: Routes = [
	{ path: 'browse', component: BrowseComponent, data: { shouldReuse: true } },
	{ path: 'library', component: LibraryComponent, data: { shouldReuse: true } },
	{ path: 'video-sync', component: VideoSyncComponent, data: { shouldReuse: true } },
	{ path: 'art-studio', component: ArtStudioComponent, data: { shouldReuse: true } },
	{ path: 'lyrics', component: LyricsComponent, data: { shouldReuse: true } },
	{ path: 'tools', component: ToolsComponent, data: { shouldReuse: true } },
	{ path: 'settings', component: SettingsComponent, data: { shouldReuse: true } },
	{ path: 'about', redirectTo: '/browse' },
	{ path: '**', redirectTo: '/browse' },
]

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule],
	providers: [
		{ provide: RouteReuseStrategy, useClass: TabPersistStrategy },
	],
})
export class AppRoutingModule { }
