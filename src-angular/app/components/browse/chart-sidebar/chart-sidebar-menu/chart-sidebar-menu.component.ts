import { HttpClient } from '@angular/common/http'
import { Component, input, output, OnInit, signal, computed, inject } from '@angular/core'
import { ReactiveFormsModule, FormControl, NonNullableFormBuilder, Validators } from '@angular/forms'
import { DatePipe } from '@angular/common'

import _ from 'lodash'
import { environment } from 'src-angular/environments/environment'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { driveLink } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar-menu',
	standalone: true,
	imports: [ReactiveFormsModule, DatePipe],
	templateUrl: './chart-sidebar-menu.component.html',
})
export class ChartSidebarMenuComponent implements OnInit {
	private http = inject(HttpClient)
	private fb = inject(NonNullableFormBuilder)

	chartVersions = input.required<ChartData[]>()
	selectedVersionChanges = output<ChartData>()

	selectedVersion: FormControl<ChartData>

	reportOptions = [
		`Doesn't meet chart quality standards`,
		'No notes / chart ends immediately',
		`Download doesn't work`,
		`Doesn't appear in Clone Hero`,
		'Other',
	] as const
	reportForm: ReturnType<this['getForm']>
	reportState = signal<'not-sent' | 'sending' | 'sent'>('not-sent')
	reportMessage = signal('')

	displayVersions = computed(() => {
		return _.sortBy(this.chartVersions(), v => v.modifiedTime).reverse()
	})

	ngOnInit(): void {
		this.selectedVersion = new FormControl<ChartData>(this.displayVersions()[0], { nonNullable: true })
		this.selectedVersion.valueChanges.subscribe(v => this.selectedVersionChanges.emit(v))
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.reportForm = this.getForm() as any
	}

	getForm() {
		return this.fb.group({
			reportOption: this.fb.control(null as ChartSidebarMenuComponent['reportOptions'][number] | null, [Validators.required]),
			reportExtraInfo: this.fb.control('', [Validators.required, Validators.minLength(4)]),
		})
	}

	get reportOption() { return this.reportForm.get('reportOption')! }
	get reportExtraInfo() { return this.reportForm.get('reportExtraInfo')! }

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
				breadcrumbs.push({ name: this.removeFirstPathSegment(version.internalPath), link: null })
			}
		}

		return breadcrumbs
	}

	private removeFirstPathSegment(path: string) {
		const segments = path.split('/').filter(p => p.length > 0)
		if (segments.length > 1) {
			return segments.slice(1).join('/')
		}
		return path
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

	copyLink(hash: string) {
		navigator.clipboard.writeText(`https://enchor.us/chart/${hash}`)
	}
	copyHash(hash: string) {
		navigator.clipboard.writeText(hash)
	}

	report() {
		if (this.reportForm.valid && this.reportState() === 'not-sent') {
			this.reportState.set('sending')
			this.http.post<{ message: string }>(`${environment.apiUrl}/report`, {
				chartId: this.selectedVersion.value.chartId,
				reason: this.reportOption.value,
				extraInfo: this.reportExtraInfo.value,
			}).subscribe(response => {
				this.reportMessage.set(response.message)
				this.reportState.set('sent')
			})
		} else {
			this.reportOption.markAsTouched()
			this.reportExtraInfo.markAsTouched()
		}
	}
}
