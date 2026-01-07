import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { BrowseComponent } from './components/browse/browse.component'
import { ChartSidebarInstrumentComponent } from './components/browse/chart-sidebar/chart-sidebar-instrument/chart-sidebar-instrument.component'
import { ChartSidebarMenutComponent } from './components/browse/chart-sidebar/chart-sidebar-menu/chart-sidebar-menu.component'
import { ChartSidebarPreviewComponent } from './components/browse/chart-sidebar/chart-sidebar-preview/chart-sidebar-preview.component'
import { ChartSidebarComponent } from './components/browse/chart-sidebar/chart-sidebar.component'
import { ResultTableRowComponent } from './components/browse/result-table/result-table-row/result-table-row.component'
import { ResultTableComponent } from './components/browse/result-table/result-table.component'
import { SearchBarComponent } from './components/browse/search-bar/search-bar.component'
import { DownloadsModalComponent } from './components/browse/status-bar/downloads-modal/downloads-modal.component'
import { StatusBarComponent } from './components/browse/status-bar/status-bar.component'
import { SettingsComponent } from './components/settings/settings.component'
import { SongListsComponent } from './components/songlists/songlists.component'
import { SongListDetailComponent } from './components/songlists/songlist-detail/songlist-detail.component'
import { AddToListModalComponent } from './components/songlists/add-to-list-modal/add-to-list-modal.component'
import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { ToolsComponent } from './components/tools/tools.component'
import { RemoveStyleTagsPipe } from './core/pipes/remove-style-tags.pipe'

@NgModule({
	declarations: [
		AppComponent,
		ToolbarComponent,
		BrowseComponent,
		SearchBarComponent,
		StatusBarComponent,
		ResultTableComponent,
		ChartSidebarComponent,
		ChartSidebarInstrumentComponent,
		ChartSidebarMenutComponent,
		ChartSidebarPreviewComponent,
		ResultTableRowComponent,
		DownloadsModalComponent,
		RemoveStyleTagsPipe,
		SettingsComponent,
		SongListsComponent,
		SongListDetailComponent,
		AddToListModalComponent,
		ToolsComponent,
	],
	bootstrap: [AppComponent], imports: [
		BrowserModule,
		AppRoutingModule,
		FormsModule,
		ReactiveFormsModule,
	], providers: [provideHttpClient(withInterceptorsFromDi())],
})
export class AppModule { }
