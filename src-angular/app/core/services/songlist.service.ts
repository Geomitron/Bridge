import { EventEmitter, Injectable } from '@angular/core'

import { SongList, SongListEntry, SongListStorage } from '../../../../src-shared/interfaces/songlist.interface.js'
import { ChartData } from '../../../../src-shared/interfaces/search.interface.js'

@Injectable({
	providedIn: 'root',
})
export class SongListService {

	private storage: SongListStorage = { version: 1, lists: [] }

	/** Emits when the lists have been modified */
	listsChanged = new EventEmitter<SongList[]>()

	constructor() { }

	/**
	 * Loads song lists from storage. Should be called at app startup.
	 */
	async loadLists() {
		this.storage = await window.electron.invoke.getSongLists()
	}

	/**
	 * @returns all song lists
	 */
	getLists(): SongList[] {
		return this.storage.lists
	}

	/**
	 * @returns a specific song list by ID, or undefined if not found
	 */
	getList(id: string): SongList | undefined {
		return this.storage.lists.find(l => l.id === id)
	}

	/**
	 * Creates a new song list with the given name and description.
	 * @returns the created SongList
	 */
	async createList(name: string, description: string = ''): Promise<SongList> {
		const newList = await window.electron.invoke.createSongList({ name, description })
		this.storage.lists.push(newList)
		this.listsChanged.emit(this.storage.lists)
		return newList
	}

	/**
	 * Updates an existing song list.
	 */
	updateList(list: SongList) {
		window.electron.emit.updateSongList(list)
		const index = this.storage.lists.findIndex(l => l.id === list.id)
		if (index !== -1) {
			list.modifiedAt = new Date().toISOString()
			this.storage.lists[index] = list
			this.listsChanged.emit(this.storage.lists)
		}
	}

	/**
	 * Deletes a song list by ID.
	 */
	deleteList(id: string) {
		window.electron.emit.deleteSongList(id)
		this.storage.lists = this.storage.lists.filter(l => l.id !== id)
		this.listsChanged.emit(this.storage.lists)
	}

	/**
	 * Converts ChartData to SongListEntry for storage.
	 */
	private chartToEntry(chart: ChartData): SongListEntry {
		return {
			md5: chart.md5,
			chartId: chart.chartId,
			cache: {
				name: chart.chartName || chart.name,
				artist: chart.artist,
				album: chart.chartAlbum || chart.album,
				charter: chart.charter,
			},
			addedAt: new Date().toISOString(),
		}
	}

	/**
	 * Adds charts to a song list.
	 */
	addCharts(listId: string, charts: ChartData[]) {
		const entries = charts.map(chart => this.chartToEntry(chart))
		window.electron.emit.addToSongList({ listId, entries })

		// Optimistically update local state
		const list = this.storage.lists.find(l => l.id === listId)
		if (list) {
			const existingMd5s = new Set(list.entries.map(e => e.md5))
			const newEntries = entries.filter(e => !existingMd5s.has(e.md5))
			list.entries.push(...newEntries)
			list.modifiedAt = new Date().toISOString()
			this.listsChanged.emit(this.storage.lists)
		}
	}

	/**
	 * Removes charts from a song list by their md5 hashes.
	 */
	removeCharts(listId: string, md5s: string[]) {
		window.electron.emit.removeFromSongList({ listId, md5s })

		// Optimistically update local state
		const list = this.storage.lists.find(l => l.id === listId)
		if (list) {
			const md5Set = new Set(md5s)
			list.entries = list.entries.filter(e => !md5Set.has(e.md5))
			list.modifiedAt = new Date().toISOString()
			this.listsChanged.emit(this.storage.lists)
		}
	}

	/**
	 * Exports a song list to a .bridgelist file.
	 * Opens a save dialog and exports to the selected path.
	 * @returns true if export was successful, false otherwise
	 */
	async exportList(listId: string): Promise<boolean> {
		const list = this.getList(listId)
		if (!list) { return false }

		const result = await window.electron.invoke.showSaveDialog({
			title: 'Export Song List',
			defaultPath: `${list.name}.bridgelist`,
			filters: [
				{ name: 'Bridge Song List', extensions: ['bridgelist'] },
			],
		})

		if (result.canceled || !result.filePath) { return false }

		const exportResult = await window.electron.invoke.exportSongList({
			listId,
			filePath: result.filePath,
		})

		return exportResult.success
	}

	/**
	 * Imports a .bridgelist file.
	 * Opens a file dialog and imports the selected file.
	 * @returns the imported SongList if successful, null otherwise
	 */
	async importList(): Promise<SongList | null> {
		const result = await window.electron.invoke.showOpenDialog({
			title: 'Import Song List',
			filters: [
				{ name: 'Bridge Song List', extensions: ['bridgelist'] },
			],
			properties: ['openFile'],
		})

		if (result.canceled || !result.filePaths.length) { return null }

		const importResult = await window.electron.invoke.importSongList(result.filePaths[0])

		if (!importResult.success || !importResult.list) {
			// Could show error toast here
			console.error('Import failed:', importResult.error)
			return null
		}

		return importResult.list
	}

	/**
	 * Saves an imported song list to storage.
	 */
	saveImportedList(list: SongList) {
		window.electron.emit.saveImportedSongList(list)
		this.storage.lists.push(list)
		this.listsChanged.emit(this.storage.lists)
	}

	/**
	 * Checks if a chart is in a specific list.
	 */
	isChartInList(listId: string, md5: string): boolean {
		const list = this.getList(listId)
		return list ? list.entries.some(e => e.md5 === md5) : false
	}

	/**
	 * Gets all lists that contain a specific chart.
	 */
	getListsContainingChart(md5: string): SongList[] {
		return this.storage.lists.filter(list =>
			list.entries.some(e => e.md5 === md5)
		)
	}

	/**
	 * Refreshes the lists from storage.
	 */
	async refresh() {
		await this.loadLists()
		this.listsChanged.emit(this.storage.lists)
	}
}
