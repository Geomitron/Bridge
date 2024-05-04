import { HttpClient } from '@angular/common/http'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormControl, NonNullableFormBuilder, Validators } from '@angular/forms'

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

	public reportOptions = [
		`Doesn't follow Chorus guidelines`,
		`Doesn't meet chart quality standards`,
		'No notes / chart ends immediately',
		`Download doesn't work`,
		`Doesn't appear in Clone Hero`,
		'Other',
	] as const
	public reportForm: ReturnType<this['getForm']>
	public reportSent = false
	public reportMessage = ''

	constructor(
		private http: HttpClient,
		private fb: NonNullableFormBuilder,
	) { }

	ngOnInit(): void {
		this.selectedVersion = new FormControl<ChartData>(this.displayVersions[0], { nonNullable: true })
		this.selectedVersion.valueChanges.subscribe(v => this.selectedVersionChanges.emit(v))
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.reportForm = this.getForm() as any
	}

	getForm() {
		return this.fb.group({
			reportOption: this.fb.control(null as ChartSidebarMenutComponent['reportOptions'][number] | null, [Validators.required]),
			reportExtraInfo: this.fb.control('', [Validators.required]),
		})
	}

	get reportOption() { return this.reportForm.get('reportOption')! }
	get reportExtraInfo() { return this.reportForm.get('reportExtraInfo')! }

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

	isFalseReportOption() {
		switch (this.reportOption.value) {
			case 'No notes / chart ends immediately': return true
			case `Download doesn't work`: return true
			case `Doesn't appear in Clone Hero`: return true
			default: return false
		}
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
