import { Component, ElementRef, HostBinding, OnInit, Renderer2, ViewChild, signal, computed, inject, effect } from '@angular/core'
import { ReactiveFormsModule, FormControl } from '@angular/forms'
import { NgClass, NgStyle } from '@angular/common'

import _ from 'lodash'
import { Difficulty, Instrument, NotesData } from 'scan-chart'
import { DownloadService } from 'src-angular/app/core/services/download.service'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { setlistNames } from 'src-shared/setlist-names'
import { difficulties, difficultyDisplay, driveLink, hasIssues, instruments, msToRoughTime, removeStyleTags, shortInstrumentDisplay } from 'src-shared/UtilFunctions'

import { RemoveStyleTagsPipe } from '../../../core/pipes/remove-style-tags.pipe'
import { ChartSidebarInstrumentComponent } from './chart-sidebar-instrument/chart-sidebar-instrument.component'
import { ChartSidebarMenuComponent } from './chart-sidebar-menu/chart-sidebar-menu.component'
import { ChartSidebarPreviewComponent } from './chart-sidebar-preview/chart-sidebar-preview.component'

@Component({
	selector: 'app-chart-sidebar',
	standalone: true,
	imports: [
		ReactiveFormsModule,
		NgClass,
		NgStyle,
		RemoveStyleTagsPipe,
		ChartSidebarInstrumentComponent,
		ChartSidebarMenuComponent,
		ChartSidebarPreviewComponent,
	],
	templateUrl: './chart-sidebar.component.html',
})
export class ChartSidebarComponent implements OnInit {
	private renderer = inject(Renderer2)
	private searchService = inject(SearchService)
	private downloadService = inject(DownloadService)
	settingsService = inject(SettingsService)

	@HostBinding('class.contents') contents = true

	@ViewChild('menu') menu: ElementRef
	@ViewChild('libraryDirectoryErrorModal') libraryDirectoryErrorModal: ElementRef<HTMLDialogElement>

	shortInstrumentDisplay = shortInstrumentDisplay
	difficultyDisplay = difficultyDisplay
	private guitarlikeInstruments: Instrument[] = [
		'guitar', 'guitarcoop', 'rhythm', 'bass', 'keys', 'guitarghl', 'guitarcoopghl', 'rhythmghl', 'bassghl',
	]
	private unlisten?: () => void

	albumLoading = signal(true)
	iconLoading = signal(true)
	menuVisible = signal(false)

	selectedChart = signal<ChartData | null>(null)
	charts = signal<ChartData[][] | null>(null)

	instrumentDropdown: FormControl<Instrument>
	difficultyDropdown: FormControl<Difficulty>

	// Computed properties
	albumArtMd5 = computed(() => {
		const chartsList = this.charts()
		return _.flatMap(chartsList ?? []).find(c => !!c.albumArtMd5)?.albumArtMd5 || null
	})

	hasIcons = computed(() => !!this.searchService.availableIcons().length)

	icon = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return null
		const iconName = (chart.icon || removeStyleTags(chart.charter ?? 'N/A').toLowerCase()) + '.'
		if (iconName === 'unknown charter') { return null }
		return this.searchService.availableIcons()?.find(i => i.toLowerCase().startsWith(iconName)) || null
	})

	iconTooltip = computed(() => {
		const chart = this.selectedChart()
		if (!chart?.icon) {
			return null
		}
		return setlistNames[chart.icon] ?? null
	})

	effectiveLength = computed(() => {
		const chart = this.selectedChart()
		return chart ? msToRoughTime(chart.notesData.effectiveLength) : ''
	})

	extraLengthSeconds = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return 0
		return chart.song_length ?
			_.round((chart.song_length - chart.notesData.effectiveLength) / 1000, 1)
			: _.round(chart.notesData.effectiveLength / 1000, 1)
	})

	hasIssuesComputed = computed(() => {
		const chart = this.selectedChart()
		return chart ? hasIssues(chart) : false
	})

	metadataIssues = computed(() => {
		const chart = this.selectedChart()
		return chart ? chart.metadataIssues.filter(i => !['extraValue'].includes(i.metadataIssue)) : []
	})

	folderIssues = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return []
		return _.chain(chart.folderIssues)
			.filter(i => !['albumArtSize', 'invalidIni', 'multipleVideo', 'badIniLine'].includes(i.folderIssue))
			.uniqBy(i => i.folderIssue)
			.value()
	})

	globalChartIssues = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return []
		return _.chain(chart.notesData.chartIssues)
			.filter(i => i.instrument === null)
			.filter(i => i.noteIssue !== 'isDefaultBPM')
			.groupBy(i => i.noteIssue)
			.values()
			.map(issueGroup => this.getGlobalChartIssueText(issueGroup))
			.value()
	})

	trackIssuesGroups = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return []
		return _.chain(chart.notesData.chartIssues)
			.filter(g => g.instrument !== null)
			.sortBy(
				g => instruments.indexOf(g.instrument!),
				g => difficulties.indexOf(g.difficulty || '(all difficulties)' as Difficulty),
			)
			.groupBy(
				g => `${_.capitalize(g.instrument!)
					} - ${_.capitalize(g.difficulty || '(all difficulties)' as Difficulty)} Issues Found:`
			)
			.toPairs()
			.map(([groupName, group]) => ({
				groupName,
				issues: _.chain(group)
					.filter(
						i => !['badEndEvent', 'emptyStarPower', 'emptySoloSection', 'emptyFlexLane', 'babySustain'].includes(i.noteIssue)
					)
					.groupBy(i => i.noteIssue)
					.values()
					.map(issueGroup => this.getTrackIssueText(issueGroup))
					.value(),
			}))
			.filter(g => g.issues.length > 0)
			.value()
	})

	boolProperties = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return []
		const notesData = chart.notesData
		const showGuitarlikeProperties = _.intersection(this.instrumentsList(), this.guitarlikeInstruments).length > 0
		const showDrumlikeProperties = _.intersection(this.instrumentsList(), ['drums']).length > 0
		return _.compact([
			showGuitarlikeProperties ? { value: notesData.hasSoloSections, text: 'Solo Sections' } : null,
			{ value: notesData.hasLyrics, text: 'Lyrics' },
			showGuitarlikeProperties ? { value: notesData.hasForcedNotes, text: 'Forced Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasTapNotes, text: 'Tap Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasOpenNotes, text: 'Open Notes' } : null,
			showDrumlikeProperties ? { value: notesData.has2xKick, text: '2x Kick' } : null,
			showDrumlikeProperties ? { value: notesData.hasFlexLanes, text: 'Roll Lanes' } : null,
			{ value: chart.hasVideoBackground, text: 'Video Background' },
		])
	})

	instrumentsList = computed((): Instrument[] => {
		const chart = this.selectedChart()
		if (!chart) { return [] }
		return _.chain(chart.notesData.noteCounts)
			.filter(nc => nc.count > 0)
			.map(nc => nc.instrument)
			.uniq()
			.sortBy(i => instruments.indexOf(i))
			.value()
	})

	difficultiesList = computed((): Difficulty[] => {
		const chart = this.selectedChart()
		if (!chart) { return [] }
		return _.chain(chart.notesData.noteCounts)
			.filter(nc => nc.instrument === this.instrumentDropdown?.value && nc.count > 0)
			.map(nc => nc.difficulty)
			.sortBy(d => difficulties.indexOf(d))
			.value()
	})

	averageNps = computed(() => {
		const count = this.noteCount()
		const chart = this.selectedChart()
		if (!chart || count < 2) {
			return 0
		} else {
			return _.round(count / (chart.notesData.effectiveLength / 1000), 1)
		}
	})

	maximumNps = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return 0
		const filtered = chart.notesData.maxNps.filter(track =>
			track.instrument === this.instrumentDropdown?.value && track.difficulty === this.difficultyDropdown?.value
		)
		return filtered[0]?.nps ?? 0
	})

	noteCount = computed(() => {
		const chart = this.selectedChart()
		if (!chart) return 0
		const filtered = chart.notesData.noteCounts.filter(track =>
			track.instrument === this.instrumentDropdown?.value && track.difficulty === this.difficultyDropdown?.value
		)
		return filtered[0]?.count ?? 0
	})

	constructor() {
		// Reset on new search
		effect(() => {
			const event = this.searchService.searchEvent()
			if (event?.type === 'new') {
				this.charts.set(null)
				this.selectedChart.set(null)
			}
		}, { allowSignalWrites: true })
	}

	ngOnInit() {
		this.instrumentDropdown = new FormControl<Instrument>(this.getDefaultInstrument(), { nonNullable: true })

		this.instrumentDropdown.valueChanges.subscribe(() => {
			if (!this.difficultiesList().some(d => d === this.difficultyDropdown.value)) {
				this.difficultyDropdown.setValue(this.getDefaultDifficulty(), { emitEvent: false })
			}
		})
		this.difficultyDropdown = new FormControl<Difficulty>(this.getDefaultDifficulty(), { nonNullable: true })
	}

	private getGlobalChartIssueText(issueGroup: NotesData['chartIssues']) {
		const one = issueGroup.length === 1
		const len = issueGroup.length
		switch (issueGroup[0].noteIssue) {
			case 'misalignedTimeSignature':
				return `There ${one ? 'is' : 'are'} ${len} misaligned time signature marker${one ? '' : 's'} in this chart.`
			case 'badEndEvent':
				return `There ${one ? 'is' : 'are'} ${len} invalid "end" event${one ? '' : 's'} in this chart.`
			default:
				return issueGroup[0].description
		}
	}

	private getTrackIssueText(issueGroup: NotesData['chartIssues']) {
		const one = issueGroup.length === 1
		const len = issueGroup.length
		switch (issueGroup[0].noteIssue) {
			case 'badStarPower':
				return `There ${one ? 'is' : 'are'} ${len} ignored star power event${one ? '' : 's'
					} due to the .ini "multiplier_note" setting.`
			case 'difficultyForbiddenNote':
				return `There ${one ? 'is' : 'are'} ${len} note${one ? '' : 's'
					} that ${one ? 'is' : 'are'}n't allowed on this track's difficulty.`
			case 'invalidChord':
				return `There ${one ? 'is' : 'are'} ${len} chord${one ? '' : 's'
					} that ${one ? 'is' : 'are'}n't allowed for this instrument type.`
			case 'brokenNote':
				return `There ${one ? 'is' : 'are'} ${len} broken note${one ? '' : 's'} on this track.`
			case 'badSustainGap':
				return one ? 'There is 1 note that has a sustain gap that is too small.' : `There are ${len
					} notes that have sustain gaps that are too small.`
			default:
				return issueGroup[0].description
		}
	}

	/**
	 * Displays the information for the selected song.
	 */
	async onRowClicked(song: ChartData[]) {
		const newCharts = _.chain(song)
			.groupBy(c => c.versionGroupId)
			.values()
			.map(versionGroup => _.sortBy(versionGroup, vg => vg.modifiedTime).reverse())
			.value()
		const currentChart = this.selectedChart()
		if (currentChart?.albumArtMd5 !== newCharts[0][0].albumArtMd5) {
			this.albumLoading.set(true)
		}
		if ((currentChart?.icon || currentChart?.charter) !== (newCharts[0][0].icon || newCharts[0][0].charter)) {
			this.iconLoading.set(true)
		}
		this.charts.set(newCharts)
		this.selectedChart.set(newCharts[0][0])
		this.instrumentDropdown.setValue(this.getDefaultInstrument())
		this.difficultyDropdown.setValue(this.getDefaultDifficulty())
	}

	onSourceLinkClicked() {
		const chart = this.selectedChart()
		if (chart) {
			window.electron.emit.openUrl(driveLink(chart.applicationDriveId))
		}
	}

	getDefaultInstrument(): Instrument {
		const instList = this.instrumentsList()
		const searchInst = this.searchService.instrument()
		return instList.some(i => i === searchInst)
			? searchInst!
			: instList[0] || 'guitar'
	}

	getDefaultDifficulty(): Difficulty {
		const diffList = this.difficultiesList()
		const searchDiff = this.searchService.difficulty()
		return diffList.some(d => d === searchDiff)
			? searchDiff!
			: diffList[0] || 'expert'
	}

	/**
	 * Adds the selected chart to the download queue.
	 */
	onDownloadClicked() {
		const chart = this.selectedChart()
		if (this.settingsService.libraryDirectory) {
			if (chart) {
				this.downloadService.addDownload(chart)
			}
		} else {
			this.libraryDirectoryErrorModal.nativeElement.showModal()
		}
	}

	showMenu() {
		this.menuVisible.set(true)
		this.unlisten = this.renderer.listen('window', 'click', (e: Event) => {
			if (this.menuVisible() && !(this.menu.nativeElement as HTMLElement).contains(e.target as HTMLElement)) {
				this.menuVisible.set(false)
				if (this.unlisten) {
					this.unlisten()
					this.unlisten = undefined
				}
			}
		})
	}

	setSelectedChart(chart: ChartData) {
		this.selectedChart.set(chart)
	}
}
