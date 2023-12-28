import { HttpClient } from '@angular/common/http'
import { EventEmitter, Injectable } from '@angular/core'
import { FormControl } from '@angular/forms'

import { chain, xorBy } from 'lodash'
import { catchError, mergeMap, tap, throwError, timer } from 'rxjs'
import { Difficulty, Instrument } from 'scan-chart'
import { environment } from 'src-angular/environments/environment'
import { AdvancedSearch, ChartData, SearchResult } from 'src-shared/interfaces/search.interface'

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

	public groupedSongs: ChartData[][]

	public availableIcons: string[]

	public searchControl = new FormControl('', { nonNullable: true })
	public instrument: FormControl<Instrument | null>
	public difficulty: FormControl<Difficulty | null>

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
					if (this.groupedSongs && xorBy(this.songsResponse.data, response.data, r => r.chartId).length === 0) {
						return
					} else {
						this.groupedSongs = []
					}
				}
				this.songsResponse = response

				this.groupedSongs.push(
					...chain(response.data)
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

	public advancedSearch(search: AdvancedSearch) {
		this.searchLoading = true
		this.isDefaultSearch = false

		let retries = 10
		return this.http.post<{ data: SearchResult['data'] }>(`${environment.apiUrl}/search/advanced`, search).pipe(
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

				// Don't reload results if they are the same
				if (this.groupedSongs && xorBy(this.songsResponse.data, response.data, r => r.chartId).length === 0) {
					return
				} else {
					this.groupedSongs = []
				}

				this.songsResponse = response

				this.groupedSongs.push(
					...chain(response.data)
						.groupBy(c => c.songId ?? -1 * c.chartId)
						.values()
						.value()
				)

				this.newSearch.emit(response)
			})
		)
	}
}
