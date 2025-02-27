import { HttpClient } from '@angular/common/http'
import { EventEmitter, Injectable } from '@angular/core'
import { FormControl } from '@angular/forms'

import _ from 'lodash'
import { catchError, mergeMap, tap, throwError, timer } from 'rxjs'
import { Difficulty, Instrument } from 'scan-chart'
import { environment } from 'src-angular/environments/environment'
import { AdvancedSearch, ChartData, SearchResult } from 'src-shared/interfaces/search.interface'
import { DrumTypeName } from 'src-shared/UtilFunctions'

const resultsPerPage = 25

@Injectable({
	providedIn: 'root',
})
export class SearchService {

	public searchLoading = false
	public songsResponse: Partial<SearchResult>
	public currentPage = 1
	public newSearch = new EventEmitter<Partial<SearchResult>>()
	public updateSearch = new EventEmitter<Partial<SearchResult>>()
	public isDefaultSearch = true
	public isAdvancedSearch = false
	public lastAdvancedSearch: AdvancedSearch

	public groupedSongs: ChartData[][]

	public availableIcons: string[]

	public searchControl = new FormControl('', { nonNullable: true })
	public instrument: FormControl<Instrument | null>
	public difficulty: FormControl<Difficulty | null>
	public drumType: FormControl<DrumTypeName | null>
	public sortDirection: 'asc' | 'desc' = 'asc'
	public sortColumn: 'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null = null

	constructor(
		private http: HttpClient,
	) {
		this.instrument = new FormControl<Instrument>(
			(localStorage.getItem('instrument') === 'null' ? null : localStorage.getItem('instrument')) as Instrument
		)
		this.instrument.valueChanges.subscribe(instrument => {
			localStorage.setItem('instrument', `${instrument}`)
			if (this.songsResponse.page) {
				this.search(this.searchControl.value || '*').subscribe()
			}
		})

		this.difficulty = new FormControl<Difficulty>(
			(localStorage.getItem('difficulty') === 'null' ? null : localStorage.getItem('difficulty')) as Difficulty
		)
		this.difficulty.valueChanges.subscribe(difficulty => {
			localStorage.setItem('difficulty', `${difficulty}`)
			if (this.songsResponse.page) {
				this.search(this.searchControl.value || '*').subscribe()
			}
		})

		this.drumType = new FormControl<DrumTypeName>(
			(localStorage.getItem('drumType') === 'null' ? null : localStorage.getItem('drumType')) as DrumTypeName
		)
		this.drumType.valueChanges.subscribe(drumType => {
			localStorage.setItem('drumType', `${drumType}`)
			if (this.songsResponse.page) {
				this.search(this.searchControl.value || '*').subscribe()
			}
		})

		this.http.get<{ "name": string; "sha1": string }[]>('https://clonehero.gitlab.io/sources/icons.json').subscribe(result => {
			this.availableIcons = result.map(r => r.name)
		})

		this.search().subscribe()
	}

	get areMorePages() { return this.songsResponse?.page && this.groupedSongs.length === this.songsResponse.page * resultsPerPage }

	/**
	 * General search, uses the `/search?q=` endpoint.
	 *
	 * If fetching the next page, set `nextPage=true` to incremement the page count in the search.
	 *
	 * Leave the search term blank to fetch the songs with charts most recently added.
	 */
	public search(search = '*', nextPage = false) {
		this.searchLoading = true
		this.isDefaultSearch = search === '*'
		this.isAdvancedSearch = false

		if (nextPage) {
			this.currentPage++
		} else {
			this.currentPage = 1
		}

		let retries = 10
		return this.http.post<SearchResult>(`${environment.apiUrl}/search`, {
			search,
			per_page: resultsPerPage,
			page: this.currentPage,
			instrument: this.instrument.value,
			difficulty: this.difficulty.value,
			drumType: this.drumType.value,
			sort: this.sortColumn !== null ? { type: this.sortColumn, direction: this.sortDirection } : null,
			source: 'bridge',
		}).pipe(
			catchError((err, caught) => {
				if (err.status === 400 || retries-- <= 0) {
					this.searchLoading = false
					console.log(err)
					return throwError(() => err)
				} else {
					return timer(2000).pipe(mergeMap(() => caught))
				}
			}),
			tap(async (response) => {
				this.searchLoading = false

				// TODO: Do this operation at the start of the app and when downloading new songs instead of at every search ?
				const songs = await window.electron.invoke.readDirectory()

				// TODO: Add a toggle in the option to show/hide downloaded songs
				// ! Currently this only works if the user have "artist", "name" and "charter" in the chartFolderName setting
				// ! Maybe add a way to make it work everytime ? Or make this option require the user to have those 3 in the setting
				response.data = response.data.filter(c => {
					return !songs.some(s => s.includes(c.artist!) && s.includes(c.name!) && s.includes(c.charter!))
				})

				if (!nextPage) {
					// Don't reload results if they are the same
					if (this.groupedSongs
						&& _.xorBy(this.songsResponse!.data, response.data, r => r.chartId).length === 0
						&& this.songsResponse!.found === response.found) {
						return
					} else {
						this.groupedSongs = []
					}
				}
				this.songsResponse = response

				this.groupedSongs.push(
					..._.chain(response.data)
						.groupBy(c => c.songId ?? -1 * c.chartId)
						.values()
						.value()
				)

				if (nextPage) {
					this.updateSearch.emit(response)
				} else {
					this.newSearch.emit(response)
				}
			})
		)
	}

	public advancedSearch(search: AdvancedSearch, nextPage = false) {
		this.searchLoading = true
		this.isDefaultSearch = false
		this.isAdvancedSearch = true
		this.lastAdvancedSearch = search

		if (nextPage) {
			this.currentPage++
		} else {
			this.currentPage = 1
		}

		let retries = 10
		return this.http.post<{ data: SearchResult['data']; found: number }>(`${environment.apiUrl}/search/advanced`, {
			per_page: resultsPerPage,
			page: this.currentPage,
			...search,
		}).pipe(
			catchError((err, caught) => {
				if (err.status === 400 || retries-- <= 0) {
					this.searchLoading = false
					console.log(err)
					return throwError(() => err)
				} else {
					return timer(2000).pipe(mergeMap(() => caught))
				}
			}),
			tap(response => {
				this.searchLoading = false

				if (!nextPage) {
					// Don't reload results if they are the same
					if (this.groupedSongs
						&& _.xorBy(this.songsResponse!.data, response.data, r => r.chartId).length === 0
						&& this.songsResponse!.found === response.found) {
						return
					} else {
						this.groupedSongs = []
					}
				}

				this.songsResponse = response

				this.groupedSongs.push(
					..._.chain(response.data)
						.groupBy(c => c.songId ?? -1 * c.chartId)
						.values()
						.value()
				)

				if (nextPage) {
					this.updateSearch.emit(response)
				} else {
					this.newSearch.emit(response)
				}
			})
		)
	}

	public getNextSearchPage() {
		if (this.areMorePages && !this.searchLoading) {
			if (this.isAdvancedSearch) {
				this.advancedSearch(this.lastAdvancedSearch, true).subscribe()
			} else {
				this.search(this.searchControl.value || '*', true).subscribe()
			}
		}
	}

	public reloadSearch() {
		if (this.isAdvancedSearch) {
			this.advancedSearch(this.lastAdvancedSearch, false).subscribe()
		} else {
			this.search(this.searchControl.value || '*', false).subscribe()
		}
	}
}
