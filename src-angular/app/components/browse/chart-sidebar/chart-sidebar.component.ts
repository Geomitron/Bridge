import { Component, ElementRef, HostBinding, OnInit, Renderer2, ViewChild } from '@angular/core'
import { FormControl } from '@angular/forms'

import { chain, compact, flatMap, intersection, round, sortBy } from 'lodash'
import { Difficulty, Instrument } from 'scan-chart'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { SettingsService } from 'src-angular/app/core/services/settings.service'
import { ChartData } from 'src-shared/interfaces/search.interface'
import { setlistNames } from 'src-shared/setlist-names'
import { difficulties, difficultyDisplay, driveLink, instruments, msToRoughTime, removeStyleTags, shortInstrumentDisplay } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-chart-sidebar',
	templateUrl: './chart-sidebar.component.html',
})
export class ChartSidebarComponent implements OnInit {
	@HostBinding('class.contents') contents = true

	@ViewChild('menu') menu: ElementRef
	@ViewChild('selectSngModal') selectSngModal: ElementRef<HTMLDialogElement>

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
		public settingsService: SettingsService
	) { }

	ngOnInit() {
		this.searchService.searchUpdated.subscribe(() => {
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

	/**
	 * Opens the proxy link or source folder in the default browser.
	 */
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

	public get hasSelectedDownloadFormat() {
		// TODO
		return localStorage.getItem('selectedDownloadFormat') === 'true'
	}
	public selectDownloadFormat(isSng: boolean) {
		// TODO
		this.searchService.isSng.setValue(isSng)
		localStorage.setItem('selectedDownloadFormat', 'true')
	}

	/**
	 * Adds the selected version to the download queue.
	 */
	onDownloadClicked() {
		// TODO
		if (!this.hasSelectedDownloadFormat) {
			this.selectSngModal.nativeElement.showModal()
			return
		} else {
			this.selectSngModal.nativeElement.close()
		}
		// this.downloadService.addDownload(
		// 	this.selectedChart.versionID, {
		// 	chartName: this.selectedChart.chartName,
		// 	artist: this.songResult!.artist,
		// 	charter: this.selectedChart.charters,
		// 	driveData: this.selectedChart.driveData,
		// })
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
