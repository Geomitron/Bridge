import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormControl, Validators } from '@angular/forms'

import { SongList } from '../../../../../src-shared/interfaces/songlist.interface.js'
import { ChartData } from '../../../../../src-shared/interfaces/search.interface.js'
import { SongListService } from '../../../core/services/songlist.service'

@Component({
	selector: 'app-add-to-list-modal',
	templateUrl: './add-to-list-modal.component.html',
	standalone: false,
})
export class AddToListModalComponent implements OnInit, OnDestroy {
	@ViewChild('addToListModal') modal: ElementRef<HTMLDialogElement>
	@ViewChild('createNewListModal') createNewListModal: ElementRef<HTMLDialogElement>

	lists: SongList[] = []
	charts: ChartData[] = []
	selectedListIds = new Set<string>()

	newListName = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
	newListDescription = new FormControl<string>('', { nonNullable: true })

	private listsChangedSub: any

	constructor(
		private songListService: SongListService,
		private ref: ChangeDetectorRef,
	) { }

	ngOnInit() {
		this.lists = this.songListService.getLists()
		this.listsChangedSub = this.songListService.listsChanged.subscribe(lists => {
			this.lists = lists
			this.ref.detectChanges()
		})
	}

	ngOnDestroy() {
		if (this.listsChangedSub) {
			this.listsChangedSub.unsubscribe()
		}
	}

	/**
	 * Opens the modal to add charts to lists.
	 * @param charts The charts to add
	 */
	open(charts: ChartData[]) {
		this.charts = charts
		this.selectedListIds.clear()

		// Pre-select lists that already contain all the charts
		for (const list of this.lists) {
			const allChartsInList = charts.every(chart =>
				list.entries.some(e => e.md5 === chart.md5)
			)
			if (allChartsInList) {
				this.selectedListIds.add(list.id)
			}
		}

		this.modal.nativeElement.showModal()
	}

	toggleList(listId: string) {
		if (this.selectedListIds.has(listId)) {
			this.selectedListIds.delete(listId)
		} else {
			this.selectedListIds.add(listId)
		}
	}

	isSelected(listId: string): boolean {
		return this.selectedListIds.has(listId)
	}

	isPartiallyInList(list: SongList): boolean {
		const inListCount = this.charts.filter(chart =>
			list.entries.some(e => e.md5 === chart.md5)
		).length
		return inListCount > 0 && inListCount < this.charts.length
	}

	openCreateNewList() {
		this.newListName.reset()
		this.newListDescription.reset()
		this.createNewListModal.nativeElement.showModal()
	}

	async createNewList() {
		if (this.newListName.valid) {
			const newList = await this.songListService.createList(
				this.newListName.value.trim(),
				this.newListDescription.value.trim()
			)
			this.createNewListModal.nativeElement.close()

			// Auto-select the newly created list
			this.selectedListIds.add(newList.id)
			this.ref.detectChanges()
		}
	}

	save() {
		// Add charts to newly selected lists
		for (const listId of this.selectedListIds) {
			const list = this.lists.find(l => l.id === listId)
			if (list) {
				// Filter out charts already in this list
				const chartsToAdd = this.charts.filter(chart =>
					!list.entries.some(e => e.md5 === chart.md5)
				)
				if (chartsToAdd.length > 0) {
					this.songListService.addCharts(listId, chartsToAdd)
				}
			}
		}

		// Remove charts from deselected lists
		for (const list of this.lists) {
			if (!this.selectedListIds.has(list.id)) {
				const chartsToRemove = this.charts.filter(chart =>
					list.entries.some(e => e.md5 === chart.md5)
				)
				if (chartsToRemove.length > 0) {
					this.songListService.removeCharts(list.id, chartsToRemove.map(c => c.md5))
				}
			}
		}

		this.modal.nativeElement.close()
	}

	get chartDescription(): string {
		if (this.charts.length === 1) {
			return `"${this.charts[0].name}" by ${this.charts[0].artist}`
		}
		return `${this.charts.length} songs`
	}
}
