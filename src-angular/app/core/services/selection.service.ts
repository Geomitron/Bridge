import { EventEmitter, Injectable } from '@angular/core'

import { SearchService } from './search.service'

// Note: this class prevents event cycles by only emitting events if the checkbox changes

@Injectable({
	providedIn: 'root',
})
export class SelectionService {

	private selectAllChangedEmitter = new EventEmitter<boolean>()

	public selections: { [groupId: number]: boolean | undefined } = {}

	constructor(searchService: SearchService) {
		searchService.searchUpdated.subscribe(() => {
			this.selections = {}
		})
	}

	getSelectedResults() {
		// TODO
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return [] as any[] // this.searchResults.filter(result => this.selections[result.id] === true)
	}

	onSelectAllChanged(callback: (selected: boolean) => void) {
		this.selectAllChangedEmitter.subscribe(callback)
	}

	deselectAll() {
		for (const groupId in this.selections) {
			this.selections[groupId] = false
		}
		this.selectAllChangedEmitter.emit(false)
	}

	selectAll() {
		for (const groupId in this.selections) {
			this.selections[groupId] = true
		}
		this.selectAllChangedEmitter.emit(true)
	}
}
