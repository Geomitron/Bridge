import { HttpClient } from '@angular/common/http'
import { Injectable, signal, computed } from '@angular/core'

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

	readonly searchLoading = signal(false)
	readonly songsResponse = signal<Partial<SearchResult>>({})
	readonly currentPage = signal(1)
	readonly isDefaultSearch = signal(true)
	readonly isAdvancedSearch = signal(false)
	readonly lastAdvancedSearch = signal<AdvancedSearch | null>(null)

	readonly groupedSongs = signal<ChartData[][]>([])

	readonly availableIcons = signal<string[]>([])

	// Form control signals
	readonly searchValue = signal('')
	readonly instrument = signal<Instrument | null>(
		(localStorage.getItem('instrument') === 'null' ? null : localStorage.getItem('instrument')) as Instrument | null
	)
	readonly difficulty = signal<Difficulty | null>(
		(localStorage.getItem('difficulty') === 'null' ? null : localStorage.getItem('difficulty')) as Difficulty | null
	)
	readonly drumType = signal<DrumTypeName | null>(
		(localStorage.getItem('drumType') === 'null' ? null : localStorage.getItem('drumType')) as DrumTypeName | null
	)
	readonly drumsReviewed = signal<boolean>((localStorage.getItem('drumsReviewed') ?? 'false') === 'true')

	readonly sortDirection = signal<'asc' | 'desc'>('asc')
	readonly sortColumn = signal<'name' | 'artist' | 'album' | 'genre' | 'year' | 'charter' | 'length' | 'modifiedTime' | null>(null)

	// Signal for notifying components of search events
	readonly searchEvent = signal<{ type: 'new' | 'update'; response: Partial<SearchResult> } | null>(null)

	readonly areMorePages = computed(() => {
		const response = this.songsResponse()
		const songs = this.groupedSongs()
		return response?.page && songs.length === response.page * resultsPerPage
	})

	constructor(private http: HttpClient) {
		this.http.get<{ "name": string; "sha1": string }[]>('https://clonehero.gitlab.io/sources/icons.json').subscribe(result => {
			this.availableIcons.set(result.map(r => r.name))
		})

		// Perform initial search
		setTimeout(() => {
			this.search().subscribe()
		}, 0)
	}

	setInstrument(value: Instrument | null) {
		this.instrument.set(value)
		localStorage.setItem('instrument', `${value}`)
		if (this.songsResponse().page) {
			this.search(this.searchValue() || '*').subscribe()
		}
	}

	setDifficulty(value: Difficulty | null) {
		this.difficulty.set(value)
		localStorage.setItem('difficulty', `${value}`)
		if (this.songsResponse().page) {
			this.search(this.searchValue() || '*').subscribe()
		}
	}

	setDrumType(value: DrumTypeName | null) {
		this.drumType.set(value)
		localStorage.setItem('drumType', `${value}`)
		if (this.songsResponse().page) {
			this.search(this.searchValue() || '*').subscribe()
		}
	}

	setDrumsReviewed(value: boolean) {
		this.drumsReviewed.set(value)
		localStorage.setItem('drumsReviewed', `${value}`)
		if (this.songsResponse()?.page) {
			this.search(this.searchValue() || '*').subscribe()
		}
	}

	/**
	 * General search, uses the `/search?q=` endpoint.
	 *
	 * If fetching the next page, set `nextPage=true` to incremement the page count in the search.
	 *
	 * Leave the search term blank to fetch the songs with charts most recently added.
	 */
	public search(search = '*', nextPage = false) {
		this.searchLoading.set(true)
		this.isDefaultSearch.set(search === '*')
		this.isAdvancedSearch.set(false)

		if (nextPage) {
			this.currentPage.update(p => p + 1)
		} else {
			this.currentPage.set(1)
		}

		let retries = 10
		return this.http.post<SearchResult>(`${environment.apiUrl}/search`, {
			search,
			per_page: resultsPerPage,
			page: this.currentPage(),
			instrument: this.instrument(),
			difficulty: this.difficulty(),
			drumType: this.drumType(),
			drumsReviewed: this.drumsReviewed(),
			sort: this.sortColumn() !== null ? { type: this.sortColumn(), direction: this.sortDirection() } : null,
			source: 'bridge',
		}).pipe(
			catchError((err, caught) => {
				if (err.status === 400 || retries-- <= 0) {
					this.searchLoading.set(false)
					console.log(err)
					return throwError(() => err)
				} else {
					return timer(2000).pipe(mergeMap(() => caught))
				}
			}),
			tap(response => {
				this.searchLoading.set(false)

				if (!nextPage) {
					// Don't reload results if they are the same
					const currentResponse = this.songsResponse()
					if (this.groupedSongs().length > 0
						&& _.xorBy(currentResponse!.data, response.data, r => r.chartId).length === 0
						&& currentResponse!.found === response.found) {
						return
					} else {
						this.groupedSongs.set([])
					}
				}
				this.songsResponse.set(response)

				const newGroups = _.chain(response.data)
					.groupBy(c => c.songId ?? -1 * c.chartId)
					.values()
					.value()

				this.groupedSongs.update(songs => [...songs, ...newGroups])

				this.searchEvent.set({
					type: nextPage ? 'update' : 'new',
					response,
				})
			})
		)
	}

	public advancedSearch(search: AdvancedSearch, nextPage = false) {
		this.searchLoading.set(true)
		this.isDefaultSearch.set(false)
		this.isAdvancedSearch.set(true)
		this.lastAdvancedSearch.set(search)

		if (nextPage) {
			this.currentPage.update(p => p + 1)
		} else {
			this.currentPage.set(1)
		}

		let retries = 10
		return this.http.post<{ data: SearchResult['data']; found: number }>(`${environment.apiUrl}/search/advanced`, {
			per_page: resultsPerPage,
			page: this.currentPage(),
			...search,
		}).pipe(
			catchError((err, caught) => {
				if (err.status === 400 || retries-- <= 0) {
					this.searchLoading.set(false)
					console.log(err)
					return throwError(() => err)
				} else {
					return timer(2000).pipe(mergeMap(() => caught))
				}
			}),
			tap(response => {
				this.searchLoading.set(false)

				if (!nextPage) {
					// Don't reload results if they are the same
					const currentResponse = this.songsResponse()
					if (this.groupedSongs().length > 0
						&& _.xorBy(currentResponse!.data, response.data, r => r.chartId).length === 0
						&& currentResponse!.found === response.found) {
						return
					} else {
						this.groupedSongs.set([])
					}
				}

				this.songsResponse.set(response)

				const newGroups = _.chain(response.data)
					.groupBy(c => c.songId ?? -1 * c.chartId)
					.values()
					.value()

				this.groupedSongs.update(songs => [...songs, ...newGroups])

				this.searchEvent.set({
					type: nextPage ? 'update' : 'new',
					response,
				})
			})
		)
	}

	public getNextSearchPage() {
		if (this.areMorePages() && !this.searchLoading()) {
			if (this.isAdvancedSearch()) {
				this.advancedSearch(this.lastAdvancedSearch()!, true).subscribe()
			} else {
				this.search(this.searchValue() || '*', true).subscribe()
			}
		}
	}

	public reloadSearch() {
		if (this.isAdvancedSearch()) {
			const lastSearch = this.lastAdvancedSearch()!
			lastSearch.sort = this.sortColumn() !== null ? { type: this.sortColumn()!, direction: this.sortDirection() } : null
			this.lastAdvancedSearch.set(lastSearch)
			this.advancedSearch(lastSearch, false).subscribe()
		} else {
			this.search(this.searchValue() || '*', false).subscribe()
		}
	}
}
