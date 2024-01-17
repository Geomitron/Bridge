import { HttpClient } from '@angular/common/http'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormControl, Validators } from '@angular/forms'

import { sortBy } from 'lodash'
import { environment } from 'src-angular/environments/environment'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { driveLink } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar-menu',
	templateUrl: './chart-sidebar-menu.component.html',
})
export class ChartSidebarMenutComponent implements OnInit {

	@Input() chartVersions: ChartData[]
	@Output() selectedVersionChanges = new EventEmitter<ChartData>()

	public selectedVersion: FormControl<ChartData>

	public reportOptions = [`Doesn't follow Chorus guidelines`, `Doesn't meet chart quality standards`, 'Other']
	public reportOption: FormControl<string>
	public reportExtraInfo: FormControl<string>
	public reportSent = false
	public reportMessage = ''

	constructor(
		private http: HttpClient,
	) { }

	ngOnInit(): void {
		this.selectedVersion = new FormControl<ChartData>(this.displayVersions[0], { nonNullable: true })
		this.selectedVersion.valueChanges.subscribe(v => this.selectedVersionChanges.emit(v))

		this.reportOption = new FormControl<string>(this.reportOptions[0], { nonNullable: true })
		this.reportExtraInfo = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
	}

	get displayVersions() {
		return sortBy(this.chartVersions, v => v.modifiedTime).reverse()
	}

	getVersionBreadcrumbs(version: ChartData) {
		const breadcrumbs: { name: string; link: string | null }[] = []

		breadcrumbs.push({
			name: version.packName ?? `${version.applicationUsername}'s Charts`,
			link: driveLink(version.applicationDriveId),
		})

		if (version.applicationDriveId !== version.parentFolderId) {
			breadcrumbs.push({ name: version.drivePath, link: driveLink(version.parentFolderId) })
		}

		if (version.driveFileId) {
			breadcrumbs.push({ name: version.driveFileName!, link: driveLink(version.driveFileId) })

			if (version.driveChartIsPack) {
				breadcrumbs.push({ name: this.joinPaths(version.archivePath!, version.chartFileName ?? ''), link: null })
			}
		}

		return breadcrumbs
	}

	openUrl(url: string) {
		window.electron.emit.openUrl(url)
	}

	joinPaths(...args: string[]) {
		return args.join('/')
			.replace(/\/+/g, '/')
			.replace(/^\/|\/$/g, '')
	}

	copyLink(hash: string) {
		navigator.clipboard.writeText(`https://enchor.us/?hash=${hash}`)
	}
	copyHash(hash: string) {
		navigator.clipboard.writeText(hash)
	}

	report() {
		if (this.reportExtraInfo.valid) {
			this.http.post(`${environment.apiUrl}/report`, {
				chartId: this.selectedVersion.value.chartId,
				reason: this.reportOption.value,
				extraInfo: this.reportExtraInfo.value,
			}).subscribe((response: { message: string }) => {
				this.reportMessage = response.message
				this.reportSent = true
			})
		} else {
			this.reportExtraInfo.markAsTouched()
		}
	}
}
