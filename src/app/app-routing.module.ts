import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'
import { BrowseComponent } from './components/browse/browse.component'
import { SettingsComponent } from './components/settings/settings.component'


const routes: Routes = [
  { path: 'browse', component: BrowseComponent },
  { path: 'library', component: BrowseComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'about', component: BrowseComponent }, // TODO: replace these with the correct components
  { path: '**', redirectTo: '/browse'}
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }