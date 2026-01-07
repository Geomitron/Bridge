import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormControl, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'

import { SongList, SongListEntry } from '../../../../../src-shared/interfaces/songlist.interface.js'
import { DownloadService } from '../../../core/services/download.service'
import { SongListService } from '../../../core/services/songlist.service'

@Component({
	selector: 'app-songlist-detail',
	templateUrl: './songlist-detail.component.html',
	standalone: false,
})
export class SongListDetailComponent implements OnInit, OnDestroy {
	@ViewChild('editListModal') editListModal: ElementRef<HTMLDialogElement>
	@ViewChild('removeConfirmModal') removeConfirmModal: ElementRef<HTMLDialogElement>

	list: SongList | null = null
	selectedEntries = new Set<string>()

	editName = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
	editDescription = new FormControl<string>('', { nonNullable: true })

	entryToRemove: SongListEntry | null = null

	private listsChangedSub: any

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private songListService: SongListService,
		private downloadService: DownloadService,
		private ref: ChangeDetectorRef,
	) { }

	ngOnInit() {
		const listId = this.route.snapshot.paramMap.get('id')
		if (listId) {
			this.list = this.songListService.getList(listId) || null
		}

		this.listsChangedSub = this.songListService.listsChanged.subscribe(() => {
			if (this.list) {
				this.list = this.songListService.getList(this.list.id) || null
				this.ref.detectChanges()
			}
		})
	}

	ngOnDestroy() {
		if (this.listsChangedSub) {
			this.listsChangedSub.unsubscribe()
		}
	}

	goBack() {
		this.router.navigate(['/lists'])
	}

	openEditModal() {
		if (this.list) {
			this.editName.setValue(this.list.name)
			this.editDescription.setValue(this.list.description)
			this.editListModal.nativeElement.showModal()
		}
	}

	saveEdit() {
		if (this.list && this.editName.valid) {
			const updatedList: SongList = {
				...this.list,
				name: this.editName.value.trim(),
				description: this.editDescription.value.trim(),
			}
			this.songListService.updateList(updatedList)
			this.editListModal.nativeElement.close()
		}
	}

	toggleSelection(md5: string) {
		if (this.selectedEntries.has(md5)) {
			this.selectedEntries.delete(md5)
		} else {
			this.selectedEntries.add(md5)
		}
	}

	toggleSelectAll() {
		if (!this.list) return

		if (this.selectedEntries.size === this.list.entries.length) {
			this.selectedEntries.clear()
		} else {
			this.selectedEntries = new Set(this.list.entries.map(e => e.md5))
		}
	}

	isSelected(md5: string): boolean {
		return this.selectedEntries.has(md5)
	}

	get allSelected(): boolean {
		return this.list ? this.selectedEntries.size === this.list.entries.length && this.list.entries.length > 0 : false
	}

	get someSelected(): boolean {
		return this.selectedEntries.size > 0 && !this.allSelected
	}

	downloadEntry(entry: SongListEntry) {
		this.downloadService.addDownload({
			md5: entry.md5,
			chartId: entry.chartId,
			hasVideoBackground: true, // Default to true since we don't cache this
			name: entry.cache.name || 'Unknown',
			artist: entry.cache.artist || 'Unknown',
			album: entry.cache.album || 'Unknown',
			genre: 'Unknown',
			year: 'Unknown',
			charter: entry.cache.charter || 'Unknown',
		} as any)
	}

	downloadSelected() {
		if (!this.list) return

		for (const entry of this.list.entries) {
			if (this.selectedEntries.has(entry.md5)) {
				this.downloadEntry(entry)
			}
		}
		this.selectedEntries.clear()
	}

	downloadAll() {
		if (!this.list) return

		for (const entry of this.list.entries) {
			this.downloadEntry(entry)
		}
	}

	confirmRemove(entry: SongListEntry, event: Event) {
		event.stopPropagation()
		this.entryToRemove = entry
		this.removeConfirmModal.nativeElement.showModal()
	}

	removeEntry() {
		if (this.list && this.entryToRemove) {
			this.songListService.removeCharts(this.list.id, [this.entryToRemove.md5])
			this.selectedEntries.delete(this.entryToRemove.md5)
			this.entryToRemove = null
			this.removeConfirmModal.nativeElement.close()
		}
	}

	removeSelected() {
		if (this.list && this.selectedEntries.size > 0) {
			this.songListService.removeCharts(this.list.id, Array.from(this.selectedEntries))
			this.selectedEntries.clear()
		}
	}

	async exportList() {
		if (this.list) {
			await this.songListService.exportList(this.list.id)
		}
	}

	formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString()
	}
}
