import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { BrowseComponent } from './components/browse/browse.component'
import { ChartSidebarComponent } from './components/browse/chart-sidebar/chart-sidebar.component'
import { ResultTableRowComponent } from './components/browse/result-table/result-table-row/result-table-row.component'
import { ResultTableComponent } from './components/browse/result-table/result-table.component'
import { SearchBarComponent } from './components/browse/search-bar/search-bar.component'
import { DownloadsModalComponent } from './components/browse/status-bar/downloads-modal/downloads-modal.component'
import { StatusBarComponent } from './components/browse/status-bar/status-bar.component'
import { SettingsComponent } from './components/settings/settings.component'
import { ToolbarComponent } from './components/toolbar/toolbar.component'
import { CheckboxDirective } from './core/directives/checkbox.directive'
import { ProgressBarDirective } from './core/directives/progress-bar.directive'

@NgModule({
	declarations: [
		AppComponent,
		ToolbarComponent,
		BrowseComponent,
		SearchBarComponent,
		StatusBarComponent,
		ResultTableComponent,
		ChartSidebarComponent,
		ResultTableRowComponent,
		DownloadsModalComponent,
		ProgressBarDirective,
		CheckboxDirective,
		SettingsComponent,
	],
	imports: [
		BrowserModule,
		AppRoutingModule,
		FormsModule,
	],
	bootstrap: [AppComponent],
})
export class AppModule { }
