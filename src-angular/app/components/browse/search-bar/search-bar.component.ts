import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal, computed, effect } from '@angular/core'
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms'
import { NgClass } from '@angular/common'

import dayjs from 'dayjs'
import { distinctUntilChanged, switchMap, throttleTime } from 'rxjs'
import { Difficulty, Instrument } from 'scan-chart'
import { SearchService } from 'src-angular/app/core/services/search.service'
import { difficulties, difficultyDisplay, drumsReviewedDisplay, drumTypeDisplay, DrumTypeName, drumTypeNames, instrumentDisplay, instruments } from 'src-shared/UtilFunctions'

@Component({
	selector: 'app-search-bar',
	standalone: true,
	imports: [ReactiveFormsModule, FormsModule, NgClass],
	templateUrl: './search-bar.component.html',
	host: { class: 'block relative z-20' },
})
export class SearchBarComponent implements OnInit, AfterViewInit {
	private searchService = inject(SearchService)
	private fb = inject(FormBuilder)

	@ViewChild('searchInput') searchInput: ElementRef<HTMLInputElement>

	@ViewChild('hasSoloSections') hasSoloSections: ElementRef<HTMLInputElement>
	@ViewChild('hasForcedNotes') hasForcedNotes: ElementRef<HTMLInputElement>
	@ViewChild('hasOpenNotes') hasOpenNotes: ElementRef<HTMLInputElement>
	@ViewChild('hasTapNotes') hasTapNotes: ElementRef<HTMLInputElement>
	@ViewChild('hasRollLanes') hasRollLanes: ElementRef<HTMLInputElement>
	@ViewChild('has2xKick') has2xKick: ElementRef<HTMLInputElement>

	showAdvanced = signal(false)
	instruments = instruments
	difficulties = difficulties
	drumTypes = drumTypeNames
	instrumentDisplay = instrumentDisplay
	difficultyDisplay = difficultyDisplay
	drumTypeDisplay = drumTypeDisplay
	drumsReviewedDisplay = drumsReviewedDisplay

	advancedSearchForm: ReturnType<this['getAdvancedSearchForm']>
	startValidation = signal(false)

	// Reactive getters
	searchLoading = computed(() => this.searchService.searchLoading())
	instrument = computed(() => this.searchService.instrument())
	difficulty = computed(() => this.searchService.difficulty())
	drumType = computed(() => this.searchService.drumType())
	drumsReviewed = computed(() => this.searchService.drumsReviewed())

	// Search control with signal
	searchValue = signal('')

	ngOnInit() {
		this.initializeAdvancedSearchForm()

		// Watch search value changes
		effect(() => {
			const value = this.searchValue()
			// This will be handled by template binding
		})
	}

	ngAfterViewInit() {
		this.searchInput.nativeElement.focus()
		this.updateDisabledControls()

		// Watch for instrument changes to update disabled controls
		effect(() => {
			const _ = this.instrument() // Track the signal
			this.updateDisabledControls()
		})
	}

	onSearchInput(value: string) {
		this.searchValue.set(value)
		// Debounce and search
		this.searchService.searchValue.set(value)
		this.searchService.search(value || '*').subscribe()
	}

	setShowAdvanced(showAdvanced: boolean) {
		this.showAdvanced.set(showAdvanced)
		if (showAdvanced) {
			this.startValidation.set(false)
		}
	}

	setInstrument(instrument: Instrument | null, event: MouseEvent) {
		this.searchService.setInstrument(instrument)
		if (event.target instanceof HTMLElement) {
			event.target.parentElement?.parentElement?.blur()
		}
	}

	setDifficulty(difficulty: Difficulty | null, event: MouseEvent) {
		this.searchService.setDifficulty(difficulty)
		if (event.target instanceof HTMLElement) {
			event.target.parentElement?.parentElement?.blur()
		}
	}

	setDrumType(drumType: DrumTypeName | null, event: MouseEvent) {
		this.searchService.setDrumType(drumType)
		if (event.target instanceof HTMLElement) {
			event.target.parentElement?.parentElement?.blur()
		}
	}

	setDrumsReviewed(drumsReviewed: boolean, event: MouseEvent) {
		this.searchService.setDrumsReviewed(drumsReviewed)
		if (event.target instanceof HTMLElement) {
			event.target.parentElement?.parentElement?.blur()
		}
	}

	get todayDate() {
		return dayjs().format('YYYY-MM-DD')
	}

	initializeAdvancedSearchForm() {
		this.advancedSearchForm = this.getAdvancedSearchForm() as ReturnType<this['getAdvancedSearchForm']>

		for (const key of ['name', 'artist', 'album', 'genre', 'year', 'charter'] as const) {
			this.advancedSearchForm.get(key)?.get('exact')?.disable()
			this.advancedSearchForm.get(key)?.get('exclude')?.disable()
			this.advancedSearchForm.get(key)?.get('value')?.valueChanges.subscribe(value => {
				if (value) {
					this.advancedSearchForm.get(key)?.get('exact')?.enable()
					this.advancedSearchForm.get(key)?.get('exclude')?.enable()
				} else {
					this.advancedSearchForm.get(key)?.get('exact')?.disable()
					this.advancedSearchForm.get(key)?.get('exact')?.setValue(false)
					this.advancedSearchForm.get(key)?.get('exclude')?.disable()
					this.advancedSearchForm.get(key)?.get('exclude')?.setValue(false)
				}
			})
		}
	}

	updateDisabledControls() {
		if (!this.hasForcedNotes?.nativeElement) return

		const isDrums = this.searchService.instrument() === 'drums'
		const isAny = this.searchService.instrument() === null
		const explanation = 'Not available for the current instrument.'

		this.hasForcedNotes.nativeElement.disabled = isDrums && !isAny
		this.hasOpenNotes.nativeElement.disabled = isDrums && !isAny
		this.hasTapNotes.nativeElement.disabled = isDrums && !isAny
		this.hasRollLanes.nativeElement.disabled = !isDrums && !isAny
		this.has2xKick.nativeElement.disabled = !isDrums && !isAny

		this.hasForcedNotes.nativeElement.title = isDrums && !isAny ? explanation : ''
		this.hasOpenNotes.nativeElement.title = isDrums && !isAny ? explanation : ''
		this.hasTapNotes.nativeElement.title = isDrums && !isAny ? explanation : ''
		this.hasRollLanes.nativeElement.title = !isDrums && !isAny ? explanation : ''
		this.has2xKick.nativeElement.title = !isDrums && !isAny ? explanation : ''

		if (!isAny) {
			if (isDrums) {
				this.advancedSearchForm.get('hasForcedNotes')?.setValue(null)
				this.advancedSearchForm.get('hasOpenNotes')?.setValue(null)
				this.advancedSearchForm.get('hasTapNotes')?.setValue(null)
				this.hasForcedNotes.nativeElement.indeterminate = true
				this.hasOpenNotes.nativeElement.indeterminate = true
				this.hasTapNotes.nativeElement.indeterminate = true
			} else {
				this.advancedSearchForm.get('hasRollLanes')?.setValue(null)
				this.advancedSearchForm.get('has2xKick')?.setValue(null)
				this.hasRollLanes.nativeElement.indeterminate = true
				this.has2xKick.nativeElement.indeterminate = true
			}
		}
	}

	getAdvancedSearchForm() {
		return this.fb.group({
			name: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			artist: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			album: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			genre: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			year: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			charter: this.fb.nonNullable.group({ value: '', exact: false, exclude: false }),
			minLength: null as number | null,
			maxLength: null as number | null,
			minIntensity: null as number | null,
			maxIntensity: null as number | null,
			minAverageNPS: null as number | null,
			maxAverageNPS: null as number | null,
			minMaxNPS: null as number | null,
			maxMaxNPS: null as number | null,
			minYear: null as number | null,
			maxYear: null as number | null,
			modifiedAfter: this.fb.nonNullable.control('', { validators: dateValidator }),
			hash: this.fb.nonNullable.control(''),
			trackHash: this.fb.nonNullable.control(''),
			hasSoloSections: null as boolean | null,
			hasForcedNotes: null as boolean | null,
			hasOpenNotes: null as boolean | null,
			hasTapNotes: null as boolean | null,
			hasLyrics: null as boolean | null,
			hasVocals: null as boolean | null,
			hasRollLanes: null as boolean | null,
			has2xKick: null as boolean | null,
			hasIssues: null as boolean | null,
			hasVideoBackground: null as boolean | null,
			modchart: null as boolean | null,
		})
	}

	clickCheckbox(key: string, event: MouseEvent) {
		if (event.target instanceof HTMLInputElement) {
			const control = this.advancedSearchForm.get(key) as FormControl<boolean | null>
			if (control.value === true) {
				control.setValue(false)
				event.target.checked = false
			} else if (control.value === false) {
				control.setValue(null)
				event.target.checked = false
				event.target.indeterminate = true
			} else if (control.value === null) {
				control.setValue(true)
				event.target.checked = true
				event.target.indeterminate = false
			}
		}
	}

	formValue(key: string) {
		return this.advancedSearchForm.get(key)?.value
	}

	searchAdvanced() {
		this.startValidation.set(true)
		if (this.advancedSearchForm.valid && !this.searchService.searchLoading()) {
			this.searchService.advancedSearch({
				instrument: this.instrument(),
				difficulty: this.difficulty(),
				drumType: this.drumType(),
				drumsReviewed: this.drumsReviewed(),
				sort: this.searchService.sortColumn() !== null ? { type: this.searchService.sortColumn()!, direction: this.searchService.sortDirection() } : null,
				source: 'bridge' as const,
				...this.advancedSearchForm.getRawValue(),
			}).subscribe()
		}
	}
}

function dateValidator(control: AbstractControl) {
	if (control.value && isNaN(Date.parse(control.value))) {
		return { 'dateValidator': true }
	}
	return null
}
