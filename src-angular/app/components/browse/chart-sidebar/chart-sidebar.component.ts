import { Component, ElementRef, HostBinding, OnInit, Renderer2, ViewChild } from '@angular/core'
import { FormControl } from '@angular/forms'

import _ from 'lodash'
import { Difficulty, Instrument, NotesData } from 'scan-chart'
import { DownloadService } from 'src-angular/app/core/services/download.service'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { setlistNames } from 'src-shared/setlist-names'
import { difficulties, difficultyDisplay, driveLink, hasIssues, instruments, msToRoughTime, removeStyleTags, shortInstrumentDisplay } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar',
	templateUrl: './chart-sidebar.component.html',
	standalone: false,
})
export class ChartSidebarComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@ViewChild('menu') menu: ElementRef
	@ViewChild('libraryDirectoryErrorModal') libraryDirectoryErrorModal: ElementRef<HTMLDialogElement>

	public shortInstrumentDisplay = shortInstrumentDisplay
	public difficultyDisplay = difficultyDisplay
	private guitarlikeInstruments: Instrument[] = [
		'guitar', 'guitarcoop', 'rhythm', 'bass', 'keys', 'guitarghl', 'guitarcoopghl', 'rhythmghl', 'bassghl',
	]
	private unlisten?: () => void

	albumLoading = true
	iconLoading = true
	public menuVisible = false

	selectedChart: ChartData | null = null
	charts: ChartData[][] | null = null

	public instrumentDropdown: FormControl<Instrument>
	public difficultyDropdown: FormControl<Difficulty>

	constructor(
		private renderer: Renderer2,
		private searchService: SearchService,
		private downloadService: DownloadService,
		public settingsService: SettingsService,
	) { }

	ngOnInit() {
		this.searchService.newSearch.subscribe(() => {
			this.charts = null
			this.selectedChart = null
		})
		this.instrumentDropdown = new FormControl<Instrument>(this.defaultInstrument, { nonNullable: true })
		this.searchService.instrument.valueChanges.subscribe(instrument => {
			if (this.instruments.some(i => i === instrument)) {
				this.instrumentDropdown.setValue(instrument!)
			}
		})
		this.instrumentDropdown.valueChanges.subscribe(() => {
			if (!this.difficulties.some(d => d === this.difficultyDropdown.value)) {
				this.difficultyDropdown.setValue(this.defaultDifficulty, { emitEvent: false })
			}
		})
		this.difficultyDropdown = new FormControl<Difficulty>(this.defaultDifficulty, { nonNullable: true })
		this.searchService.difficulty.valueChanges.subscribe(difficulty => {
			if (this.difficulties.some(d => d === difficulty)) {
				this.difficultyDropdown.setValue(difficulty!)
			}
		})
	}

	public get albumArtMd5() {
		return _.flatMap(this.charts ?? []).find(c => !!c.albumArtMd5)?.albumArtMd5 || null
	}

	public get hasIcons() { return !!this.searchService.availableIcons }
	public get icon() {
		const iconName = (this.selectedChart!.icon || removeStyleTags(this.selectedChart!.charter ?? 'N/A').toLowerCase()) + '.'
		if (iconName === 'unknown charter') { return null }
		return this.searchService.availableIcons?.find(i => i.toLowerCase().startsWith(iconName)) || null
	}

	public get iconTooltip() {
		if (!this.selectedChart!.icon) {
			return null
		}
		return setlistNames[this.selectedChart!.icon] ?? null
	}

	public get effectiveLength() {
		return msToRoughTime(this.selectedChart!.notesData.effectiveLength)
	}

	public get extraLengthSeconds() {
		return this.selectedChart!.song_length ?
			_.round((this.selectedChart!.song_length - this.selectedChart!.notesData.effectiveLength) / 1000, 1)
			: _.round(this.selectedChart!.notesData.effectiveLength / 1000, 1)
	}

	public get hasIssues() {
		return hasIssues(this.selectedChart!)
	}

	public get metadataIssues() {
		return this.selectedChart!.metadataIssues.filter(i => !['extraValue'].includes(i.metadataIssue))
	}
	public get folderIssues() {
		return _.chain(this.selectedChart!.folderIssues)
			.filter(i => !['albumArtSize', 'invalidIni', 'multipleVideo', 'badIniLine'].includes(i.folderIssue))
			.uniqBy(i => i.folderIssue)
			.value()
	}

	public get globalChartIssues() {
		return _.chain(this.selectedChart!.notesData.chartIssues)
			.filter(i => i.instrument === null)
			.filter(i => i.noteIssue !== 'isDefaultBPM')
			.groupBy(i => i.noteIssue)
			.values()
			.map(issueGroup => this.getGlobalChartIssueText(issueGroup))
			.value()
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

	public get trackIssuesGroups() {
		return _.chain(this.selectedChart!.notesData.chartIssues)
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

	public get boolProperties(): ({ value: boolean; text: string })[] {
		const notesData = this.selectedChart!.notesData
		const showGuitarlikeProperties = _.intersection(this.instruments, this.guitarlikeInstruments).length > 0
		const showDrumlikeProperties = _.intersection(this.instruments, ['drums']).length > 0
		return _.compact([
			showGuitarlikeProperties ? { value: notesData.hasSoloSections, text: 'Solo Sections' } : null,
			{ value: notesData.hasLyrics, text: 'Lyrics' },
			showGuitarlikeProperties ? { value: notesData.hasForcedNotes, text: 'Forced Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasTapNotes, text: 'Tap Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasOpenNotes, text: 'Open Notes' } : null,
			showDrumlikeProperties ? { value: notesData.has2xKick, text: '2x Kick' } : null,
			showDrumlikeProperties ? { value: notesData.hasFlexLanes, text: 'Roll Lanes' } : null,
			{ value: this.selectedChart!.hasVideoBackground, text: 'Video Background' },
		])
	}

	/**
	 * Displays the information for the selected song.
	 */
	async onRowClicked(song: ChartData[]) {
		this.charts = _.chain(song)
			.groupBy(c => c.versionGroupId)
			.values()
			.map(versionGroup => _.sortBy(versionGroup, vg => vg.modifiedTime).reverse())
			.value()
		if (this.selectedChart?.albumArtMd5 !== this.charts[0][0].albumArtMd5) {
			this.albumLoading = true
		}
		if ((this.selectedChart?.icon || this.selectedChart?.charter) !== (this.charts[0][0].icon || this.charts[0][0].charter)) {
			this.iconLoading = true
		}
		this.selectedChart = this.charts[0][0]
		this.instrumentDropdown.setValue(this.defaultInstrument)
		this.difficultyDropdown.setValue(this.defaultDifficulty)
	}

	onSourceLinkClicked() {
		window.electron.emit.openUrl(driveLink(this.selectedChart!.applicationDriveId))
	}

	public get defaultInstrument() {
		return this.instruments.some(i => i === this.searchService.instrument.value)
			? this.searchService.instrument.value!
			: this.instruments[0]
	}
	public get instruments(): Instrument[] {
		if (!this.selectedChart) { return [] }
		return _.chain(this.selectedChart.notesData.noteCounts)
			.filter(nc => nc.count > 0)
			.map(nc => nc.instrument)
			.uniq()
			.sortBy(i => instruments.indexOf(i))
			.value()
	}
	public get defaultDifficulty() {
		return this.difficulties.some(d => d === this.searchService.difficulty.value)
			? this.searchService.difficulty.value!
			: this.difficulties[0]
	}
	public get difficulties(): Difficulty[] {
		if (!this.selectedChart) { return [] }
		return _.chain(this.selectedChart.notesData.noteCounts)
			.filter(nc => nc.instrument === this.instrumentDropdown.value && nc.count > 0)
			.map(nc => nc.difficulty)
			.sortBy(d => difficulties.indexOf(d))
			.value()
	}

	public get averageNps() {
		if (this.noteCount < 2) {
			return 0
		} else {
			return _.round(this.noteCount / (this.selectedChart!.notesData.effectiveLength / 1000), 1)
		}
	}

	private currentTrackFilter = (track: { instrument: Instrument | null; difficulty: Difficulty | null }) => {
		return track.instrument === this.instrumentDropdown.value && track.difficulty === this.difficultyDropdown.value
	}
	public get maximumNps() {
		return this.selectedChart!.notesData.maxNps.filter(this.currentTrackFilter)[0].nps
	}

	public get noteCount() {
		return this.selectedChart!.notesData.noteCounts.filter(this.currentTrackFilter)[0].count
	}

	/**
	 * Adds the selected chart to the download queue.
	 */
	onDownloadClicked() {
		if (this.settingsService.libraryDirectory) {
			this.downloadService.addDownload(this.selectedChart!)
		} else {
			this.libraryDirectoryErrorModal.nativeElement.showModal()
		}
	}

	public showMenu() {
		this.menuVisible = true
		this.unlisten = this.renderer.listen('window', 'click', (e: Event) => {
			if (this.menuVisible && !(this.menu.nativeElement as HTMLElement).contains(e.target as HTMLElement)) {
				this.menuVisible = false
				if (this.unlisten) {
					this.unlisten()
					this.unlisten = undefined
				}
			}
		})
	}
}
