import { Component, ElementRef, HostBinding, OnInit, Renderer2, ViewChild } from '@angular/core'
import { FormControl } from '@angular/forms'

import { capitalize, chain, compact, flatMap, intersection, round, sortBy } from 'lodash'
import { ChartIssueType, Difficulty, FolderIssueType, Instrument, MetadataIssueType, NoteIssueType, TrackIssueType } from 'scan-chart'
import { DownloadService } from 'src-angular/app/core/services/download.service'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { setlistNames } from 'src-shared/setlist-names'
import { difficulties, difficultyDisplay, driveLink, hasIssues, instruments, msToRoughTime, removeStyleTags, shortInstrumentDisplay } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar',
	templateUrl: './chart-sidebar.component.html',
})
export class ChartSidebarComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@ViewChild('menu') menu: ElementRef

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

	public instrumentDropdown: FormControl<Instrument | null>
	public difficultyDropdown: FormControl<Difficulty | null>

	constructor(
		private renderer: Renderer2,
		private searchService: SearchService,
		private downloadService: DownloadService,
		public settingsService: SettingsService
	) { }

	ngOnInit() {
		this.searchService.newSearch.subscribe(() => {
			this.charts = null
			this.selectedChart = null
		})
		this.instrumentDropdown = new FormControl<Instrument | null>(this.defaultInstrument)
		this.searchService.instrument.valueChanges.subscribe(instrument => {
			if (this.instruments.some(i => i === instrument)) {
				this.instrumentDropdown.setValue(instrument)
			}
		})
		this.instrumentDropdown.valueChanges.subscribe(() => {
			if (!this.difficulties.some(d => d === this.difficultyDropdown.value)) {
				this.difficultyDropdown.setValue(this.defaultDifficulty)
			}
		})
		this.difficultyDropdown = new FormControl<Difficulty | null>(this.defaultDifficulty)
		this.searchService.difficulty.valueChanges.subscribe(difficulty => {
			if (this.difficulties.some(d => d === difficulty)) {
				this.difficultyDropdown.setValue(difficulty)
			}
		})
	}

	public get albumArtMd5() {
		return flatMap(this.charts ?? []).find(c => !!c.albumArtMd5)?.albumArtMd5 || null
	}

	public get hasIcons() { return !!this.searchService.availableIcons }
	public get icon() {
		const iconName = this.selectedChart!.icon || removeStyleTags(this.selectedChart!.charter ?? 'N/A').toLowerCase() + '.'
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
		return round((this.selectedChart!.notesData.length - this.selectedChart!.notesData.effectiveLength) / 1000, 1)
	}

	public get hasIssues() {
		return hasIssues(this.selectedChart!)
	}

	public get metadataIssues() {
		return this.selectedChart!.metadataIssues
	}
	public getMetadataIssueText(issue: MetadataIssueType) {
		switch (issue) {
			case 'noName': return 'Chart has no name'
			case 'noArtist': return 'Chart has no artist'
			case 'noAlbum': return 'Chart has no album'
			case 'noGenre': return 'Chart has no genre'
			case 'noYear': return 'Chart has no year'
			case 'noCharter': return 'Chart has no charter'
			case 'missingInstrumentDiff': return 'Metadata is missing an instrument intensity rating'
			case 'extraInstrumentDiff': return 'Metadata contains an instrument intensity rating for an uncharted instrument'
			case 'nonzeroDelay': return 'Chart uses "delay" for the audio offset'
			case 'drumsSetTo4And5Lane': return 'It is unclear if the drums chart is intended to be 4-lane or 5-lane'
			case 'nonzeroOffset': return 'Chart uses "delay" for the audio offset'
		}
	}
	public get folderIssues() {
		return chain(this.selectedChart!.folderIssues)
			.filter(i => !['albumArtSize', 'invalidIni', 'multipleVideo', 'badIniLine'].includes(i.folderIssue))
			.map(i => i.folderIssue)
			.uniq()
			.value()
	}
	public getFolderIssueText(folderIssue: FolderIssueType) {
		switch (folderIssue) {
			case 'noMetadata': return `Metadata file is missing`
			case 'invalidMetadata': return `Metadata file is invalid`
			case 'multipleIniFiles': return `Multiple metadata files`
			case 'noAlbumArt': return `Album art is missing`
			case 'badAlbumArt': return `Album art is invalid`
			case 'multipleAlbumArt': return `Multiple album art files`
			case 'noAudio': return `Audio file is missing`
			case 'invalidAudio': return `Audio file is invalid`
			case 'badAudio': return `Audio file is invalid`
			case 'multipleAudio': return `Audio file is invalid`
			case 'noChart': return `Notes file is missing`
			case 'invalidChart': return `Notes file is invalid`
			case 'badChart': return `Notes file is invalid`
			case 'multipleChart': return `Multiple notes files`
			case 'badVideo': return `Video background won't work on Linux`
		}
	}

	public get chartIssues() {
		return this.selectedChart!.notesData?.chartIssues.filter(i => i !== 'isDefaultBPM')
	}
	public getChartIssueText(issue: ChartIssueType) {
		switch (issue) {
			case 'noResolution': return 'No resolution in chart file'
			case 'noSyncTrackSection': return 'No tempo map in chart file'
			case 'noNotes': return 'No notes in chart file'
			case 'noExpert': return 'Expert is not charted'
			case 'misalignedTimeSignatures': return 'Broken time signatures'
			case 'noSections': return 'No sections'
		}
	}

	public get trackIssuesGroups() {
		return chain([
			...this.selectedChart!.notesData.trackIssues.map(i => ({ ...i, issues: i.trackIssues })),
			...this.selectedChart!.notesData.noteIssues.map(i => ({ ...i, issues: i.noteIssues.map(ni => ni.issueType) })),
		])
			.sortBy(g => instruments.indexOf(g.instrument), g => difficulties.indexOf(g.difficulty))
			.groupBy(g => `${capitalize(g.instrument)} - ${capitalize(g.difficulty)} Issues Found:`)
			.toPairs()
			.map(([groupName, group]) => ({
				groupName,
				issues: chain(group)
					.flatMap(g => g.issues)
					.filter(i => i !== 'babySustain' && i !== 'noNotesOnNonemptyTrack')
					.uniq()
					.value(),
			}))
			.value()
	}

	public getTrackIssueText(issue: NoteIssueType | TrackIssueType) {
		switch (issue) {
			case 'babySustain': return 'Has baby sustains'
			case 'badSustainGap': return 'Has sustain gaps that are too small'
			case 'brokenNote': return 'Has broken notes'
			case 'difficultyForbiddenNote': return 'Has notes not allowed on this difficulty'
			case 'fiveNoteChord': return 'Has five-note chords'
			case 'noDrumActivationLanes': return 'Has no activation lanes'
			case 'has4And5LaneFeatures': return 'Has a mix of 4 and 5 lane features on the drum chart'
			case 'noStarPower': return 'Has no star power'
			case 'smallLeadingSilence': return 'Leading silence is too small'
			case 'threeNoteDrumChord': return 'Has three-note drum chords'
		}
	}

	public get boolProperties(): ({ value: boolean; text: string })[] {
		const notesData = this.selectedChart!.notesData
		const showGuitarlikeProperties = intersection(this.instruments, this.guitarlikeInstruments).length > 0
		const showDrumlikeProperties = intersection(this.instruments, ['drums']).length > 0
		return compact([
			showGuitarlikeProperties ? { value: notesData.hasSoloSections, text: 'Solo Sections' } : null,
			{ value: notesData.hasLyrics, text: 'Lyrics' },
			showGuitarlikeProperties ? { value: notesData.hasForcedNotes, text: 'Forced Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasTapNotes, text: 'Tap Notes' } : null,
			showGuitarlikeProperties ? { value: notesData.hasOpenNotes, text: 'Open Notes' } : null,
			showDrumlikeProperties ? { value: notesData.has2xKick, text: '2x Kick' } : null,
			showDrumlikeProperties ? { value: notesData.hasRollLanes, text: 'Roll Lanes' } : null,
			{ value: this.selectedChart!.hasVideoBackground, text: 'Video Background' },
		])
	}

	/**
	 * Displays the information for the selected song.
	 */
	async onRowClicked(song: ChartData[]) {
		this.charts = chain(song)
			.groupBy(c => c.versionGroupId)
			.values()
			.map(versionGroup => sortBy(versionGroup, vg => vg.modifiedTime).reverse())
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
		return chain(this.selectedChart.notesData.noteCounts)
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
		return chain(this.selectedChart.notesData.noteCounts)
			.filter(nc => nc.instrument === this.instrumentDropdown.value && nc.count > 0)
			.map(nc => nc.difficulty)
			.sortBy(d => difficulties.indexOf(d))
			.value()
	}

	public get averageNps() {
		if (this.noteCount < 2) {
			return 0
		} else {
			return round(this.noteCount / (this.selectedChart!.notesData.effectiveLength / 1000), 1)
		}
	}

	private currentTrackFilter = (track: { instrument: Instrument; difficulty: Difficulty }) => {
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
		this.downloadService.addDownload(this.selectedChart!)
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
