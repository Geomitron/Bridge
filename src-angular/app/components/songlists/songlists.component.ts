import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormControl, Validators } from '@angular/forms'
import { Router } from '@angular/router'

import { SongList } from '../../../../src-shared/interfaces/songlist.interface.js'
import { SongListService } from '../../core/services/songlist.service'

@Component({
	selector: 'app-songlists',
	templateUrl: './songlists.component.html',
	standalone: false,
})
export class SongListsComponent implements OnInit, OnDestroy {
	@ViewChild('createListModal') createListModal: ElementRef<HTMLDialogElement>
	@ViewChild('importPreviewModal') importPreviewModal: ElementRef<HTMLDialogElement>
	@ViewChild('deleteConfirmModal') deleteConfirmModal: ElementRef<HTMLDialogElement>

	lists: SongList[] = []
	newListName = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
	newListDescription = new FormControl<string>('', { nonNullable: true })

	importedList: SongList | null = null
	listToDelete: SongList | null = null

	private listsChangedSub: any

	constructor(
		public songListService: SongListService,
		private ref: ChangeDetectorRef,
		private router: Router,
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

	openCreateModal() {
		this.newListName.reset()
		this.newListDescription.reset()
		this.createListModal.nativeElement.showModal()
	}

	async createList() {
		if (this.newListName.valid) {
			await this.songListService.createList(
				this.newListName.value.trim(),
				this.newListDescription.value.trim()
			)
			this.createListModal.nativeElement.close()
		}
	}

	viewList(list: SongList) {
		this.router.navigate(['/lists', list.id])
	}

	async exportList(list: SongList, event: Event) {
		event.stopPropagation()
		const success = await this.songListService.exportList(list.id)
		if (success) {
			// Could show success toast
		}
	}

	confirmDelete(list: SongList, event: Event) {
		event.stopPropagation()
		this.listToDelete = list
		this.deleteConfirmModal.nativeElement.showModal()
	}

	deleteList() {
		if (this.listToDelete) {
			this.songListService.deleteList(this.listToDelete.id)
			this.listToDelete = null
			this.deleteConfirmModal.nativeElement.close()
		}
	}

	async importList() {
		const list = await this.songListService.importList()
		if (list) {
			this.importedList = list
			this.importPreviewModal.nativeElement.showModal()
		}
	}

	saveImportedList() {
		if (this.importedList) {
			this.songListService.saveImportedList(this.importedList)
			this.importedList = null
			this.importPreviewModal.nativeElement.close()
		}
	}

	formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString()
	}
}
