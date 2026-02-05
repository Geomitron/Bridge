import { Injectable, signal, computed, effect, inject } from '@angular/core'

import { SearchService } from './search.service'

@Injectable({
	providedIn: 'root',
})
export class SelectionService {

	private searchService = inject(SearchService)

	readonly allSelected = signal(false)
	readonly selections = signal<{ [groupId: number]: boolean | undefined }>({})

	// Signal to notify when select all changes
	readonly selectAllChanged = signal<boolean | null>(null)

	constructor() {
		// Reset selections when a new search happens
		effect(() => {
			const event = this.searchService.searchEvent()
			if (event?.type === 'new') {
				this.selections.set({})
				this.deselectAll()
			}
		}, { allowSignalWrites: true })
	}

	isAllSelected() {
		return this.allSelected()
	}

	deselectAll() {
		this.allSelected.set(false)
		this.selections.update(selections => {
			const updated = { ...selections }
			for (const groupId in updated) {
				updated[groupId] = false
			}
			return updated
		})
		this.selectAllChanged.set(false)
	}

	selectAll() {
		this.allSelected.set(true)
		this.selections.update(selections => {
			const updated = { ...selections }
			for (const groupId in updated) {
				updated[groupId] = true
			}
			return updated
		})
		this.selectAllChanged.set(true)
	}

	setSelection(groupId: number, selected: boolean) {
		this.selections.update(selections => ({
			...selections,
			[groupId]: selected,
		}))
	}

	getSelection(groupId: number): boolean {
		return this.selections()[groupId] ?? false
	}
}
