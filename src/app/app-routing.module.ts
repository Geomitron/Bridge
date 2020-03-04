import { NgModule } from '@angular/core'
import { Routes, RouterModule, RouteReuseStrategy } from '@angular/router'
import { BrowseComponent } from './components/browse/browse.component'
import { SettingsComponent } from './components/settings/settings.component'
import { TabPersistStrategy } from './core/tab-persist.strategy'

// TODO: replace these with the correct components
const routes: Routes = [
  { path: 'browse', component: BrowseComponent, data: { shouldReuse: true } },
  { path: 'library', redirectTo: '/browse' },
  { path: 'settings', component: SettingsComponent, data: { shouldReuse: true } },
  { path: 'about', redirectTo: '/browse' },
  { path: '**', redirectTo: '/browse' }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: TabPersistStrategy },
  ]
})
export class AppRoutingModule { }