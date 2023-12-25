import { EventEmitter, Injectable } from '@angular/core'

import { SearchService } from './search.service'

@Injectable({
	providedIn: 'root',
})
export class SelectionService {

	private allSelected = false
	private selectAllChangedEmitter = new EventEmitter<boolean>()

	public selections: { [groupId: number]: boolean | undefined } = {}

	constructor(searchService: SearchService) {
		searchService.newSearch.subscribe(() => {
			this.selections = {}
			this.deselectAll()
		})
	}

	isAllSelected() {
		return this.allSelected
	}

	deselectAll() {
		this.allSelected = false
		for (const groupId in this.selections) {
			this.selections[groupId] = false
		}
		this.selectAllChangedEmitter.emit(false)
	}

	selectAll() {
		this.allSelected = true
		for (const groupId in this.selections) {
			this.selections[groupId] = true
		}
		this.selectAllChangedEmitter.emit(true)
	}
}
