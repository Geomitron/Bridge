import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { BrowseComponent } from './components/browse/browse.component'

@NgModule({
  declarations: [
    AppComponent,
    ToolbarComponent,
    BrowseComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }